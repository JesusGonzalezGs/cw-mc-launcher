import React, { createContext, useContext, useState, useCallback } from 'react'

export interface InstallingItem {
  id: string
  name: string
}

interface InstallContextValue {
  installing: InstallingItem[]
  startInstall: (id: string, name: string) => void
  finishInstall: (id: string) => void
}

const InstallContext = createContext<InstallContextValue>({
  installing: [],
  startInstall: () => {},
  finishInstall: () => {},
})

export function InstallProvider({ children }: { children: React.ReactNode }) {
  const [installing, setInstalling] = useState<InstallingItem[]>([])

  const startInstall = useCallback((id: string, name: string) => {
    setInstalling((prev) => [...prev, { id, name }])
  }, [])

  const finishInstall = useCallback((id: string) => {
    setInstalling((prev) => prev.filter((item) => item.id !== id))
  }, [])

  return (
    <InstallContext.Provider value={{ installing, startInstall, finishInstall }}>
      {children}
    </InstallContext.Provider>
  )
}

export const useInstall = () => useContext(InstallContext)
