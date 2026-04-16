// 설정 관리 슬라이스

import { StateCreator } from 'zustand'

export interface SettingsSlice {
  // 앱 설정 상태
  apiKey: string | null
  notionApiKey: string | null
  notionPlanningDatabaseId: string | null
  notionAnalysisDatabaseId: string | null
  isLoading: boolean

  // 설정 관리 메서드
  setApiKey: (key: string | null) => void
  setNotionApiKey: (key: string | null) => void
  setNotionPlanningDatabaseId: (id: string | null) => void
  setNotionAnalysisDatabaseId: (id: string | null) => void
  setIsLoading: (loading: boolean) => void
}

export const createSettingsSlice: StateCreator<
  SettingsSlice,
  [],
  [],
  SettingsSlice
> = (set) => ({
  // 초기 상태
  apiKey: null,
  notionApiKey: null,
  notionPlanningDatabaseId: null,
  notionAnalysisDatabaseId: null,
  isLoading: false,

  // API Key 설정
  setApiKey: (key) => set({ apiKey: key }),

  // Notion API Key 설정
  setNotionApiKey: (key) => set({ notionApiKey: key }),

  // Notion Database ID 설정 (기획서 DB)
  setNotionPlanningDatabaseId: (id) => set({ notionPlanningDatabaseId: id }),

  // Notion Database ID 설정 (분석 DB)
  setNotionAnalysisDatabaseId: (id) => set({ notionAnalysisDatabaseId: id }),

  // 로딩 상태
  setIsLoading: (loading) => set({ isLoading: loading }),
})

