import React, { useEffect, useState } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import TitleBar from './components/TitleBar'
import Sidebar from './components/Sidebar'
import AuthPage from './pages/AuthPage'
import InstancesPage from './pages/InstancesPage'
import NewInstancePage from './pages/NewInstancePage'
import InstanceDetailPage from './pages/InstanceDetailPage'
import CatalogPage from './pages/CatalogPage'
import ModpackDetailPage from './pages/ModpackDetailPage'
import SettingsPage from './pages/SettingsPage'
import { InstallProvider } from './context/InstallContext'

export default function App() {
  const location = useLocation()
  const [activeAccount, setActiveAccount] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    window.launcher.auth.getActive().then((acc) => {
      setActiveAccount(acc)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[radial-gradient(ellipse_at_top,_#1e1040_0%,_#0f0f1a_60%,_#0a0a14_100%)]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-2xl shadow-purple-900/50">
            <span className="text-2xl font-black text-white">C</span>
          </div>
          <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  if (!activeAccount) {
    return (
      <div className="flex flex-col h-screen bg-[radial-gradient(ellipse_at_top,_#1e1040_0%,_#0f0f1a_60%,_#0a0a14_100%)]">
        <TitleBar />
        <AuthPage onLogin={(acc) => setActiveAccount(acc)} />
      </div>
    )
  }

  return (
    <InstallProvider>
      <div className="flex flex-col h-screen bg-[#0a0a14] overflow-hidden">
        <TitleBar />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-y-auto [scrollbar-gutter:stable] custom-scrollbar bg-[radial-gradient(ellipse_at_top,_#1e1040_0%,_#0f0f1a_60%,_#0a0a14_100%)]">
            <Routes>
              <Route path="/" element={<Navigate to="/instances" replace />} />
              <Route path="/instances" element={<InstancesPage />} />
              <Route path="/instances/new" element={<NewInstancePage key={location.key} />} />
              <Route path="/instances/:id" element={<InstanceDetailPage />} />
              <Route path="/catalog" element={<CatalogPage />} />
              <Route path="/catalog/:modpackId" element={<ModpackDetailPage />} />
              <Route path="/settings" element={<SettingsPage onAccountChange={setActiveAccount} />} />
            </Routes>
          </main>
        </div>
      </div>
    </InstallProvider>
  )
}
