// 메시지 처리 로직을 담당하는 커스텀 훅

import { useAppStore, SessionType } from '../store/useAppStore'
import { useGeminiChat } from './useGeminiChat'
import { useGameAnalysis } from './useGameAnalysis'
import { SYSTEM_INSTRUCTION } from '../lib/systemInstruction'
import { filterRelevantFiles, validateFileSize, MAX_FILE_SIZE_CHARS } from '../lib/utils/fileOptimization'
import { saveSessionImmediately } from '../lib/utils/sessionSave'
import { devLog } from '../lib/utils/logger'

interface MessageHandlerCallbacks {
  onChatUpdate?: (text: string) => void
  onMarkdownUpdate?: (markdown: string) => void
  onComplete?: (finalChatText: string) => void
  onError?: (error: Error) => void
}

export function useMessageHandler() {
  const {
    apiKey,
    addMessage,
    setMarkdownContent,
    setIsLoading,
    updateAnalysisStatus,
    getTemplateById,
    currentPlanningTemplateId,
    currentAnalysisTemplateId,
  } = useAppStore()

  const { sendMessage } = useGeminiChat()
  const { analyzeGame } = useGameAnalysis()

  const handleSendMessage = async (
    message: string,
    callbacks: MessageHandlerCallbacks = {}
  ) => {
    if (!apiKey) {
      throw new Error('API Key를 먼저 설정해주세요')
    }

    // 세션이 없으면 에러 발생 (자동 생성 제거)
    const store = useAppStore.getState()
    if (!store.currentSessionId || store.sessions.length === 0) {
      throw new Error('세션이 없습니다. + 버튼을 클릭하여 새 세션을 생성해주세요.')
    }

    // 현재 상태 가져오기
    const currentState = useAppStore.getState()
    const currentSession = currentState.sessions.find(s => s.id === currentState.currentSessionId)

    // 디버그 로그 제거
    // console.log('📋 현재 세션 정보:', {
    //   sessionId: currentSession?.id,
    //   sessionType: currentSession?.type,
    //   sessionTitle: currentSession?.title,
    //   currentSessionType: currentState.currentSessionType
    // })

    // 분석 모드인 경우
    if (currentSession?.type === SessionType.ANALYSIS) {
      return handleAnalysisMessage(
        message,
        currentSession,
        currentState,
        callbacks
      )
    }

    // 기획 모드인 경우
    return handlePlanningMessage(
      message,
      currentSession,
      currentState,
      callbacks
    )
  }

  const handleAnalysisMessage = async (
    message: string,
    currentSession: ReturnType<typeof useAppStore.getState>['sessions'][0],
    currentState: ReturnType<typeof useAppStore.getState>,
    callbacks: MessageHandlerCallbacks
  ) => {
    // 디버그 로그 제거
    // console.log('🔍 분석 모드로 실행')

    // 현재 상태 가져오기 (메시지 추가 전)
    const chatHistory = [...currentState.messages] // 현재까지의 대화 히스토리
    const currentAnalysisContent = currentState.markdownContent // 현재 분석 내용

    // 템플릿 기반 시스템 프롬프트 로드
    const template = getTemplateById(currentSession.templateId || currentAnalysisTemplateId || 'default-analysis')
    const systemPrompt = template?.content || ''

    // 디버그 로그 제거
    // console.log('📋 사용 중인 분석 템플릿:', template?.name || '기본 분석 템플릿')

    // 사용자 메시지 추가
    addMessage({ role: 'user', content: message })
    setIsLoading(true)

    // 분석 상태 업데이트
    updateAnalysisStatus(currentSession.id, 'running')

    try {
      // 대화 히스토리와 현재 분석 내용, 템플릿 프롬프트를 함께 전달
      await analyzeGame(
        apiKey!,
        message,
        {
          onChatUpdate: (text) => {
            callbacks.onChatUpdate?.(text)
          },
          onMarkdownUpdate: (markdown) => {
            setMarkdownContent(markdown)
            callbacks.onMarkdownUpdate?.(markdown)
            // 마크다운 업데이트 시 즉시 저장 (중요한 변화 지점)
            saveSessionImmediately().catch(err => console.error('마크다운 업데이트 저장 실패:', err))
          },
          onComplete: async (finalChatText) => {
            updateAnalysisStatus(currentSession.id, 'completed')
            if (finalChatText.trim()) {
              addMessage({ role: 'assistant', content: finalChatText })
            }
            setIsLoading(false)
            // 분석 완료 후 즉시 세션 저장
            await saveSessionImmediately()
            callbacks.onComplete?.(finalChatText)
          },
          onError: (error) => {
            console.error('분석 오류:', error)
            updateAnalysisStatus(currentSession.id, 'failed')
            addMessage({
              role: 'assistant',
              content: `분석 중 오류가 발생했습니다: ${error.message}`,
            })
            setIsLoading(false)
            callbacks.onError?.(error)
          },
        },
        chatHistory, // 대화 히스토리 전달
        currentAnalysisContent, // 현재 분석 내용 전달
        systemPrompt // 템플릿 프롬프트 전달
      )
    } catch (error) {
      console.error('분석 실행 오류:', error)
      updateAnalysisStatus(currentSession.id, 'failed')
      setIsLoading(false)
      callbacks.onError?.(error instanceof Error ? error : new Error('알 수 없는 오류가 발생했습니다'))
    }
  }

  const handlePlanningMessage = async (
    message: string,
    currentSession: ReturnType<typeof useAppStore.getState>['sessions'][0] | undefined,
    currentState: ReturnType<typeof useAppStore.getState>,
    callbacks: MessageHandlerCallbacks
  ) => {
    devLog.log('📝 기획 모드 실행')
    
    const chatHistory = [...currentState.messages] // 현재까지의 대화 히스토리
    const currentMarkdownContent = currentState.markdownContent // 현재 기획서

    // 템플릿 기반 시스템 프롬프트 로드
    const template = getTemplateById(currentSession?.templateId || currentPlanningTemplateId || 'default-planning')
    let systemPrompt = template?.content || SYSTEM_INSTRUCTION

    // 참조 파일이 있으면 시스템 프롬프트에 추가 (최적화: 관련 파일만 필터링, 요약 우선 사용)
    if (currentSession?.referenceFiles && currentSession.referenceFiles.length > 0) {
      // 사용자 메시지와 관련된 파일만 필터링
      const relevantFiles = filterRelevantFiles(currentSession.referenceFiles, message)
      
      if (relevantFiles.length > 0) {
        const referenceContent = relevantFiles.map((file, index) => {
          // 스마트 포함 전략:
          // 1. 요약이 있고 파일이 크면 요약만 사용
          // 2. 요약이 있지만 파일이 작으면 요약 + 전체 내용
          // 3. 요약이 없으면 크기 제한 적용하여 전체 내용 사용
          let content: string
          let useSummary = false
          let includeFullContent = false
          
          if (file.summary && file.summary.length > 0) {
            // 요약이 있는 경우
            if (file.content.length > MAX_FILE_SIZE_CHARS) {
              // 파일이 크면 요약만 사용
              content = file.summary
              useSummary = true
            } else if (file.content.length > 5000) {
              // 파일이 중간 크기면 요약 + 일부 내용
              const validation = validateFileSize(file.content)
              const truncatedContent = validation.truncated || file.content
              content = `${file.summary}\n\n---\n\n[전체 내용 일부]\n${truncatedContent}`
              useSummary = true
              includeFullContent = true
            } else {
              // 파일이 작으면 전체 내용 사용
              content = file.content
            }
          } else {
            // 요약이 없으면 크기 제한 적용하여 전체 내용 사용
            const validation = validateFileSize(file.content)
            content = validation.truncated || file.content
          }
          
          const sizeInfo = useSummary && file.content.length > MAX_FILE_SIZE_CHARS
            ? ` (요약 포함, 원본 ${(file.content.length / 1000).toFixed(0)}K자)`
            : includeFullContent
            ? ` (요약 + 일부 내용, 원본 ${(file.content.length / 1000).toFixed(0)}K자)`
            : file.content.length > content.length
            ? ` (${(file.content.length / 1000).toFixed(0)}K자 중 일부만 포함됨)`
            : ''
          
          return `[참조 파일 ${index + 1}: ${file.fileName} (${file.fileType})${sizeInfo}]\n${content}`
        }).join('\n\n---\n\n')
        
        const fileCountInfo = currentSession.referenceFiles.length > relevantFiles.length
          ? `\n(참고: 총 ${currentSession.referenceFiles.length}개 참조 파일 중 사용자 요청과 관련된 ${relevantFiles.length}개만 포함했습니다)`
          : ''
        
        systemPrompt += `\n\n---\n\n# 참조 파일${fileCountInfo}\n다음 참조 파일들의 내용을 참고하여 기획서를 작성하세요. 이 파일들의 내용을 분석하고 기획서에 반영하세요.\n\n${referenceContent}`
      }
    }

    // 디버그 로그 제거
    // console.log('📋 사용 중인 기획 템플릿:', template?.name || '기본 기획 템플릿')
    // if (currentSession?.referenceFiles && currentSession.referenceFiles.length > 0) {
    //   console.log('📎 참조 파일 개수:', currentSession.referenceFiles.length)
    // }

    // 사용자 메시지 추가
    addMessage({ role: 'user', content: message })
    setIsLoading(true)

    try {
      // 대화 히스토리와 현재 마크다운, 템플릿 프롬프트를 함께 전달
      await sendMessage(
        apiKey!,
        message,
        {
          onChatUpdate: (text) => {
            callbacks.onChatUpdate?.(text)
          },
          onMarkdownUpdate: (markdown) => {
            setMarkdownContent(markdown)
            callbacks.onMarkdownUpdate?.(markdown)
            // 마크다운 업데이트 시 즉시 저장 (중요한 변화 지점)
            saveSessionImmediately().catch(err => console.error('마크다운 업데이트 저장 실패:', err))
          },
          onComplete: async (finalChatText) => {
            if (finalChatText.trim()) {
              addMessage({ role: 'assistant', content: finalChatText })
            }
            setIsLoading(false)
            // 채팅 완료 후 즉시 세션 저장
            await saveSessionImmediately()
            callbacks.onComplete?.(finalChatText)
          },
          onError: (error) => {
            console.error('Gemini API Error:', error)
            addMessage({
              role: 'assistant',
              content: `오류가 발생했습니다: ${error.message}`,
            })
            setIsLoading(false)
            callbacks.onError?.(error)
          },
        },
        chatHistory, // 대화 히스토리 전달
        currentMarkdownContent, // 현재 기획서 전달
        systemPrompt // 템플릿 프롬프트 전달
      )
    } catch (error) {
      console.error('Error:', error)
      addMessage({
        role: 'assistant',
        content: '오류가 발생했습니다. 다시 시도해주세요.',
      })
      setIsLoading(false)
      callbacks.onError?.(error instanceof Error ? error : new Error('알 수 없는 오류가 발생했습니다'))
    }
  }

  return { handleSendMessage }
}

