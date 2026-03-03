import React from 'react'
import { Minus, Square, X } from 'lucide-react'

export default function TitleBar() {
  return (
    <div className="flex items-center justify-between h-9 bg-[#0a0a14] border-b border-purple-500/20 drag-region select-none shrink-0">
      <div className="flex items-center gap-2 px-4">
        <div className="w-5 h-5 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-sm shadow-purple-900/50">
          <span className="text-white text-xs font-bold">C</span>
        </div>
        <span className="text-gray-500 text-xs font-medium tracking-wide">CW-MC Launcher</span>
      </div>
      <div className="flex no-drag">
        <button
          onClick={() => window.launcher.window.minimize()}
          className="w-12 h-9 flex items-center justify-center text-gray-600 hover:text-purple-300 hover:bg-purple-500/10 transition-colors"
          aria-label="Minimizar"
        >
          <Minus size={13} />
        </button>
        <button
          onClick={() => window.launcher.window.maximize()}
          className="w-12 h-9 flex items-center justify-center text-gray-600 hover:text-purple-300 hover:bg-purple-500/10 transition-colors"
          aria-label="Maximizar"
        >
          <Square size={11} />
        </button>
        <button
          onClick={() => window.launcher.window.close()}
          className="w-12 h-9 flex items-center justify-center text-gray-600 hover:text-white hover:bg-red-600 transition-colors"
          aria-label="Cerrar"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  )
}
