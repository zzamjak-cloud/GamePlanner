// 마이그레이션 관리자

import { ChatSession } from '../../store/useAppStore'
import { Settings } from '../../types/store'
import { migrateV1 } from './v1'
import { migrateV2 } from './v2'
import { migrateV3 } from './v3'
import { devLog } from '../utils/logger'

export interface MigrationResult {
  success: boolean
  version: string
  migrated: boolean
  error?: Error
}

/**
 * 세션 마이그레이션
 */
export function migrateSessions(sessions: unknown[]): ChatSession[] {
  if (!Array.isArray(sessions)) {
    console.warn('⚠️ 세션이 배열이 아닙니다:', typeof sessions)
    return []
  }

  if (sessions.length === 0) {
    devLog.log('📦 저장된 세션 없음')
    return []
  }

  devLog.log(`🔄 세션 마이그레이션 시작: ${sessions.length}개`)

  try {
    let migrated = sessions as ChatSession[]

    // V1: 세션 타입 추가
    migrated = migrateV1(migrated)
    devLog.log('✅ V1 마이그레이션 완료')

    // V2: 템플릿 시스템 추가
    migrated = migrateV2(migrated)
    devLog.log('✅ V2 마이그레이션 완료')

    // V3: 참조 파일 필드 추가
    migrated = migrateV3(migrated)
    devLog.log('✅ V3 마이그레이션 완료')

    devLog.log(`✅ 세션 마이그레이션 완료: ${migrated.length}개`)
    return migrated
  } catch (error) {
    console.error('❌ 세션 마이그레이션 실패:', error)
    // 마이그레이션 실패 시에도 기존 데이터 반환 시도
    return sessions as ChatSession[]
  }
}

/**
 * 설정 마이그레이션
 */
export function migrateSettings(settings: Settings): Settings {
  // Planning DB ID 마이그레이션 (기존 notion_database_id → notion_planning_database_id)
  if (!settings.notionPlanningDatabaseId && settings.oldNotionDbId) {
    return {
      ...settings,
      notionPlanningDatabaseId: settings.oldNotionDbId,
    }
  }

  return settings
}

/**
 * 전체 데이터 마이그레이션
 */
export function migrateData(data: {
  sessions?: unknown[]
  settings?: Settings
}): {
  sessions: ChatSession[]
  settings: Settings
} {
  const sessions = data.sessions ? migrateSessions(data.sessions) : []
  const settings = data.settings ? migrateSettings(data.settings) : data.settings || {}

  return {
    sessions,
    settings: settings as Settings,
  }
}

