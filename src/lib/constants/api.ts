// API 관련 상수

export const GEMINI_API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta'

export const GEMINI_MODELS = {
  FLASH: 'gemini-3.7-flash',
  // Google Search Grounding 지원 모델
  FLASH_WITH_SEARCH: 'gemini-3.7-flash',
  PRO: 'gemini-3.1-pro-preview',
} as const

export type GeminiModel = (typeof GEMINI_MODELS)[keyof typeof GEMINI_MODELS]

export const DEFAULT_CHAT_MODEL: GeminiModel = GEMINI_MODELS.FLASH

// 설정 화면에서 사용자가 선택 가능한 모델 목록
export const SELECTABLE_MODELS: Array<{ value: GeminiModel; label: string; description: string }> = [
  { value: GEMINI_MODELS.FLASH, label: 'Gemini 3.7 Flash', description: '최신 Stable Flash, 복잡한 기획 작업에 권장' },
  { value: GEMINI_MODELS.PRO, label: 'Gemini 3.1 Pro', description: '심층 추론·장문 분석용 (느리고 비쌈)' },
]

const LEGACY_CHAT_MODEL_MIGRATIONS: Record<string, GeminiModel> = {
  'gemini-3.6-flash': GEMINI_MODELS.FLASH,
  'gemini-3.1-pro': GEMINI_MODELS.PRO,
  'gemini-2.5-pro': GEMINI_MODELS.PRO,
}

const SELECTABLE_MODEL_VALUES = new Set<string>(SELECTABLE_MODELS.map((model) => model.value))

export function normalizeChatModel(model: string | null | undefined): GeminiModel {
  if (!model) return DEFAULT_CHAT_MODEL
  if (LEGACY_CHAT_MODEL_MIGRATIONS[model]) return LEGACY_CHAT_MODEL_MIGRATIONS[model]
  if (SELECTABLE_MODEL_VALUES.has(model)) return model as GeminiModel
  return DEFAULT_CHAT_MODEL
}

export const GEMINI_GENERATION_CONFIG = {
  temperature: 0.7,
  topK: 40,
  topP: 0.95,
  maxOutputTokens: 65536, // Gemini 3.7 Flash/3.1 Pro Preview 최대 출력 토큰
} as const

export const CHAT_HISTORY_LIMIT = 8 // 최근 대화 히스토리 개수 (비용 최적화를 위해 10 → 8로 축소)
