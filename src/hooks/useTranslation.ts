/**
 * OpenRouter API를 사용한 프롬프트 번역 훅
 * 한국어 ↔ 영어 양방향 번역 지원
 */

import { OPENROUTER_API_BASE_URL, OPENROUTER_MODELS } from '../lib/constants/api'

export function useTranslation() {
  /**
   * 프롬프트를 번역합니다
   * @param apiKey OpenRouter API 키
   * @param text 번역할 텍스트
   * @param targetLang 목표 언어 ('ko' 또는 'en')
   * @returns 번역된 텍스트
   */
  const translatePrompt = async (
    apiKey: string,
    text: string,
    targetLang: 'ko' | 'en'
  ): Promise<string> => {
    // 번역 시스템 프롬프트
    const systemPrompt = targetLang === 'ko'
      ? 'You are a professional translator. Translate the following AI prompt from English to Korean. Maintain the original structure, formatting, and technical terms. Output only the translated text without any additional explanations.'
      : 'You are a professional translator. Translate the following AI prompt from Korean to English. Maintain the original structure, formatting, and technical terms. Output only the translated text without any additional explanations.'

    // 최신 Flash 모델로 번역 요청 (비스트리밍)
    const response = await fetch(`${OPENROUTER_API_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: OPENROUTER_MODELS.FLASH,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text },
        ],
        temperature: 0.3,
        max_tokens: 8192,
      })
    })

    if (!response.ok) {
      const error = await response.json().catch(() => null)
      throw new Error(error?.error?.message || '번역 요청 실패')
    }

    const data = await response.json()

    // 응답 파싱
    const translatedText = data.choices?.[0]?.message?.content
    if (!translatedText) {
      throw new Error('번역 결과를 받지 못했습니다.')
    }

    return translatedText
  }

  return { translatePrompt }
}
