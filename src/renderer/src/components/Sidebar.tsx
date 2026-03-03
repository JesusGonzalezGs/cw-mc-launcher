import React from 'react'
import { NavLink } from 'react-router-dom'
import { LayoutGrid, Store, Settings } from 'lucide-react'

const NAV = [
  { to: '/instances', icon: LayoutGrid, label: 'Instancias' },
  { to: '/catalog', icon: Store, label: 'Catálogo' },
  { to: '/settings', icon: Settings, label: 'Ajustes' },
]

export default function Sidebar() {
  return (
    <aside className="w-16 flex flex-col items-center py-3 gap-1 bg-[#0a0a14] border-r border-purple-500/20 shrink-0">
      {NAV.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `w-10 h-10 flex items-center justify-center rounded-xl transition-all relative group
            ${isActive
              ? 'bg-gradient-to-br from-purple-600/25 to-pink-600/10 text-purple-400 border border-purple-500/30 shadow-sm shadow-purple-900/20'
              : 'text-gray-600 hover:text-gray-300 hover:bg-purple-500/10 border border-transparent'
            }`
          }
          title={label}
          aria-label={label}
        >
          <Icon size={18} />
          <span className="absolute left-full ml-2.5 px-2.5 py-1 bg-gray-900/95 border border-purple-500/20 text-white text-xs rounded-xl opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity backdrop-blur-sm shadow-xl">
            {label}
          </span>
        </NavLink>
      ))}
    </aside>
  )
}
