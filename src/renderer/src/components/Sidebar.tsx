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
    <aside className="w-16 flex flex-col items-center py-3 gap-1 bg-gray-950 border-r border-gray-800 shrink-0">
      {NAV.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `w-10 h-10 flex items-center justify-center rounded-xl transition-all relative group
            ${isActive
              ? 'bg-purple-600/20 text-purple-400'
              : 'text-gray-600 hover:text-gray-300 hover:bg-gray-800'
            }`
          }
          title={label}
          aria-label={label}
        >
          <Icon size={18} />
          <span className="absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity">
            {label}
          </span>
        </NavLink>
      ))}
    </aside>
  )
}
