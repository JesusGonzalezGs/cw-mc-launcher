import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import type { InstallProgress } from '../types'

export interface InstallingItem {
  id: string
  name: string
  fileId?: number
  source?: 'cf' | 'mr'
}

interface InstallContextValue {
  installing: InstallingItem[]
  progress: InstallProgress | null
  startInstall: (id: string, name: string, fileId?: number, source?: 'cf' | 'mr') => void
  finishInstall: (id: string) => void
}

const InstallContext = createContext<InstallContextValue>({
  installing: [],
  progress: null,
  startInstall: () => {},
  finishInstall: () => {},
})

export function InstallProvider({ children }: { children: React.ReactNode }) {
  const [installing, setInstalling] = useState<InstallingItem[]>([])
  const [progress, setProgress] = useState<InstallProgress | null>(null)

  useEffect(() => {
    const handleProgress = (p: InstallProgress) => setProgress(p)
    window.launcher.on('cf:installProgress', handleProgress)
    window.launcher.on('mr:installModpack:progress', handleProgress)
    return () => {
      window.launcher.off('cf:installProgress', handleProgress)
      window.launcher.off('mr:installModpack:progress', handleProgress)
    }
  }, [])

  const startInstall = useCallback((id: string, name: string, fileId?: number, source: 'cf' | 'mr' = 'cf') => {
    setInstalling((prev) => [...prev, { id, name, fileId, source }])
    setProgress(null)
  }, [])

  const finishInstall = useCallback((id: string) => {
    setInstalling((prev) => prev.filter((item) => item.id !== id))
  }, [])

  return (
    <InstallContext.Provider value={{ installing, progress, startInstall, finishInstall }}>
      {children}
    </InstallContext.Provider>
  )
}

export const useInstall = () => useContext(InstallContext)
