/**
 * Gemini API를 사용한 프롬프트 번역 훅
 * 한국어 ↔ 영어 양방향 번역 지원
 */

export function useTranslation() {
  /**
   * 프롬프트를 번역합니다
   * @param apiKey Gemini API 키
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

    // Gemini 2.5 Flash API 호출 (더 높은 할당량)
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: systemPrompt }]
          },
          {
            role: 'model',
            parts: [{ text: 'I understand. I will translate the AI prompt accurately while preserving its structure and technical terms.' }]
          },
          {
            role: 'user',
            parts: [{ text }]
          }
        ],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 8192,
        }
      })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error?.message || '번역 요청 실패')
    }

    const data = await response.json()

    // 응답 파싱
    if (!data.candidates || data.candidates.length === 0) {
      throw new Error('번역 결과를 받지 못했습니다.')
    }

    const translatedText = data.candidates[0].content.parts[0].text
    return translatedText
  }

  return { translatePrompt }
}
