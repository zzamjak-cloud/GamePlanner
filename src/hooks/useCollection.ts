// 게임 이미지 수집 훅 - 수집 플로우 전체 관리

import { join } from '@tauri-apps/api/path'
import { revealItemInDir } from '@tauri-apps/plugin-opener'
import { useAppStore } from '../store/useAppStore'
import { findGameImages, downloadImage, ensureGameFolder } from '../lib/services/collectionService'
import { generateImageFileName } from '../lib/utils/collection'
import { devLog } from '../lib/utils/logger'
import type { CollectionImage } from '../types/collection'

/**
 * 게임 이미지 수집 훅
 * 폴더 생성 → URL 검색 → 이미지 다운로드 → 썸네일 생성 플로우 관리
 */
export function useCollection() {
  const {
    apiKey,
    createCollectionSession,
    addCollectionImage,
    updateCollectionImage,
    updateCollectionStatus,
    updateCollectionSession,
  } = useAppStore()

  /**
   * 게임 이미지 수집 시작
   * @param gameName 수집할 게임명
   */
  const startCollection = async (gameName: string) => {
    let sessionId = ''

    try {
      // 1. 게임 저장 폴더 생성
      devLog.log(`🚀 이미지 수집 시작: ${gameName}`)
      const folderPath = await ensureGameFolder(gameName)

      // 2. 수집 세션 생성 (스토어에 등록)
      sessionId = createCollectionSession(gameName, folderPath)

      // 3. 상태를 'searching'으로 변경
      updateCollectionStatus(sessionId, 'searching')

      // 4. Gemini Google Search Grounding으로 이미지 URL 검색
      if (!apiKey) {
        updateCollectionStatus(sessionId, 'failed', 'API Key가 설정되지 않았습니다')
        return
      }
      const urls = await findGameImages(apiKey, gameName)

      if (urls.length === 0) {
        devLog.warn(`⚠️ 이미지를 찾지 못함: ${gameName}`)
        updateCollectionStatus(sessionId, 'failed', '이미지 URL을 찾지 못했습니다')
        return
      }

      // 5. 상태를 'downloading'으로 변경, totalFound 설정
      updateCollectionSession(sessionId, {
        status: 'downloading',
        totalFound: urls.length,
      })

      devLog.log(`📋 다운로드 대상 URL: ${urls.length}개`)

      // 6. 각 URL에 대해 순차적으로 다운로드
      for (let i = 0; i < urls.length; i++) {
        const url = urls[i]
        const imageId = `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        const fileName = generateImageFileName(url, i)
        const filePath = await join(folderPath, fileName)

        // a. pending 이미지 추가 (UI 즉시 반영)
        const pendingImage: CollectionImage = {
          id: imageId,
          url,
          fileName,
          filePath,
          status: 'pending',
        }
        addCollectionImage(sessionId, pendingImage)

        // b. 다운로드 시작 (status: downloading)
        updateCollectionImage(sessionId, imageId, { status: 'downloading' })

        try {
          // c. 이미지 다운로드 (Content-Type/매직 바이트 기반 확장자 자동 교정)
          const { fileSize, actualPath } = await downloadImage(url, filePath)

          // d. 실제 저장 경로와 파일명 업데이트
          const actualFileName = actualPath.split(/[/\\]/).pop() || fileName

          // e. 완료 처리 (status: completed, 실제 경로로 업데이트)
          updateCollectionImage(sessionId, imageId, {
            status: 'completed',
            fileSize,
            filePath: actualPath,
            fileName: actualFileName,
            downloadedAt: Date.now(),
          })

          devLog.log(`✅ 이미지 완료 (${i + 1}/${urls.length}): ${fileName}`)
        } catch (downloadErr) {
          // f. 다운로드 실패 처리 (status: failed)
          const errorMsg = downloadErr instanceof Error ? downloadErr.message : '다운로드 실패'
          devLog.warn(`❌ 이미지 다운로드 실패 (${fileName}):`, errorMsg)

          updateCollectionImage(sessionId, imageId, {
            status: 'failed',
            error: errorMsg,
          })
        }

        // g. 다음 이미지 전 200ms 딜레이 (서버 부하 방지)
        if (i < urls.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 200))
        }
      }

      // 7. 전체 완료
      updateCollectionStatus(sessionId, 'completed')
      devLog.log(`🎉 수집 완료: ${gameName} (총 ${urls.length}개)`)
    } catch (error) {
      // 전체 플로우 에러 처리
      const errorMsg = error instanceof Error ? error.message : '알 수 없는 오류'
      devLog.error(`❌ 수집 실패 (${gameName}):`, errorMsg)

      if (sessionId) {
        updateCollectionStatus(sessionId, 'failed', errorMsg)
      }
    }
  }

  /**
   * 추가 탐색 - 기존 세션에 이미지를 더 수집
   * 기존 URL을 제외하고 다른 키워드로 검색
   * @param sessionId 수집 세션 ID
   */
  const continueCollection = async (sessionId: string) => {
    const state = useAppStore.getState()
    const session = state.collectionSessions.find(s => s.id === sessionId)
    if (!session) return

    if (!apiKey) {
      updateCollectionStatus(sessionId, 'failed', 'API Key가 설정되지 않았습니다')
      return
    }

    try {
      devLog.log(`🔄 추가 탐색 시작: ${session.gameName}`)

      // 기존 이미지 URL 목록 (중복 방지)
      const existingUrls = session.images.map(img => img.url)
      // 검색 오프셋 계산 (이전 탐색 횟수 기반)
      const queryOffset = Math.floor(session.images.length / 20) + 1

      updateCollectionStatus(sessionId, 'searching')

      const urls = await findGameImages(apiKey, session.gameName, existingUrls, queryOffset)

      if (urls.length === 0) {
        devLog.warn(`⚠️ 추가 이미지를 찾지 못함: ${session.gameName}`)
        updateCollectionStatus(sessionId, 'completed')
        return
      }

      updateCollectionSession(sessionId, {
        status: 'downloading',
        totalFound: (session.totalFound || 0) + urls.length,
      })

      devLog.log(`📋 추가 다운로드 대상: ${urls.length}개`)

      // 기존 이미지 수 기반으로 인덱스 시작
      const startIndex = session.images.length

      for (let i = 0; i < urls.length; i++) {
        const url = urls[i]
        const imageId = `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        const fileName = generateImageFileName(url, startIndex + i)
        const filePath = await join(session.folderPath, fileName)

        const pendingImage: CollectionImage = {
          id: imageId, url, fileName, filePath, status: 'pending',
        }
        addCollectionImage(sessionId, pendingImage)
        updateCollectionImage(sessionId, imageId, { status: 'downloading' })

        try {
          const { fileSize, actualPath } = await downloadImage(url, filePath)
          const actualFileName = actualPath.split(/[/\\]/).pop() || fileName

          updateCollectionImage(sessionId, imageId, {
            status: 'completed', fileSize, filePath: actualPath, fileName: actualFileName, downloadedAt: Date.now(),
          })
          devLog.log(`✅ 추가 이미지 (${i + 1}/${urls.length}): ${actualFileName}`)
        } catch (downloadErr) {
          const errorMsg = downloadErr instanceof Error ? downloadErr.message : '다운로드 실패'
          updateCollectionImage(sessionId, imageId, { status: 'failed', error: errorMsg })
        }

        if (i < urls.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 200))
        }
      }

      updateCollectionStatus(sessionId, 'completed')
      devLog.log(`🎉 추가 탐색 완료: ${session.gameName} (추가 ${urls.length}개)`)
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '알 수 없는 오류'
      devLog.error(`❌ 추가 탐색 실패:`, errorMsg)
      updateCollectionStatus(sessionId, 'failed', errorMsg)
    }
  }

  /**
   * 저장 폴더를 파일 탐색기에서 열기
   * @param folderPath 열 폴더 경로
   */
  const openFolder = async (folderPath: string) => {
    try {
      await revealItemInDir(folderPath)
      devLog.log(`📂 폴더 열기: ${folderPath}`)
    } catch (error) {
      devLog.error('폴더 열기 실패:', error)
    }
  }

  return {
    startCollection,
    continueCollection,
    openFolder,
  }
}
