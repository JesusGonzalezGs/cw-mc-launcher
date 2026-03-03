import React from 'react'

interface Props {
  percent: number
  label?: string
  className?: string
}

export default function ProgressBar({ percent, label, className = '' }: Props) {
  return (
    <div className={`space-y-1 ${className}`}>
      {label && <p className="text-xs text-gray-400 truncate">{label}</p>}
      <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-300"
          style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
        />
      </div>
      <p className="text-xs text-gray-500 text-right">{percent}%</p>
    </div>
  )
}
