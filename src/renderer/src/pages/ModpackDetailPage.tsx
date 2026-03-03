import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Download, Loader2, AlertCircle, Check } from 'lucide-react'
import ProgressBar from '../components/ProgressBar'
import type { CfMod, CfFile, InstallProgress } from '../types'

export default function ModpackDetailPage() {
  const { modpackId } = useParams<{ modpackId: string }>()
  const navigate = useNavigate()
  const [mod, setMod] = useState<CfMod | null>(null)
  const [description, setDescription] = useState('')
  const [files, setFiles] = useState<CfFile[]>([])
  const [selectedFileId, setSelectedFileId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [installing, setInstalling] = useState(false)
  const [progress, setProgress] = useState<InstallProgress | null>(null)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!modpackId) return
    const id = parseInt(modpackId)
    Promise.all([
      window.launcher.cf.getMod(id),
      window.launcher.cf.getModDescription(id),
      window.launcher.cf.getModFiles(id),
    ]).then(([modResp, desc, filesResp]) => {
      setMod(modResp?.data ?? null)
      setDescription(desc ?? '')
      const fileList: CfFile[] = filesResp?.data ?? []
      setFiles(fileList)
      if (fileList.length > 0) setSelectedFileId(fileList[0].id)
    }).catch((e) => setError(e.message)).finally(() => setLoading(false))
  }, [modpackId])

  useEffect(() => {
    const handleProgress = (p: InstallProgress) => setProgress(p)
    window.launcher.on('cf:installProgress', handleProgress)
    return () => window.launcher.off('cf:installProgress', handleProgress)
  }, [])

  async function handleInstall() {
    if (!mod || !selectedFileId) return
    setInstalling(true)
    setError('')
    setDone(false)
    try {
      const instance = await window.launcher.cf.installModpack(
        mod.id,
        selectedFileId,
        mod.name,
        mod.logo?.url
      )
      setDone(true)
      setTimeout(() => navigate('/instances'), 2000)
    } catch (e: any) {
      setError(e.message ?? 'Error al instalar el modpack')
      setInstalling(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="text-purple-400 animate-spin" />
      </div>
    )
  }

  if (!mod) {
    return (
      <div className="p-6">
        <button onClick={() => navigate('/catalog')} className="flex items-center gap-2 text-gray-500 hover:text-gray-300 text-sm mb-4 transition-colors">
          <ArrowLeft size={16} />
          Volver al catálogo
        </button>
        <p className="text-gray-500">Modpack no encontrado</p>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <button
        onClick={() => navigate('/catalog')}
        className="flex items-center gap-2 text-gray-500 hover:text-gray-300 text-sm mb-6 transition-colors"
      >
        <ArrowLeft size={16} />
        Volver al catálogo
      </button>

      {/* Header */}
      <div className="flex gap-4 mb-6">
        {mod.logo?.url && (
          <img
            src={mod.logo.url}
            alt={mod.name}
            className="w-20 h-20 rounded-xl object-cover border border-gray-700"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
          />
        )}
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-white">{mod.name}</h1>
          <p className="text-gray-400 text-sm mt-1 line-clamp-2">{mod.summary}</p>
          <p className="text-gray-600 text-xs mt-1">{(mod.downloadCount / 1000000).toFixed(1)}M descargas</p>
        </div>
      </div>

      {/* File selector */}
      {files.length > 0 && (
        <div className="mb-4">
          <label className="block text-sm text-gray-400 mb-1.5">Versión del modpack</label>
          <select
            value={selectedFileId ?? ''}
            onChange={(e) => setSelectedFileId(parseInt(e.target.value))}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-purple-500 transition-colors"
          >
            {files.map((f) => (
              <option key={f.id} value={f.id}>
                {f.displayName || f.fileName} — {f.gameVersions.join(', ')}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Install button */}
      {!installing && !done && (
        <button
          onClick={handleInstall}
          disabled={!selectedFileId}
          className="w-full flex items-center justify-center gap-2 py-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-xl font-medium transition-colors mb-4"
        >
          <Download size={16} />
          Instalar modpack
        </button>
      )}

      {installing && progress && !done && (
        <div className="mb-4 space-y-3">
          <ProgressBar percent={progress.percent} label={progress.stage} />
        </div>
      )}

      {done && (
        <div className="flex items-center gap-2 p-3 mb-4 bg-green-500/10 border border-green-500/20 rounded-xl">
          <Check size={16} className="text-green-400" />
          <p className="text-green-400 text-sm">¡Instalado! Redirigiendo a instancias...</p>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-3 mb-4 bg-red-500/10 border border-red-500/20 rounded-xl">
          <AlertCircle size={15} className="text-red-400 shrink-0" />
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Description */}
      {description && (
        <div
          className="prose prose-invert prose-sm max-w-none bg-gray-800/50 border border-gray-700 rounded-xl p-4 text-gray-300 [&_img]:max-w-full [&_a]:text-purple-400"
          dangerouslySetInnerHTML={{ __html: description }}
        />
      )}
    </div>
  )
}
