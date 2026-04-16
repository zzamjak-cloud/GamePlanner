// 수집 세션 관련 타입 정의

export interface CollectionImage {
  id: string
  url: string                    // 소스 URL
  fileName: string               // 저장된 파일명
  filePath: string               // 절대 로컬 경로
  thumbnailData?: string         // base64 썸네일 (메모리만, 저장 안 함)
  status: 'pending' | 'downloading' | 'completed' | 'failed'
  error?: string
  fileSize?: number              // 바이트
  downloadedAt?: number
}

export interface CollectionSession {
  id: string
  gameName: string
  folderPath: string             // Download/Game_Screenshot/{gameName}/
  images: CollectionImage[]
  status: 'idle' | 'searching' | 'downloading' | 'completed' | 'failed'
  createdAt: number
  updatedAt: number
  totalFound?: number            // Gemini가 찾은 전체 이미지 수
  error?: string
}
