import { createAnalysisSystemPrompt } from '../lib/analysisInstruction'
import { Message } from '../store/useAppStore'
import { GeminiContent } from '../types/gemini'
import { CHAT_HISTORY_LIMIT } from '../lib/constants/api'
import { geminiService } from '../lib/services/geminiService'
import { removeCitationNumbers } from '../lib/utils/markdown'
import { StreamingProgressTracker } from '../lib/utils/streamingProgress'
import { devLog } from '../lib/utils/logger'

interface AnalysisCallbacks {
  onChatUpdate: (text: string) => void
  onMarkdownUpdate: (markdown: string) => void
  onComplete: (finalChatText: string) => void
  onError: (error: Error) => void
}

export function useGameAnalysis() {
  const analyzeGame = async (
    apiKey: string,
    message: string,
    callbacks: AnalysisCallbacks,
    chatHistory?: Message[],
    currentAnalysis?: string,
    systemPrompt?: string  // 신규: 동적 시스템 프롬프트
  ) => {
    try {
      // API Key 검증 및 정리
      const cleanApiKey = String(apiKey || '').trim()
      if (!cleanApiKey) {
        throw new Error('API Key가 비어있습니다')
      }

      // 대화 히스토리 구성
      const contents: GeminiContent[] = []

      // 1. 시스템 지시문을 첫 메시지로 추가 (동적 프롬프트 지원)
      // systemPrompt는 사용자 정의 템플릿 내용 (간결한 버전)
      // createAnalysisSystemPrompt로 시스템 래퍼와 결합
      const systemMessage = createAnalysisSystemPrompt(
        systemPrompt || '기본 분석 템플릿을 사용합니다.',
        currentAnalysis
      )

      contents.push({
        role: 'user',
        parts: [{ text: systemMessage }]
      })

      contents.push({
        role: 'model',
        parts: [{ text: '네, 이해했습니다. 게임 분석 전문가로서 도와드리겠습니다.' }]
      })

      // 2. 이전 대화 히스토리 추가
      if (chatHistory && chatHistory.length > 0) {
        const recentHistory = chatHistory.slice(-CHAT_HISTORY_LIMIT)
        for (const msg of recentHistory) {
          contents.push({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.content }]
          })
        }
      }

      // 3. 현재 사용자 메시지 추가 (히스토리 마지막과 동일하면 스킵)
      const lastHistory = chatHistory?.[chatHistory.length - 1]
      const messageAlreadyInHistory =
        lastHistory?.role === 'user' && lastHistory.content === message

      if (!messageAlreadyInHistory) {
        contents.push({
          role: 'user',
          parts: [{ text: message }]
        })
      }

      // 디버그 로그 제거
      // console.log('📝 전달되는 컨텍스트:', {
      //   시스템지시문: '포함됨',
      //   현재분석내용: currentAnalysis ? '포함됨 (' + currentAnalysis.length + '자)' : '없음',
      //   대화히스토리: chatHistory?.length || 0,
      //   총메시지수: contents.length
      // })

      let fullResponse = ''
      let wasMaxTokens = false // MAX_TOKENS로 종료되었는지 추적

      // 진행 상황 추적기 초기화 (템플릿 프롬프트만 사용)
      const progressTracker = new StreamingProgressTracker(systemPrompt || '기본 분석 템플릿을 사용합니다.')
      devLog.log('📊 [분석] 진행 상황 추적 시작 - 헤더 개수:', progressTracker.getTotalCount())

      // Gemini 서비스를 통한 스트리밍 호출 (Google Search 포함)
      await geminiService.streamGenerateContent(cleanApiKey, contents, {
        tools: [
          {
            google_search: {}
          },
        ],
        onChunk: (chunk) => {
          // finishReason 확인 (MAX_TOKENS 체크)
          if (chunk.candidates && chunk.candidates[0]?.finishReason === 'MAX_TOKENS') {
            wasMaxTokens = true
          }

          if (chunk.candidates && chunk.candidates[0]?.content?.parts) {
            const text = chunk.candidates[0].content.parts[0]?.text || ''
            if (text) {
              fullResponse += text
              // 로그 제거: 스트리밍 중 너무 빈번하게 출력됨
              // console.log('텍스트 수신:', text.substring(0, 50) + '...')

              // <markdown_content> 태그 파싱
              const parts = fullResponse.split(/<markdown_content>|<\/markdown_content>/)

              let chatText = ''
              let markdownContent = ''

              if (parts.length === 1) {
                // markdown_content 태그가 없음
                // 분석 모드에서는 모든 내용을 마크다운으로 처리 (대비책)
                devLog.warn('⚠️ [분석] <markdown_content> 태그 없음 - 모든 내용을 마크다운으로 처리')
                markdownContent = removeCitationNumbers(fullResponse)

                // 진행 상황 추적
                const progressMessage = progressTracker.update(markdownContent)
                if (progressMessage) {
                  callbacks.onChatUpdate(progressMessage)
                } else {
                  callbacks.onChatUpdate(progressTracker.getLastMessage() || '게임 분석 중...')
                }

                callbacks.onMarkdownUpdate(markdownContent)
              } else if (parts.length === 2) {
                // markdown_content 태그가 열렸지만 아직 닫히지 않음
                chatText = parts[0]
                markdownContent = removeCitationNumbers(parts[1])

                // 진행 상황 추적 및 업데이트
                const progressMessage = progressTracker.update(markdownContent)
                if (progressMessage) {
                  // 헤더가 변경되었으면 진행 상황 메시지로 채팅 업데이트
                  callbacks.onChatUpdate(progressMessage)
                } else if (!chatText) {
                  // 진행 메시지가 없으면 기본 메시지 표시
                  callbacks.onChatUpdate(progressTracker.getLastMessage() || '게임 분석 중...')
                }

                callbacks.onMarkdownUpdate(markdownContent)
              } else if (parts.length >= 3) {
                // markdown_content 태그가 열리고 닫힘
                chatText = parts[0] + (parts[2] || '')
                markdownContent = removeCitationNumbers(parts[1])
                callbacks.onChatUpdate(chatText)
                callbacks.onMarkdownUpdate(markdownContent)
              }
            }
          }
        },
      })

      // 최종 파싱
      const parts = fullResponse.split(/<markdown_content>|<\/markdown_content>/)
      let chatText = ''
      let finalMarkdownContent = ''

      if (parts.length === 1) {
        // 태그가 없으면 모든 내용을 마크다운으로 처리
        devLog.log('📋 [분석 완료] 태그 없음 - 전체 내용을 마크다운으로 처리')
        finalMarkdownContent = removeCitationNumbers(fullResponse)
        chatText = '게임 분석이 완료되었습니다.'

        // 최종 마크다운 업데이트
        callbacks.onMarkdownUpdate(finalMarkdownContent)
      } else if (parts.length >= 3) {
        // 태그가 있으면 태그 밖의 내용을 채팅으로 처리
        chatText = parts[0] + (parts[2] || '')
        finalMarkdownContent = removeCitationNumbers(parts[1])

        devLog.log('📋 [분석 완료] 태그 파싱 성공 - 마크다운 길이:', finalMarkdownContent.length)

        // 최종 마크다운 업데이트
        callbacks.onMarkdownUpdate(finalMarkdownContent)
      } else if (parts.length === 2) {
        // 태그가 열렸지만 닫히지 않은 경우
        chatText = parts[0]
        finalMarkdownContent = removeCitationNumbers(parts[1])

        devLog.warn('⚠️ [분석 완료] 태그가 닫히지 않음 - 부분 처리')

        // 최종 마크다운 업데이트
        callbacks.onMarkdownUpdate(finalMarkdownContent)
      }

      // MAX_TOKENS 경고 추가
      if (wasMaxTokens) {
        const warningMessage = '\n\n⚠️ 경고: 분석 보고서가 너무 길어서 일부 내용이 잘렸을 수 있습니다. "계속 작성해줘" 또는 "마지막 항목을 완성해줘"라고 요청하세요.'
        chatText = chatText ? chatText + warningMessage : warningMessage
      }

      callbacks.onComplete(chatText)
    } catch (error) {
      console.error('Gemini API Error:', error)
      callbacks.onError(
        error instanceof Error ? error : new Error('알 수 없는 오류가 발생했습니다')
      )
    }
  }

  return { analyzeGame }
}
