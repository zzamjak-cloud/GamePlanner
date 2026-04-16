// 수집 기능 관련 유틸리티 함수

/**
 * 게임명을 폴더명으로 안전하게 변환
 * 한글은 유지하고, 파일 시스템에서 허용되지 않는 특수문자만 제거
 */
export function sanitizeGameName(gameName: string): string {
  return gameName
    // 파일 시스템에서 사용 불가한 문자 제거: \ / : * ? " < > |
    .replace(/[\\/:*?"<>|]/g, '')
    // 앞뒤 공백 제거
    .trim()
    // 연속 공백을 하나로 치환
    .replace(/\s+/g, ' ')
    // 빈 값이면 기본값 사용
    || 'Unknown_Game'
}

/**
 * URL에서 고유 파일명 생성
 * 중복 방지를 위해 인덱스 포함
 */
export function generateImageFileName(url: string, index: number): string {
  try {
    const urlObj = new URL(url)
    // URL 경로의 마지막 세그먼트에서 파일명 추출
    const pathSegments = urlObj.pathname.split('/').filter(Boolean)
    const lastSegment = pathSegments[pathSegments.length - 1] || 'image'

    // 파일명에서 확장자 분리
    const dotIndex = lastSegment.lastIndexOf('.')
    let baseName = dotIndex > 0 ? lastSegment.substring(0, dotIndex) : lastSegment
    const ext = dotIndex > 0 ? lastSegment.substring(dotIndex) : '.jpg'

    // 파일 시스템에서 허용되지 않는 문자 제거
    baseName = baseName.replace(/[\\/:*?"<>|]/g, '').substring(0, 40)
    if (!baseName) baseName = 'image'

    // 인덱스를 포함한 고유 파일명 반환
    return `${String(index + 1).padStart(3, '0')}_${baseName}${ext}`
  } catch {
    // URL 파싱 실패 시 기본 파일명 사용
    return `${String(index + 1).padStart(3, '0')}_image.jpg`
  }
}

/**
 * Canvas API로 base64 썸네일 생성
 * 최대 300x300 크기로 리사이즈
 */
export async function createThumbnail(imageData: Uint8Array, mimeType: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const MAX_SIZE = 300

    // Blob 생성 후 ObjectURL 변환
    const blob = new Blob([imageData], { type: mimeType })
    const objectUrl = URL.createObjectURL(blob)

    const img = new Image()

    img.onload = () => {
      // ObjectURL 해제
      URL.revokeObjectURL(objectUrl)

      // 원본 비율을 유지하며 최대 크기 계산
      let { width, height } = img
      if (width > MAX_SIZE || height > MAX_SIZE) {
        if (width > height) {
          height = Math.round((height * MAX_SIZE) / width)
          width = MAX_SIZE
        } else {
          width = Math.round((width * MAX_SIZE) / height)
          height = MAX_SIZE
        }
      }

      // Canvas에 그리기
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')

      if (!ctx) {
        reject(new Error('Canvas 컨텍스트 생성 실패'))
        return
      }

      ctx.drawImage(img, 0, 0, width, height)

      // base64 데이터 URL로 변환 (JPEG 품질 0.8)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
      resolve(dataUrl)
    }

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('이미지 로드 실패'))
    }

    img.src = objectUrl
  })
}
