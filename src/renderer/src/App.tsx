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
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!activeAccount) {
    return (
      <div className="flex flex-col h-screen bg-gray-900">
        <TitleBar />
        <AuthPage onLogin={(acc) => setActiveAccount(acc)} />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-gray-900 overflow-hidden">
      <TitleBar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto custom-scrollbar">
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
  )
}
