// 저장소 서비스 인터페이스 및 구현

import { ChatSession } from '../../store/useAppStore'
import { PromptTemplate } from '../../types/promptTemplate'
import { Settings } from '../../types/store'
import { getStore, saveStore } from '../store'
import { devLog } from '../utils/logger'

export interface IStorageService {
  getSettings(): Promise<Settings>
  saveSettings(settings: Partial<Settings>): Promise<void>
  saveSessions(sessions: ChatSession[]): Promise<void>
  saveTemplates(templates: PromptTemplate[]): Promise<void>
}

/**
 * Tauri Store 기반 저장소 서비스 구현
 * 기존 store.ts의 Store 인스턴스를 공유하여 사용
 */
export class TauriStorageService implements IStorageService {

  async getSettings(): Promise<Settings> {
    const store = await getStore()

    const geminiApiKey = await store.get<string>('gemini_api_key')
    const notionApiKey = await store.get<string>('notion_api_key')
    const notionPlanningDatabaseId = await store.get<string>('notion_planning_database_id')
    const notionAnalysisDatabaseId = await store.get<string>('notion_analysis_database_id')
    const chatSessions = await store.get<ChatSession[]>('chat_sessions')
    const oldNotionDbId = await store.get<string>('notion_database_id')
    const promptTemplates = await store.get<PromptTemplate[]>('prompt_templates')
    const currentPlanningTemplateId = await store.get<string>('current_planning_template_id')
    const currentAnalysisTemplateId = await store.get<string>('current_analysis_template_id')

    return {
      geminiApiKey,
      notionApiKey,
      notionPlanningDatabaseId,
      notionAnalysisDatabaseId,
      oldNotionDbId,
      chatSessions,
      promptTemplates,
      currentPlanningTemplateId,
      currentAnalysisTemplateId,
    }
  }

  async saveSettings(settings: Partial<Settings>): Promise<void> {
    const store = await getStore()

    if (settings.geminiApiKey !== undefined) {
      await store.set('gemini_api_key', settings.geminiApiKey)
    }
    if (settings.notionApiKey !== undefined) {
      await store.set('notion_api_key', settings.notionApiKey)
    }
    if (settings.notionPlanningDatabaseId !== undefined) {
      await store.set('notion_planning_database_id', settings.notionPlanningDatabaseId)
    }
    if (settings.notionAnalysisDatabaseId !== undefined) {
      await store.set('notion_analysis_database_id', settings.notionAnalysisDatabaseId)
    }

    await saveStore()
  }

  async saveSessions(sessions: ChatSession[]): Promise<void> {
    const store = await getStore()
    const currentSettings = await this.getSettings()

    await store.set('chat_sessions', sessions)

    // 기존 API 키 설정 보존
    if (currentSettings.geminiApiKey) {
      await store.set('gemini_api_key', currentSettings.geminiApiKey)
    }
    if (currentSettings.notionApiKey) {
      await store.set('notion_api_key', currentSettings.notionApiKey)
    }
    if (currentSettings.notionPlanningDatabaseId) {
      await store.set('notion_planning_database_id', currentSettings.notionPlanningDatabaseId)
    }
    if (currentSettings.notionAnalysisDatabaseId) {
      await store.set('notion_analysis_database_id', currentSettings.notionAnalysisDatabaseId)
    }

    await saveStore()

    // 저장 후 검증
    const verifySettings = await this.getSettings()
    if (!verifySettings.geminiApiKey && currentSettings.geminiApiKey) {
      console.error('⚠️ 경고: API 키가 손실됨! 복구 시도 중...')
      await store.set('gemini_api_key', currentSettings.geminiApiKey)
      await saveStore()
    }
  }

  async saveTemplates(templates: PromptTemplate[]): Promise<void> {
    const store = await getStore()
    await store.set('prompt_templates', templates)
    await saveStore()
    devLog.log('💾 템플릿 저장:', templates.length, '개')
  }
}

// 싱글톤 인스턴스
export const storageService = new TauriStorageService()

