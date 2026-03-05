import { useState, useRef, useEffect } from 'react'
import { X, Database, Download, RefreshCw, CheckCircle, AlertCircle, Search } from 'lucide-react'
import type { Instance } from '../types'
import knownLoaders from '../data/datapackLoaders.json'

const LOADER_NUM: Record<string, number> = { forge: 1, fabric: 4, quilt: 5, neoforge: 6 }

function mcVersionGte(version: string, min: string): boolean {
  const a = version.split('.').map(Number)
  const b = min.split('.').map(Number)
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const av = a[i] ?? 0
    const bv = b[i] ?? 0
    if (av !== bv) return av > bv
  }
  return true
}

interface Props {
  instance: Instance
  onClose: (ignore: boolean) => void
  onInstalled: () => void
}

export default function DatapackLoaderModal({ instance, onClose, onInstalled }: Props) {
  const [search, setSearch] = useState('')
  const [installing, setInstalling] = useState<string | null>(null)
  const [installed, setInstalled] = useState<Set<string>>(new Set())
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [logos, setLogos] = useState<Record<string, string>>({})
  const [confirmIgnore, setConfirmIgnore] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const compatible = knownLoaders.filter(l =>
    l.loaders.includes(instance.modLoader) &&
    mcVersionGte(instance.mcVersion, l.minMcVersion)
  )

  const filtered = search.trim()
    ? compatible.filter(l =>
        l.name.toLowerCase().includes(search.toLowerCase()) ||
        l.description.toLowerCase().includes(search.toLowerCase())
      )
    : compatible

  // Cargar iconos desde CF usando el ID directo
  useEffect(() => {
    for (const entry of compatible) {
      if (!entry.curseforgeId) continue
      window.launcher.cf.getMod(entry.curseforgeId)
        .then((res: any) => {
          const logo = res?.data?.logo?.thumbnailUrl
          if (logo) setLogos(prev => ({ ...prev, [entry.slug]: logo }))
        })
        .catch(() => {})
    }
  }, [instance.mcVersion, instance.modLoader])

  function handleSearchChange(value: string) {
    setSearch(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
  }

  async function handleInstall(entry: typeof knownLoaders[number]) {
    setInstalling(entry.slug)
    setErrors(prev => { const n = { ...prev }; delete n[entry.slug]; return n })
    try {
      const loaderNum = LOADER_NUM[instance.modLoader]
      if (!entry.curseforgeId) throw new Error('ID de CurseForge no definido')
      const filesRes: any = await window.launcher.cf.getModFiles(entry.curseforgeId, instance.mcVersion, loaderNum)
      const files: any[] = filesRes?.data ?? []
      if (files.length === 0) throw new Error('No hay archivos compatibles para esta versión')
      await window.launcher.instances.installModWithDeps(instance.id, entry.curseforgeId, files[0].id)
      setInstalled(prev => new Set([...prev, entry.slug]))
      onInstalled()
    } catch (err: any) {
      setErrors(prev => ({ ...prev, [entry.slug]: err.message ?? 'Error desconocido' }))
    } finally {
      setInstalling(null)
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50" onClick={() => onClose(false)} />
      <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none p-4">
        <div
          className="w-full max-w-2xl rounded-2xl shadow-2xl border pointer-events-auto flex flex-col bg-[#13111f] border-purple-500/40"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700/60">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-purple-500/15">
                <Database size={14} className="text-purple-400" />
              </div>
              <div>
                <h3 className="font-semibold text-sm text-white">Datapack Loader requerido</h3>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  Para usar datapacks fuera de un mundo necesitas un mod. Elige uno compatible con {instance.mcVersion} / {instance.modLoader}.
                </p>
              </div>
            </div>
            <button onClick={() => onClose(false)} className="p-1.5 rounded-lg transition-colors hover:bg-purple-500/15 text-gray-400 hover:text-gray-200">
              <X size={15} />
            </button>
          </div>

          {/* Search */}
          <div className="px-4 pt-3 pb-2">
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={e => handleSearchChange(e.target.value)}
                placeholder="Filtrar..."
                className="w-full pl-8 pr-3 py-2 rounded-lg text-sm bg-gray-800/60 border border-gray-700/50 text-gray-200 placeholder-gray-600 focus:outline-none focus:border-purple-500/50"
              />
            </div>
          </div>

          {/* Content */}
          <div className="px-4 pb-4 overflow-y-auto custom-scrollbar max-h-[55vh]">
            {filtered.length === 0 ? (
              <div className="text-center py-10 text-gray-500 text-sm">
                No hay datapack loaders conocidos para {instance.mcVersion} / {instance.modLoader}
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {filtered.map(entry => {
                  const isInstalled = installed.has(entry.slug)
                  const isInstalling = installing === entry.slug
                  const error = errors[entry.slug]
                  const logo = logos[entry.slug]
                  return (
                    <div
                      key={entry.slug}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-gray-700/40 hover:border-gray-600/60 hover:bg-gray-700/10 transition-all"
                    >
                      <div className="w-9 h-9 rounded-lg shrink-0 flex items-center justify-center overflow-hidden bg-purple-500/10">
                        {logo
                          ? <img src={logo} alt="" className="w-full h-full object-cover" />
                          : <Database size={15} className="text-purple-400 opacity-60" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-100">{entry.name}</p>
                        <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">{entry.description}</p>
                        {error && (
                          <p className="text-[11px] text-red-400 mt-0.5 flex items-center gap-1">
                            <AlertCircle size={10} /> {error}
                          </p>
                        )}
                        <span className="text-[10px] text-gray-600 mt-0.5 block">
                          Desde MC {entry.minMcVersion} · {entry.loaders.join(', ')}
                        </span>
                      </div>
                      <button
                        onClick={() => handleInstall(entry)}
                        disabled={isInstalled || isInstalling || installing !== null}
                        className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:cursor-not-allowed ${
                          isInstalled
                            ? 'bg-green-500/15 text-green-400 border border-green-500/25'
                            : 'bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 hover:text-purple-200 disabled:opacity-50'
                        }`}
                      >
                        {isInstalling ? (
                          <><RefreshCw size={11} className="animate-spin" /> Instalando...</>
                        ) : isInstalled ? (
                          <><CheckCircle size={11} /> Instalado</>
                        ) : (
                          <><Download size={11} /> Instalar</>
                        )}
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-5 py-3 border-t border-gray-700/60 flex items-center justify-end gap-2">
            {confirmIgnore ? (
              <>
                <span className="text-xs text-gray-400 mr-auto">Este aviso no volverá a aparecer para esta instancia.</span>
                <button
                  onClick={() => setConfirmIgnore(false)}
                  className="px-3 py-1.5 rounded-lg text-xs text-gray-500 hover:text-gray-300 hover:bg-gray-700/40 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => onClose(true)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/15 hover:bg-red-500/25 text-red-400 hover:text-red-300 transition-colors"
                >
                  Confirmar
                </button>
              </>
            ) : (
              <button
                onClick={() => setConfirmIgnore(true)}
                className="px-4 py-1.5 rounded-lg text-sm text-gray-400 hover:text-gray-200 hover:bg-gray-700/40 transition-colors"
              >
                Ya lo tengo / Ignorar
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
