// 게임 이미지 수집 시작을 위한 게임 제목 입력 모달

import { useState, useRef, useEffect } from 'react'
import { Search } from 'lucide-react'

interface GameTitleModalProps {
  isOpen: boolean
  onClose: () => void
  onStart: (gameName: string) => void
}

/**
 * 게임 제목 입력 모달
 * 수집할 게임명을 입력받아 수집 시작
 */
export function GameTitleModal({ isOpen, onClose, onStart }: GameTitleModalProps) {
  const [gameName, setGameName] = useState('')
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // 모달 열릴 때 입력 필드 초기화 및 포커스
  useEffect(() => {
    if (isOpen) {
      setGameName('')
      setError('')
      // 다음 틱에 포커스 (모달 렌더링 이후)
      setTimeout(() => {
        inputRef.current?.focus()
      }, 0)
    }
  }, [isOpen])

  // 모달이 닫혀있으면 렌더링 안 함
  if (!isOpen) return null

  const handleStart = () => {
    const trimmed = gameName.trim()
    if (!trimmed) {
      setError('게임 제목을 입력해주세요')
      inputRef.current?.focus()
      return
    }
    onStart(trimmed)
    onClose()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleStart()
    } else if (e.key === 'Escape') {
      onClose()
    }
  }

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={handleBackdropClick}
    >
      <div
        className="bg-background border border-border rounded-lg p-6 shadow-lg max-w-md w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center gap-2 mb-4">
          <Search className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold">게임 이미지 수집</h3>
        </div>

        <p className="text-muted-foreground text-sm mb-4">
          수집할 게임의 제목을 입력하세요. Gemini AI가 공식 이미지를 자동으로 검색하여 다운로드합니다.
        </p>

        {/* 게임 제목 입력 */}
        <input
          ref={inputRef}
          type="text"
          value={gameName}
          onChange={(e) => {
            setGameName(e.target.value)
            if (error) setError('')
          }}
          onKeyDown={handleKeyDown}
          placeholder="예: 엘든 링, Cyberpunk 2077"
          className={`w-full px-3 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary mb-1 ${
            error ? 'border-destructive' : 'border-border'
          }`}
        />

        {/* 유효성 오류 메시지 */}
        {error && (
          <p className="text-destructive text-xs mb-4">{error}</p>
        )}
        {!error && <div className="mb-4" />}

        {/* 버튼 영역 */}
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-muted hover:bg-accent transition-colors font-medium"
          >
            취소
          </button>
          <button
            onClick={handleStart}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium flex items-center gap-2"
          >
            <Search className="w-4 h-4" />
            수집 시작
          </button>
        </div>
      </div>
    </div>
  )
}
