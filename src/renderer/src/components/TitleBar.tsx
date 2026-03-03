import React from 'react'
import { Minus, Square, X } from 'lucide-react'

export default function TitleBar() {
  return (
    <div className="flex items-center justify-between h-9 bg-gray-950 border-b border-gray-800 drag-region select-none shrink-0">
      <div className="flex items-center gap-2 px-4">
        <div className="w-5 h-5 rounded bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
          <span className="text-white text-xs font-bold">C</span>
        </div>
        <span className="text-gray-400 text-xs font-medium">CW-MC Launcher</span>
      </div>
      <div className="flex no-drag">
        <button
          onClick={() => window.launcher.window.minimize()}
          className="w-12 h-9 flex items-center justify-center text-gray-500 hover:text-white hover:bg-gray-700 transition-colors"
          aria-label="Minimizar"
        >
          <Minus size={13} />
        </button>
        <button
          onClick={() => window.launcher.window.maximize()}
          className="w-12 h-9 flex items-center justify-center text-gray-500 hover:text-white hover:bg-gray-700 transition-colors"
          aria-label="Maximizar"
        >
          <Square size={11} />
        </button>
        <button
          onClick={() => window.launcher.window.close()}
          className="w-12 h-9 flex items-center justify-center text-gray-500 hover:text-white hover:bg-red-600 transition-colors"
          aria-label="Cerrar"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  )
}
