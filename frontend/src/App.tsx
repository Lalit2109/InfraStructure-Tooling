import React, { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { MainLayout } from './layout/MainLayout'
import { fetchMenu } from './api/menu'
import type { ModuleMenu } from './layout/Sidebar'
import { FirewallRules } from './modules/firewall/FirewallRules'
import { LogsOverview } from './modules/logs/LogsOverview'
import { BackupsLayout } from './modules/backups/BackupsLayout'
import { BackupRepositoriesList } from './modules/backups/BackupRepositoriesList'
import { RestoreWizard } from './modules/backups/RestoreWizard'
import { BackupStatus } from './modules/backups/BackupStatus'
import './layout/layout.css'

const App: React.FC = () => {
  const [modules, setModules] = useState<ModuleMenu[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchMenu()
      .then((menus) => {
        setModules(menus)
        setError(null)
      })
      .catch((err) => {
        console.error('Failed to fetch menu:', err)
        setError(err.message || 'Failed to load menu from API')
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: '#f5f5f5' }}>
        Loading menu...
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: 32, color: '#ff6b6b' }}>
        <h2>Error loading menu</h2>
        <p>{error}</p>
        <p style={{ fontSize: '0.9rem', opacity: 0.8 }}>
          Make sure the backend is running on http://localhost:8000
        </p>
      </div>
    )
  }

  if (!modules.length) {
    return (
      <div style={{ padding: 32, color: '#f5f5f5' }}>
        No modules registered. Check backend logs.
      </div>
    )
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainLayout modules={modules} />}>
          <Route index element={<Navigate to={modules[0].routes[0].path} replace />} />
          <Route path="/firewall/rules" element={<FirewallRules />} />
          <Route path="/logs/overview" element={<LogsOverview />} />
          <Route path="/backups" element={<BackupsLayout />}>
            <Route path="list" element={<BackupRepositoriesList />} />
            <Route path="restore" element={<RestoreWizard />} />
            <Route path="status" element={<BackupStatus />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
