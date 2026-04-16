import { useState, useEffect } from 'react'
import { X, LogOut } from 'lucide-react'
import { useAppStore } from '../store/useAppStore'
import { saveSettings } from '../lib/store'
import { devLog } from '../lib/utils/logger'
import { useAuth } from '../hooks/useAuth'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [notionApiKeyInput, setNotionApiKeyInput] = useState('')
  const [notionPlanningDatabaseIdInput, setNotionPlanningDatabaseIdInput] = useState('')
  const [notionAnalysisDatabaseIdInput, setNotionAnalysisDatabaseIdInput] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const {
    apiKey,
    notionApiKey,
    notionPlanningDatabaseId,
    notionAnalysisDatabaseId,
    setApiKey,
    setNotionApiKey,
    setNotionPlanningDatabaseId,
    setNotionAnalysisDatabaseId,
  } = useAppStore()
  const { user, logout } = useAuth()

  // 로그아웃 처리
  const handleLogout = async () => {
    setIsLoggingOut(true)
    try {
      console.log('[Settings] 로그아웃 시작')
      await logout()
      console.log('[Settings] 로그아웃 완료')
      // 강제로 페이지 새로고침하여 로그인 화면으로 전환
      window.location.reload()
    } catch (error) {
      console.error('[Settings] 로그아웃 실패:', error)
      alert('로그아웃에 실패했습니다.')
      setIsLoggingOut(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      if (apiKey) setApiKeyInput(apiKey)
      if (notionApiKey) setNotionApiKeyInput(notionApiKey)
      if (notionPlanningDatabaseId) setNotionPlanningDatabaseIdInput(notionPlanningDatabaseId)
      if (notionAnalysisDatabaseId) setNotionAnalysisDatabaseIdInput(notionAnalysisDatabaseId)
    }
  }, [isOpen, apiKey, notionApiKey, notionPlanningDatabaseId, notionAnalysisDatabaseId])

  const handleSave = async () => {
    if (!apiKeyInput.trim()) {
      alert('Gemini API Key를 입력해주세요')
      return
    }

    setIsSaving(true)
    try {
      // 전역 Store를 통해 설정 저장
      await saveSettings({
        geminiApiKey: apiKeyInput.trim(),
        notionApiKey: notionApiKeyInput.trim() || undefined,
        notionPlanningDatabaseId: notionPlanningDatabaseIdInput.trim() || undefined,
        notionAnalysisDatabaseId: notionAnalysisDatabaseIdInput.trim() || undefined,
      })

      // Zustand 스토어 업데이트
      setApiKey(apiKeyInput.trim())
      if (notionApiKeyInput.trim()) {
        setNotionApiKey(notionApiKeyInput.trim())
      }
      if (notionPlanningDatabaseIdInput.trim()) {
        setNotionPlanningDatabaseId(notionPlanningDatabaseIdInput.trim())
      }
      if (notionAnalysisDatabaseIdInput.trim()) {
        setNotionAnalysisDatabaseId(notionAnalysisDatabaseIdInput.trim())
      }

      devLog.log('✅ 설정 저장 완료')
      alert('설정이 저장되었습니다')
      onClose()
    } catch (error) {
      console.error('❌ 설정 저장 실패:', error)
      alert('설정 저장에 실패했습니다')
    } finally {
      setIsSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background rounded-lg shadow-lg w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">설정</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-accent transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Gemini API Key */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Google Gemini API Key <span className="text-destructive">*</span>
            </label>
            <input
              type="password"
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              placeholder="AIza..."
              className="w-full px-3 py-2 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <p className="text-xs text-muted-foreground mt-1">
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Google AI Studio
              </a>
              에서 무료 발급
            </p>
          </div>

          {/* Divider */}
          <div className="border-t border-border"></div>

          {/* Notion API Key */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Notion API Key (선택)
            </label>
            <input
              type="password"
              value={notionApiKeyInput}
              onChange={(e) => setNotionApiKeyInput(e.target.value)}
              placeholder="ntn_..."
              className="w-full px-3 py-2 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <p className="text-xs text-muted-foreground mt-1">
              노션 저장 기능 사용 시 필요
            </p>
          </div>

          {/* Notion Planning Database ID */}
          <div>
            <label className="block text-sm font-medium mb-2">
              기획서 Notion Database ID (선택)
            </label>
            <input
              type="text"
              value={notionPlanningDatabaseIdInput}
              onChange={(e) => setNotionPlanningDatabaseIdInput(e.target.value)}
              placeholder="2d7d040b425c8028a1a9f489c2e0657e"
              className="w-full px-3 py-2 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <p className="text-xs text-muted-foreground mt-1">
              게임 기획서를 저장할 Notion 데이터베이스 ID
            </p>
          </div>

          {/* Notion Analysis Database ID */}
          <div>
            <label className="block text-sm font-medium mb-2">
              분석 Notion Database ID (선택)
            </label>
            <input
              type="text"
              value={notionAnalysisDatabaseIdInput}
              onChange={(e) => setNotionAnalysisDatabaseIdInput(e.target.value)}
              placeholder="3e8e151c536d9139b2b0e598d3f1768f"
              className="w-full px-3 py-2 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <p className="text-xs text-muted-foreground mt-1">
              게임 분석 결과를 저장할 Notion 데이터베이스 ID
            </p>
          </div>

          {/* Divider */}
          <div className="border-t border-border"></div>

          {/* 계정 정보 및 로그아웃 */}
          <div>
            <label className="block text-sm font-medium mb-2">
              로그인 계정
            </label>
            <div className="flex items-center justify-between p-3 rounded-md border border-input bg-muted/30">
              <div className="flex items-center gap-3">
                {user?.picture && (
                  <img
                    src={user.picture}
                    alt={user.name}
                    className="w-8 h-8 rounded-full"
                  />
                )}
                <div>
                  <p className="text-sm font-medium">{user?.name || '알 수 없음'}</p>
                  <p className="text-xs text-muted-foreground">{user?.email || ''}</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10 rounded-md transition-colors disabled:opacity-50"
              >
                <LogOut className="w-4 h-4" />
                {isLoggingOut ? '로그아웃 중...' : '로그아웃'}
              </button>
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-md hover:bg-accent transition-colors"
            >
              취소
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {isSaving ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
