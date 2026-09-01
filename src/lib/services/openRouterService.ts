// OpenRouter API 서비스 (OpenAI 호환 Chat Completions)
// 회사 통합 OpenRouter 키 하나로 Gemini 등 여러 provider 모델을 호출한다.

import { GeminiContent, GeminiStreamChunk } from '../../types/gemini'
import { ApiError } from '../../types/errors'
import { OPENROUTER_API_BASE_URL, GENERATION_CONFIG, normalizeChatModel } from '../constants/api'
import { devLog } from '../utils/logger'

const MAX_STREAM_ATTEMPTS = 5
const RETRYABLE_STATUS = new Set([429, 502, 503])

// OpenRouter 순위 표시에 쓰이는 선택 헤더 값
const APP_TITLE = 'GamePlanner'

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

// OpenAI 호환 finish_reason → 기존 Gemini finishReason 매핑 (호출부 호환 유지)
const FINISH_REASON_MAP: Record<string, string> = {
  stop: 'STOP',
  length: 'MAX_TOKENS',
  content_filter: 'SAFETY',
}

interface OpenRouterStreamChunk {
  choices?: Array<{
    delta?: { content?: string | null }
    finish_reason?: string | null
  }>
  error?: {
    message?: string
    code?: number
  }
}

// 기존 GeminiContent(role: user|model) → OpenAI 메시지 형식 변환
function toMessages(contents: GeminiContent[]): Array<{ role: 'user' | 'assistant'; content: string }> {
  return contents.map((c) => ({
    role: c.role === 'model' ? 'assistant' : 'user',
    content: c.parts.map((p) => p.text || '').join(''),
  }))
}

// OpenAI 형식 델타를 기존 호출부가 소비하는 GeminiStreamChunk 형태로 변환
function toGeminiChunk(text: string, finishReason: string | null | undefined): GeminiStreamChunk {
  return {
    candidates: [
      {
        content: { parts: [{ text }], role: 'model' },
        finishReason: finishReason ? FINISH_REASON_MAP[finishReason] || finishReason.toUpperCase() : undefined,
      },
    ],
  }
}

export interface IOpenRouterService {
  streamGenerateContent(
    apiKey: string,
    contents: GeminiContent[],
    options?: {
      model?: string
      tools?: Array<{ google_search?: Record<string, never> }>
      onChunk?: (chunk: GeminiStreamChunk) => void
    }
  ): Promise<string>
}

/**
 * OpenRouter API 서비스 구현
 */
export class OpenRouterService implements IOpenRouterService {
  async streamGenerateContent(
    apiKey: string,
    contents: GeminiContent[],
    options?: {
      model?: string
      tools?: Array<{ google_search?: Record<string, never> }>
      onChunk?: (chunk: GeminiStreamChunk) => void
    }
  ): Promise<string> {
    const cleanApiKey = String(apiKey || '').trim()
    if (!cleanApiKey) {
      throw new Error('API Key가 비어있습니다')
    }

    // 사용자 선택 모델 우선. 검색 도구 요청 시 :online 접미사로 OpenRouter 웹 검색 플러그인 활성화
    let model: string = normalizeChatModel(options?.model)
    if (options?.tools && !model.endsWith(':online')) {
      model = `${model}:online`
    }

    const url = `${OPENROUTER_API_BASE_URL}/chat/completions`
    const body = JSON.stringify({
      model,
      messages: toMessages(contents),
      stream: true,
      ...GENERATION_CONFIG,
    })

    let response!: Response
    for (let attempt = 0; attempt < MAX_STREAM_ATTEMPTS; attempt++) {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cleanApiKey}`,
          'X-OpenRouter-Title': APP_TITLE,
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
          `OpenRouter API ${response.status} (할당량·일시 과부하). ${delayMs}ms 후 재시도 (${attempt + 1}/${MAX_STREAM_ATTEMPTS})…`
        )
        await sleep(delayMs)
        continue
      }

      throw new ApiError(
        `OpenRouter API HTTP ${response.status}`,
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
        // OpenRouter는 연결 유지용 주석 라인(": OPENROUTER PROCESSING")을 보낸다
        if (!line.startsWith('data: ')) continue

        const jsonStr = line.slice(6).trim()
        if (!jsonStr || jsonStr === '[DONE]') continue

        try {
          const data = JSON.parse(jsonStr) as OpenRouterStreamChunk

          // 스트림 중간 에러 처리
          if (data.error) {
            throw new ApiError(
              `OpenRouter 스트림 오류: ${data.error.message || '알 수 없는 오류'}`,
              data.error.code || 0,
              jsonStr
            )
          }

          const choice = data.choices?.[0]
          const text = choice?.delta?.content || ''
          const finishReason = choice?.finish_reason

          if (text) {
            fullResponse += text
          }

          if (text || finishReason) {
            options?.onChunk?.(toGeminiChunk(text, finishReason))
          }

          // finish_reason 확인 (응답이 왜 끝났는지 로그)
          if (finishReason) {
            if (finishReason === 'length') {
              devLog.warn('⚠️ [API] 최대 토큰 수에 도달하여 응답이 잘렸습니다. max_tokens를 늘려야 합니다.')
            } else if (finishReason === 'content_filter') {
              devLog.warn('⚠️ [API] 안전 필터에 의해 응답이 차단되었습니다.')
            } else if (finishReason === 'stop') {
              devLog.log('✅ [API] 응답이 정상적으로 완료되었습니다. (총 길이: ' + fullResponse.length + '자)')
            } else {
              devLog.warn('⚠️ [API] 알 수 없는 종료 이유: ' + finishReason)
            }
          }
        } catch (e) {
          if (e instanceof ApiError) throw e
          console.warn('JSON 파싱 오류:', e, jsonStr)
        }
      }
    }

    return fullResponse
  }
}

// 싱글톤 인스턴스
export const openRouterService = new OpenRouterService()
