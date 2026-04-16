// 게임 이미지 수집 패널 - 수집된 이미지 목록 표시 및 관리

import { FolderOpen, Download, Image, Loader2, CheckCircle2, XCircle, Clock } from 'lucide-react'
import { convertFileSrc } from '@tauri-apps/api/core'
import { useAppStore } from '../store/useAppStore'
import { useCollection } from '../hooks/useCollection'

/**
 * 파일 크기를 읽기 쉬운 형태로 변환
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * 이미지 상태 인디케이터 컴포넌트
 */
function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="w-4 h-4 text-green-500" />
    case 'failed':
      return <XCircle className="w-4 h-4 text-destructive" />
    case 'downloading':
      return <Loader2 className="w-4 h-4 text-primary animate-spin" />
    case 'pending':
    default:
      return <Clock className="w-4 h-4 text-muted-foreground" />
  }
}

/**
 * 스켈레톤 로딩 카드 컴포넌트
 */
function SkeletonCard() {
  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden animate-pulse">
      {/* 이미지 영역 스켈레톤 */}
      <div className="aspect-video bg-muted" />
      {/* 텍스트 영역 스켈레톤 */}
      <div className="p-2 space-y-1.5">
        <div className="h-3 bg-muted rounded w-3/4" />
        <div className="h-3 bg-muted rounded w-1/2" />
      </div>
    </div>
  )
}

/**
 * 게임 이미지 수집 패널
 * 사이드바 옆 전체 영역을 차지하며 수집된 이미지를 그리드로 표시
 */
export function CollectionPanel() {
  const { collectionSessions, currentCollectionId } = useAppStore()
  const { openFolder, continueCollection } = useCollection()

  // 현재 선택된 수집 세션
  const currentSession = currentCollectionId
    ? collectionSessions.find((s) => s.id === currentCollectionId)
    : null

  // 완료된 이미지 수 계산
  const completedCount = currentSession
    ? currentSession.images.filter((img) => img.status === 'completed').length
    : 0

  const totalCount = currentSession ? currentSession.images.length : 0
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  // 세션 미선택 상태
  if (!currentSession) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground bg-background">
        <Image className="w-16 h-16 mb-4 opacity-20" />
        <p className="text-base font-medium mb-1">수집된 이미지 없음</p>
        <p className="text-sm text-center max-w-xs">
          사이드바의 + 버튼을 클릭하여 게임 이미지 수집을 시작하세요
        </p>
      </div>
    )
  }

  // 검색/다운로드 중 상태 메시지
  const getStatusMessage = () => {
    switch (currentSession.status) {
      case 'searching':
        return (
          <div className="flex items-center gap-2 text-primary text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Gemini AI로 이미지 URL 검색 중...</span>
          </div>
        )
      case 'downloading':
        return (
          <div className="flex items-center gap-2 text-primary text-sm">
            <Download className="w-4 h-4" />
            <span>이미지 다운로드 중 ({completedCount}/{currentSession.totalFound ?? totalCount})</span>
          </div>
        )
      case 'completed':
        return (
          <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm">
            <CheckCircle2 className="w-4 h-4" />
            <span>수집 완료 — {completedCount}개 이미지 저장됨</span>
          </div>
        )
      case 'failed':
        return (
          <div className="flex items-center gap-2 text-destructive text-sm">
            <XCircle className="w-4 h-4" />
            <span>{currentSession.error ?? '수집 중 오류가 발생했습니다'}</span>
          </div>
        )
      default:
        return null
    }
  }

  return (
    <div className="flex-1 flex flex-col bg-background overflow-hidden">
      {/* 헤더 영역 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card flex-shrink-0">
        <div className="flex flex-col gap-0.5">
          <h2 className="font-semibold text-base">
            {currentSession.gameName} 스크린샷
          </h2>
          {getStatusMessage()}
        </div>

        <div className="flex items-center gap-2">
          {/* 추가 탐색 버튼 (완료 상태일 때만 표시) */}
          {currentSession.status === 'completed' && (
            <button
              onClick={() => continueCollection(currentSession.id)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-medium"
              title="다른 키워드로 20개 추가 검색"
            >
              <Download className="w-4 h-4" />
              <span>추가 탐색</span>
            </button>
          )}

          {/* 저장 폴더 바로가기 버튼 */}
          <button
            onClick={() => openFolder(currentSession.folderPath)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted hover:bg-accent transition-colors text-sm font-medium"
            title={`폴더 열기: ${currentSession.folderPath}`}
          >
            <FolderOpen className="w-4 h-4" />
            <span>폴더 열기</span>
          </button>
        </div>
      </div>

      {/* 진행 바 (다운로드 중일 때만 표시) */}
      {(currentSession.status === 'downloading' || currentSession.status === 'searching') && totalCount > 0 && (
        <div className="px-4 py-2 border-b border-border bg-card flex-shrink-0">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
            <span>진행률</span>
            <span>{completedCount} / {currentSession.totalFound ?? totalCount} 완료</span>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div
              className="bg-primary h-2 rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* 이미지 그리드 */}
      <div className="flex-1 overflow-y-auto p-4">
        {currentSession.status === 'searching' && totalCount === 0 ? (
          // 검색 중 빈 상태
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <Loader2 className="w-10 h-10 animate-spin mb-3 opacity-50" />
            <p className="text-sm">이미지 URL을 검색하고 있습니다...</p>
          </div>
        ) : totalCount === 0 ? (
          // 이미지 없음 상태
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <Image className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm">수집된 이미지가 없습니다</p>
          </div>
        ) : (
          // 이미지 그리드
          <div
            className="grid gap-3"
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}
          >
            {currentSession.images.map((image) => {
              const isLoading = image.status === 'pending' || image.status === 'downloading'

              if (isLoading) {
                return <SkeletonCard key={image.id} />
              }

              return (
                <div
                  key={image.id}
                  className="bg-card border border-border rounded-lg overflow-hidden hover:border-primary/50 transition-colors"
                >
                  {/* 이미지 프리뷰 */}
                  <div className="aspect-video bg-muted flex items-center justify-center overflow-hidden">
                    {image.status === 'completed' && image.filePath ? (
                      <img
                        src={convertFileSrc(image.filePath)}
                        alt={image.fileName}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-1 text-muted-foreground">
                        {image.status === 'failed' ? (
                          <XCircle className="w-8 h-8 text-destructive/50" />
                        ) : (
                          <Image className="w-8 h-8 opacity-30" />
                        )}
                      </div>
                    )}
                  </div>

                  {/* 이미지 정보 */}
                  <div className="p-2">
                    <div className="flex items-center gap-1 mb-0.5">
                      <StatusBadge status={image.status} />
                      <span
                        className="text-xs font-medium truncate flex-1"
                        title={image.fileName}
                      >
                        {image.fileName}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {image.status === 'completed' && image.fileSize ? (
                        formatFileSize(image.fileSize)
                      ) : image.status === 'failed' ? (
                        <span className="text-destructive">{image.error ?? '다운로드 실패'}</span>
                      ) : (
                        '처리 중...'
                      )}
                    </div>
                  </div>
                </div>
              )
            })}

            {/* 아직 발견되지 않은 이미지 슬롯 (검색된 총 수와 현재 이미지 수의 차이) */}
            {currentSession.status === 'downloading' &&
              currentSession.totalFound &&
              currentSession.totalFound > totalCount &&
              Array.from({ length: currentSession.totalFound - totalCount }).map((_, i) => (
                <SkeletonCard key={`skeleton-${i}`} />
              ))}
          </div>
        )}
      </div>
    </div>
  )
}
