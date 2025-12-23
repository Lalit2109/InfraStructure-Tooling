import React from 'react'
import './layout.css'
import { Sidebar } from './Sidebar'
import type { ModuleMenu } from './Sidebar'
import { TopBar } from './TopBar'
import { SubMenu } from './SubMenu'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'

interface MainLayoutProps {
  modules: ModuleMenu[]
}

export const MainLayout: React.FC<MainLayoutProps> = ({ modules }) => {
  const location = useLocation()
  const navigate = useNavigate()

  const activeModule =
    modules.find((m) => location.pathname.startsWith('/' + m.id)) ?? modules[0]

  const handleSelectModule = (id: string) => {
    const module = modules.find((m) => m.id === id)
    if (module && module.routes.length > 0) {
      navigate(module.routes[0].path)
    }
  }

  return (
    <div className="app-shell">
      <Sidebar
        modules={modules}
        activeModuleId={activeModule?.id}
        onSelectModule={handleSelectModule}
      />
      <div className="app-main">
        <TopBar activeModuleTitle={activeModule?.title} />
        <SubMenu routes={activeModule?.routes ?? []} />
        <main className="app-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}


