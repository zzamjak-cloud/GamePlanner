import { SYSTEM_INSTRUCTION } from '../lib/systemInstruction'
import { Message, useAppStore } from '../store/useAppStore'
import { GeminiContent } from '../types/gemini'
import { streamWithContinuation } from '../lib/services/openRouterService'
import {
  SECTIONED_MODE_OVERRIDE,
  generateSectioned,
  planSections,
} from '../lib/services/sectionedGeneration'
import { CHAT_HISTORY_LIMIT } from '../lib/constants/api'
import { StreamingProgressTracker } from '../lib/utils/streamingProgress'
import { devLog } from '../lib/utils/logger'

interface StreamCallbacks {
  onChatUpdate: (text: string) => void
  onMarkdownUpdate: (markdown: string) => void
  onComplete: (finalChatText: string) => void
  onError: (error: Error) => void
}

export function useGeminiChat() {
  const sendMessage = async (
    apiKey: string,
    message: string,
    callbacks: StreamCallbacks,
    chatHistory?: Message[],
    currentMarkdown?: string,
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
      let systemMessage = systemPrompt || SYSTEM_INSTRUCTION  // fallback

      // 2. 현재 기획서가 있으면 시스템 메시지에 포함
      if (currentMarkdown && currentMarkdown.trim()) {
        systemMessage += `\n\n---\n\n# 현재 작성된 기획서\n아래는 현재까지 작성된 기획서입니다. 수정 요청이 들어오면 이 내용을 기반으로 요청된 부분만 수정하고 나머지는 그대로 유지하십시오.\n\n<current_markdown>\n${currentMarkdown}\n</current_markdown>`
      }

      contents.push({
        role: 'user',
        parts: [{ text: systemMessage }]
      })

      contents.push({
        role: 'model',
        parts: [{ text: '네, 이해했습니다. 게임 기획 전문가로서 도와드리겠습니다.' }]
      })

      // 3. 이전 대화 히스토리 추가
      if (chatHistory && chatHistory.length > 0) {
        const recentHistory = chatHistory.slice(-CHAT_HISTORY_LIMIT)
        for (const msg of recentHistory) {
          contents.push({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.content }]
          })
        }
      }

      // 4. 현재 사용자 메시지 추가
      contents.push({
        role: 'user',
        parts: [{ text: message }]
      })

      // 디버그 로그 제거
      // console.log('📝 전달되는 컨텍스트:', {
      //   시스템지시문: '포함됨',
      //   현재기획서: currentMarkdown ? '포함됨 (' + currentMarkdown.length + '자)' : '없음',
      //   대화히스토리: chatHistory?.length || 0,
      //   총메시지수: contents.length
      // })

      // 신규 기획서는 섹션 단위로 나눠 생성한다.
      // 각 섹션이 최대 출력 예산(65,536)을 온전히 쓰므로 잘림이 사실상 사라지고,
      // 섹션당 집중도가 올라가 품질도 함께 개선된다.
      // 기존 기획서 수정 요청은 문서 전체 맥락이 필요하므로 단일 호출 경로를 유지하고,
      // 자동 이어쓰기로 잘림을 방어한다.
      const template = systemPrompt || SYSTEM_INSTRUCTION
      const isNewDocument = !currentMarkdown || !currentMarkdown.trim()
      const sections = isNewDocument ? planSections(template) : []

      if (sections.length > 0) {
        devLog.log(`📐 [기획] 섹션 분할 생성 시작 - ${sections.length}개 섹션`)

        // 시스템 지시문의 "전체 재출력" 규칙이 섹션 단위 생성과 충돌하므로 무효화 지시를 덧붙인다
        const sectionedContents: GeminiContent[] = contents.map((content, index) =>
          index === 0
            ? {
                ...content,
                parts: [
                  {
                    text: `${content.parts[0]?.text || ''}

${SECTIONED_MODE_OVERRIDE}`,
                  },
                ],
              }
            : content
        )

        const { markdown, truncated } = await generateSectioned(
          cleanApiKey,
          sections,
          sectionedContents,
          {
            onProgress: (message) => callbacks.onChatUpdate(message),
            onMarkdownUpdate: (md) => callbacks.onMarkdownUpdate(md),
          },
          useAppStore.getState().chatModel
        )

        callbacks.onMarkdownUpdate(markdown)

        let sectionedChatText = '기획서 작성이 완료되었습니다.'
        if (truncated) {
          sectionedChatText += `

⚠️ 경고: 일부 섹션이 너무 길어 완결되지 않았을 수 있습니다. 해당 섹션만 다시 요청해 주세요.`
        }

        callbacks.onComplete(sectionedChatText)
        return
      }

      let fullResponse = ''

      // 진행 상황 추적기 초기화 (템플릿 프롬프트만 사용)
      const progressTracker = new StreamingProgressTracker(template)
      devLog.log('📊 [기획] 진행 상황 추적 시작 - 헤더 개수:', progressTracker.getTotalCount())

      // OpenRouter 서비스를 통한 스트리밍 호출 (사용자 선택 모델 적용)
      // 잘리면 자동으로 이어받아 재요청한다.
      const { truncated: wasMaxTokens } = await streamWithContinuation(cleanApiKey, contents, {
        model: useAppStore.getState().chatModel,
        onChunk: (chunk) => {
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
                // 기획 모드에서는 태그 없이도 모든 내용을 마크다운으로 처리 (대비책)
                if (fullResponse.trim().length > 100) {
                  devLog.warn('⚠️ [기획] <markdown_content> 태그 없음 - 모든 내용을 마크다운으로 처리')
                  markdownContent = fullResponse

                  // 진행 상황 추적
                  const progressMessage = progressTracker.update(markdownContent)
                  if (progressMessage) {
                    callbacks.onChatUpdate(progressMessage)
                  } else {
                    callbacks.onChatUpdate(progressTracker.getLastMessage() || '기획서 작성 중...')
                  }

                  callbacks.onMarkdownUpdate(markdownContent)
                } else {
                  // 짧은 메시지는 채팅으로 처리
                  chatText = fullResponse
                  callbacks.onChatUpdate(chatText)
                }
              } else if (parts.length === 2) {
                // markdown_content 태그가 열렸지만 아직 닫히지 않음
                chatText = parts[0]
                markdownContent = parts[1]

                // 진행 상황 추적 및 업데이트
                const progressMessage = progressTracker.update(markdownContent)
                if (progressMessage) {
                  // 헤더가 변경되었으면 진행 상황 메시지로 채팅 업데이트
                  callbacks.onChatUpdate(progressMessage)
                } else if (!chatText) {
                  // 진행 메시지가 없으면 기본 메시지 표시
                  callbacks.onChatUpdate(progressTracker.getLastMessage() || '기획서 작성 중...')
                }

                callbacks.onMarkdownUpdate(markdownContent)
              } else if (parts.length >= 3) {
                // markdown_content 태그가 열리고 닫힘
                chatText = parts[0] + (parts[2] || '')
                markdownContent = parts[1]
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
        // 태그가 없으면 긴 내용은 마크다운으로 처리
        if (fullResponse.trim().length > 100) {
          devLog.log('📋 [기획 완료] 태그 없음 - 전체 내용을 마크다운으로 처리')
          finalMarkdownContent = fullResponse
          chatText = '기획서 작성이 완료되었습니다.'

          // 최종 마크다운 업데이트
          callbacks.onMarkdownUpdate(finalMarkdownContent)
        } else {
          chatText = fullResponse
        }
      } else if (parts.length >= 3) {
        // 태그가 있으면 태그 밖의 내용을 채팅으로 처리
        chatText = parts[0] + (parts[2] || '')
        finalMarkdownContent = parts[1]

        devLog.log('📋 [기획 완료] 태그 파싱 성공 - 마크다운 길이:', finalMarkdownContent.length)

        // 최종 마크다운 업데이트
        callbacks.onMarkdownUpdate(finalMarkdownContent)
      } else if (parts.length === 2) {
        // 태그가 열렸지만 닫히지 않은 경우 (가장 중요!)
        chatText = parts[0]
        finalMarkdownContent = parts[1]

        devLog.warn('⚠️ [기획 완료] 태그가 닫히지 않음 - 부분 처리 (길이: ' + finalMarkdownContent.length + ')')

        // 최종 마크다운 업데이트
        callbacks.onMarkdownUpdate(finalMarkdownContent)
      }

      // MAX_TOKENS 경고 추가
      if (wasMaxTokens) {
        const warningMessage = '\n\n⚠️ 경고: 기획서가 너무 길어서 일부 내용이 잘렸을 수 있습니다. "계속 작성해줘" 또는 "9번 항목을 완성해줘"라고 요청하세요.'
        chatText = chatText ? chatText + warningMessage : warningMessage
      }

      callbacks.onComplete(chatText)
    } catch (error) {
      console.error('OpenRouter API Error:', error)
      callbacks.onError(
        error instanceof Error ? error : new Error('알 수 없는 오류가 발생했습니다')
      )
    }
  }

  return { sendMessage }
}
