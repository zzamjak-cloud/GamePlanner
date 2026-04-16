import { Settings } from 'lucide-react'
import { getVersion } from '@tauri-apps/api/app'
import { useEffect, useState } from 'react'

interface HeaderProps {
  onSettingsClick: () => void
}

export function Header({ onSettingsClick }: HeaderProps) {
  const [version, setVersion] = useState<string>('')

  useEffect(() => {
    getVersion().then(setVersion).catch(() => setVersion('0.0.0'))
  }, [])

  return (
    <header className="h-14 border-b border-border bg-background px-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-bold">GamePlanner AI</h1>
        {version && (
          <span className="text-sm text-muted-foreground">v{version}</span>
        )}
      </div>
      <div className="flex gap-2">
        <button
          onClick={onSettingsClick}
          className="p-2 rounded-md hover:bg-accent transition-colors"
          title="설정"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>
    </header>
  )
}
