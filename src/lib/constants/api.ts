// API 관련 상수 (OpenRouter 통합 키 기반)

export const OPENROUTER_API_BASE_URL = 'https://openrouter.ai/api/v1'

// OpenRouter 모델 슬러그 (provider/model 형식)
export const OPENROUTER_MODELS = {
  FLASH: 'google/gemini-3.8-flash',
  PRO: 'google/gemini-3.1-pro-preview',
} as const

export type ChatModel = (typeof OPENROUTER_MODELS)[keyof typeof OPENROUTER_MODELS]

export const DEFAULT_CHAT_MODEL: ChatModel = OPENROUTER_MODELS.FLASH

// 설정 화면에서 사용자가 선택 가능한 모델 목록
export const SELECTABLE_MODELS: Array<{ value: ChatModel; label: string; description: string }> = [
  { value: OPENROUTER_MODELS.FLASH, label: 'Gemini 3.8 Flash', description: '최신 Stable Flash, 복잡한 기획 작업에 권장' },
  { value: OPENROUTER_MODELS.PRO, label: 'Gemini 3.1 Pro', description: '심층 추론·장문 분석용 (느리고 비쌈)' },
]

// Gemini API 직접 호출 시절 저장된 모델명 → OpenRouter 슬러그 마이그레이션
const LEGACY_CHAT_MODEL_MIGRATIONS: Record<string, ChatModel> = {
  'google/gemini-3.7-flash': OPENROUTER_MODELS.FLASH,
  'google/gemini-3.6-flash': OPENROUTER_MODELS.FLASH,
  'gemini-3.8-flash': OPENROUTER_MODELS.FLASH,
  'gemini-3.7-flash': OPENROUTER_MODELS.FLASH,
  'gemini-3.6-flash': OPENROUTER_MODELS.FLASH,
  'gemini-3.1-pro-preview': OPENROUTER_MODELS.PRO,
  'gemini-3.1-pro': OPENROUTER_MODELS.PRO,
  'gemini-2.5-pro': OPENROUTER_MODELS.PRO,
}

const SELECTABLE_MODEL_VALUES = new Set<string>(SELECTABLE_MODELS.map((model) => model.value))

export function normalizeChatModel(model: string | null | undefined): ChatModel {
  if (!model) return DEFAULT_CHAT_MODEL
  if (LEGACY_CHAT_MODEL_MIGRATIONS[model]) return LEGACY_CHAT_MODEL_MIGRATIONS[model]
  if (SELECTABLE_MODEL_VALUES.has(model)) return model as ChatModel
  return DEFAULT_CHAT_MODEL
}

// OpenAI 호환 생성 파라미터 (OpenRouter가 지원 가능한 provider로 전달)
export const GENERATION_CONFIG = {
  temperature: 0.7,
  top_k: 40,
  top_p: 0.95,
  max_tokens: 65536, // Gemini 3.8 Flash/3.1 Pro Preview 최대 출력 토큰
} as const

export const CHAT_HISTORY_LIMIT = 8 // 최근 대화 히스토리 개수 (비용 최적화를 위해 10 → 8로 축소)
