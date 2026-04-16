// 수집 세션 관리 슬라이스

import { StateCreator } from 'zustand'
import { CollectionSession, CollectionImage } from '../../types/collection'
import { devLog } from '../../lib/utils/logger'

export interface CollectionSlice {
  // 수집 세션 상태
  collectionSessions: CollectionSession[]
  currentCollectionId: string | null

  // 수집 세션 관리 메서드
  createCollectionSession: (gameName: string, folderPath: string) => string
  deleteCollectionSession: (id: string) => void
  loadCollectionSession: (id: string) => void
  updateCollectionSession: (id: string, updates: Partial<CollectionSession>) => void
  addCollectionImage: (sessionId: string, image: CollectionImage) => void
  updateCollectionImage: (sessionId: string, imageId: string, updates: Partial<CollectionImage>) => void
  updateCollectionStatus: (sessionId: string, status: CollectionSession['status'], error?: string) => void
  getCollectionSessions: () => CollectionSession[]
}

export const createCollectionSlice: StateCreator<
  CollectionSlice,
  [],
  [],
  CollectionSlice
> = (set, get) => ({
  // 초기 상태
  collectionSessions: [],
  currentCollectionId: null,

  // 수집 세션 생성
  createCollectionSession: (gameName: string, folderPath: string) => {
    const id = `collection-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    const newSession: CollectionSession = {
      id,
      gameName,
      folderPath,
      images: [],
      status: 'idle',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    devLog.log('🆕 수집 세션 생성:', gameName)

    set((state) => ({
      collectionSessions: [...state.collectionSessions, newSession],
      currentCollectionId: id,
    }))

    return id
  },

  // 수집 세션 삭제
  deleteCollectionSession: (id: string) => {
    set((state) => {
      const newSessions = state.collectionSessions.filter((s) => s.id !== id)
      const isCurrentSession = state.currentCollectionId === id

      if (!isCurrentSession) {
        return { collectionSessions: newSessions }
      }

      // 현재 세션 삭제 시 가장 최근 세션 선택
      const sorted = [...newSessions].sort((a, b) => b.updatedAt - a.updatedAt)
      return {
        collectionSessions: newSessions,
        currentCollectionId: sorted[0]?.id || null,
      }
    })
  },

  // 수집 세션 로드
  loadCollectionSession: (id: string) => {
    const session = get().collectionSessions.find((s) => s.id === id)
    if (session) {
      devLog.log('📂 수집 세션 로드:', session.gameName)
      set({ currentCollectionId: id })
    }
  },

  // 수집 세션 업데이트
  updateCollectionSession: (id: string, updates: Partial<CollectionSession>) => {
    set((state) => ({
      collectionSessions: state.collectionSessions.map((session) => {
        if (session.id === id) {
          return { ...session, ...updates, updatedAt: Date.now() }
        }
        return session
      }),
    }))
  },

  // 이미지 추가
  addCollectionImage: (sessionId: string, image: CollectionImage) => {
    set((state) => ({
      collectionSessions: state.collectionSessions.map((session) => {
        if (session.id === sessionId) {
          return {
            ...session,
            images: [...session.images, image],
            updatedAt: Date.now(),
          }
        }
        return session
      }),
    }))
  },

  // 이미지 상태 업데이트
  updateCollectionImage: (sessionId: string, imageId: string, updates: Partial<CollectionImage>) => {
    set((state) => ({
      collectionSessions: state.collectionSessions.map((session) => {
        if (session.id === sessionId) {
          return {
            ...session,
            images: session.images.map((img) => {
              if (img.id === imageId) {
                return { ...img, ...updates }
              }
              return img
            }),
            updatedAt: Date.now(),
          }
        }
        return session
      }),
    }))
  },

  // 수집 상태 업데이트
  updateCollectionStatus: (sessionId: string, status: CollectionSession['status'], error?: string) => {
    set((state) => ({
      collectionSessions: state.collectionSessions.map((session) => {
        if (session.id === sessionId) {
          return {
            ...session,
            status,
            error: error || session.error,
            updatedAt: Date.now(),
          }
        }
        return session
      }),
    }))
  },

  // 수집 세션 목록 조회
  getCollectionSessions: () => {
    return get().collectionSessions
  },
})
