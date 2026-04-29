// Gemini API 서비스 인터페이스 및 구현

import { GeminiContent, GeminiStreamChunk } from '../../types/gemini'
import { ApiError } from '../../types/errors'
import { GEMINI_API_BASE_URL, GEMINI_MODELS, GEMINI_GENERATION_CONFIG } from '../constants/api'
import { devLog } from '../utils/logger'

const MAX_STREAM_ATTEMPTS = 5
const RETRYABLE_STATUS = new Set([429, 503])

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function getRetryDelayMs(response: Response, attemptIndex: number): number {
  const retryAfter = response.headers.get('Retry-After')
  if (retryAfter) {
    const seconds = parseInt(retryAfter, 10)
    if (!Number.isNaN(seconds) && seconds > 0) {
      return Math.min(seconds * 1000, 120_000)
    }
  }
  const base = 2000 * 2 ** attemptIndex
  return Math.min(base, 60_000)
}

export interface IGeminiService {
  streamGenerateContent(
    apiKey: string,
    contents: GeminiContent[],
    options?: {
      tools?: Array<{ google_search?: Record<string, never> }>
      onChunk?: (chunk: GeminiStreamChunk) => void
    }
  ): Promise<string>
}

/**
 * Gemini API 서비스 구현
 */
export class GeminiService implements IGeminiService {
  async streamGenerateContent(
    apiKey: string,
    contents: GeminiContent[],
    options?: {
      tools?: Array<{ google_search?: Record<string, never> }>
      onChunk?: (chunk: GeminiStreamChunk) => void
    }
  ): Promise<string> {
    const cleanApiKey = String(apiKey || '').trim()
    if (!cleanApiKey) {
      throw new Error('API Key가 비어있습니다')
    }

    const model = options?.tools ? GEMINI_MODELS.FLASH_EXP : GEMINI_MODELS.FLASH
    const url = `${GEMINI_API_BASE_URL}/models/${model}:streamGenerateContent?alt=sse&key=${cleanApiKey}`

    const body = JSON.stringify({
      contents,
      tools: options?.tools,
      generationConfig: GEMINI_GENERATION_CONFIG,
    })

    let response!: Response
    for (let attempt = 0; attempt < MAX_STREAM_ATTEMPTS; attempt++) {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body,
      })

      if (response.ok) {
        break
      }

      const errorText = await response.text()
      const canRetry =
        attempt < MAX_STREAM_ATTEMPTS - 1 && RETRYABLE_STATUS.has(response.status)

      if (canRetry) {
        const delayMs = getRetryDelayMs(response, attempt)
        devLog.warn(
          `Gemini API ${response.status} (할당량·일시 과부하). ${delayMs}ms 후 재시도 (${attempt + 1}/${MAX_STREAM_ATTEMPTS})…`
        )
        await sleep(delayMs)
        continue
      }

      throw new ApiError(
        `Gemini API HTTP ${response.status}`,
        response.status,
        errorText
      )
    }

    if (!response.body) {
      throw new Error('응답 스트림을 사용할 수 없습니다')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let fullResponse = ''
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const jsonStr = line.slice(6).trim()
          if (!jsonStr || jsonStr === '[DONE]') continue

          try {
            const data = JSON.parse(jsonStr) as GeminiStreamChunk
            options?.onChunk?.(data)

            if (data.candidates && data.candidates[0]?.content?.parts) {
              const text = data.candidates[0].content.parts[0]?.text || ''
              if (text) {
                fullResponse += text
              }
            }

            // finishReason 확인 (응답이 왜 끝났는지 로그)
            if (data.candidates && data.candidates[0]?.finishReason) {
              const finishReason = data.candidates[0].finishReason
              if (finishReason === 'MAX_TOKENS') {
                devLog.warn('⚠️ [API] 최대 토큰 수에 도달하여 응답이 잘렸습니다. maxOutputTokens를 늘려야 합니다.')
              } else if (finishReason === 'SAFETY') {
                devLog.warn('⚠️ [API] 안전 필터에 의해 응답이 차단되었습니다.')
              } else if (finishReason === 'STOP') {
                devLog.log('✅ [API] 응답이 정상적으로 완료되었습니다. (총 길이: ' + fullResponse.length + '자)')
              } else {
                devLog.warn('⚠️ [API] 알 수 없는 종료 이유: ' + finishReason)
              }
            }
          } catch (e) {
            console.warn('JSON 파싱 오류:', e, jsonStr)
          }
        }
      }
    }

    return fullResponse
  }
}

// 싱글톤 인스턴스
export const geminiService = new GeminiService()

