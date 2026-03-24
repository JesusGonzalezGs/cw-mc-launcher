import React, { createContext, useContext, useState, useCallback } from 'react'

interface ExportContextValue {
  exportingIds: Set<string>
  startExport: (id: string) => void
  finishExport: (id: string) => void
  isImporting: boolean
  startImport: () => void
  finishImport: () => void
}

const ExportContext = createContext<ExportContextValue>({
  exportingIds: new Set(),
  startExport: () => {},
  finishExport: () => {},
  isImporting: false,
  startImport: () => {},
  finishImport: () => {},
})

export function ExportProvider({ children }: { children: React.ReactNode }) {
  const [exportingIds, setExportingIds] = useState<Set<string>>(new Set())
  const [isImporting, setIsImporting] = useState(false)

  const startExport = useCallback((id: string) => {
    setExportingIds(prev => new Set(prev).add(id))
  }, [])

  const finishExport = useCallback((id: string) => {
    setExportingIds(prev => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }, [])

  const startImport = useCallback(() => setIsImporting(true), [])
  const finishImport = useCallback(() => setIsImporting(false), [])

  return (
    <ExportContext.Provider value={{ exportingIds, startExport, finishExport, isImporting, startImport, finishImport }}>
      {children}
    </ExportContext.Provider>
  )
}

export function useExport() {
  return useContext(ExportContext)
}
