import React, { useEffect, useState, useCallback } from 'react'
import { X, ChevronLeft, ChevronRight, ZoomIn } from 'lucide-react'

export interface ImageItem {
  url: string
  thumbUrl?: string
  title?: string
}

interface Props {
  images: ImageItem[]
  initialIndex?: number
  onClose: () => void
}

export default function ImageViewer({ images, initialIndex = 0, onClose }: Props) {
  const [index, setIndex] = useState(initialIndex)
  const [loaded, setLoaded] = useState(false)

  const current = images[index]
  const hasMultiple = images.length > 1

  const prev = useCallback(() => {
    setLoaded(false)
    setIndex(i => (i - 1 + images.length) % images.length)
  }, [images.length])

  const next = useCallback(() => {
    setLoaded(false)
    setIndex(i => (i + 1) % images.length)
  }, [images.length])

  useEffect(() => {
    setLoaded(false)
    setIndex(initialIndex)
  }, [initialIndex])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft' && hasMultiple) prev()
      if (e.key === 'ArrowRight' && hasMultiple) next()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose, prev, next, hasMultiple])

  if (!current) return null

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col bg-black/95 backdrop-blur-md"
      onClick={onClose}
    >
      {/* Top bar */}
      <div
        className="flex items-center justify-between px-5 py-3 flex-shrink-0"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center">
            <ZoomIn size={14} className="text-white/70" />
          </div>
          {current.title && (
            <p className="text-sm text-gray-300 font-medium max-w-md truncate">{current.title}</p>
          )}
        </div>

        <div className="flex items-center gap-3">
          {hasMultiple && (
            <span className="text-xs text-gray-500 font-mono tabular-nums">
              {index + 1} <span className="text-gray-700">/</span> {images.length}
            </span>
          )}
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-all"
            aria-label="Cerrar"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Main image area */}
      <div
        className="flex-1 flex items-center justify-center relative min-h-0 px-4"
        onClick={e => e.stopPropagation()}
      >
        {hasMultiple && (
          <button
            onClick={prev}
            className="absolute left-4 z-10 p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-all hover:scale-105 active:scale-95"
            aria-label="Anterior"
          >
            <ChevronLeft size={20} />
          </button>
        )}

        <div
          className="w-full rounded-xl overflow-hidden"
          style={{ height: 'calc(100vh - 460px)' }}
        >
          <img
            key={current.url}
            src={current.url}
            alt={current.title ?? ''}
            onLoad={() => setLoaded(true)}
            className={`w-full h-full object-contain transition-opacity duration-200 ${loaded ? 'opacity-100' : 'opacity-0'}`}
          />
        </div>

        {!loaded && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white/60 animate-spin" />
          </div>
        )}

        {hasMultiple && (
          <button
            onClick={next}
            className="absolute right-4 z-10 p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-all hover:scale-105 active:scale-95"
            aria-label="Siguiente"
          >
            <ChevronRight size={20} />
          </button>
        )}
      </div>

      {/* Thumbnail strip */}
      {hasMultiple && (
        <div
          className="flex-shrink-0 flex justify-center gap-2 px-4 py-3 overflow-x-auto"
          onClick={e => e.stopPropagation()}
        >
          {images.map((img, i) => (
            <button
              key={i}
              onClick={() => { setLoaded(false); setIndex(i) }}
              className={`flex-shrink-0 w-16 h-10 rounded-lg overflow-hidden border-2 transition-all ${
                i === index
                  ? 'border-white/70 opacity-100 scale-105 shadow-lg shadow-black/50'
                  : 'border-transparent opacity-40 hover:opacity-70 hover:border-white/30'
              }`}
              aria-label={img.title ?? `Imagen ${i + 1}`}
            >
              <img
                src={img.thumbUrl ?? img.url}
                alt=""
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
