// API 관련 상수

export const GEMINI_API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta'

export const GEMINI_MODELS = {
  FLASH: 'gemini-2.5-flash',
  FLASH_EXP: 'gemini-2.0-flash', // gemini-2.0-flash-exp → gemini-2.0-flash (Google Search Grounding 지원)
  PRO: 'gemini-2.0-pro',
} as const

export const GEMINI_GENERATION_CONFIG = {
  temperature: 0.7,
  topK: 40,
  topP: 0.95,
  maxOutputTokens: 32768, // Gemini 2.5 Flash 최대 출력 토큰 (8192 → 32768로 증가)
} as const

export const CHAT_HISTORY_LIMIT = 8 // 최근 대화 히스토리 개수 (비용 최적화를 위해 10 → 8로 축소)

