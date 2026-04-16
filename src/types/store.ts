// Store 관련 타입 정의

import { ChatSession } from '../store/useAppStore'
import { PromptTemplate } from './promptTemplate'
import { CollectionSession } from './collection'

export interface WindowState {
  x: number
  y: number
  width: number
  height: number
  maximized: boolean
}

export interface Settings {
  geminiApiKey?: string | null
  notionApiKey?: string | null
  notionPlanningDatabaseId?: string | null
  notionAnalysisDatabaseId?: string | null
  oldNotionDbId?: string | null
  chatSessions?: ChatSession[]
  promptTemplates?: PromptTemplate[]
  currentPlanningTemplateId?: string | null
  currentAnalysisTemplateId?: string | null
  windowState?: WindowState
  collectionSessions?: CollectionSession[]
}

export interface SaveSettingsParams {
  geminiApiKey?: string
  notionApiKey?: string
  notionPlanningDatabaseId?: string
  notionAnalysisDatabaseId?: string
}

