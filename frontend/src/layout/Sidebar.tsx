import React from 'react'
import './layout.css'

export interface MenuRoute {
  title: string
  path: string
}

export interface ModuleMenu {
  id: string
  title: string
  icon?: string
  routes: MenuRoute[]
}

interface SidebarProps {
  modules: ModuleMenu[]
  activeModuleId?: string
  onSelectModule: (id: string) => void
}

export const Sidebar: React.FC<SidebarProps> = ({
  modules,
  activeModuleId,
  onSelectModule,
}) => {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">InfraStructure Tooling</div>
      <nav className="sidebar-nav">
        {modules.map((m) => (
          <button
            key={m.id}
            className={
              'sidebar-item' + (m.id === activeModuleId ? ' sidebar-item-active' : '')
            }
            onClick={() => onSelectModule(m.id)}
          >
            <span className="sidebar-item-icon">{m.icon?.[0] ?? m.title[0]}</span>
            <span className="sidebar-item-label">{m.title}</span>
          </button>
        ))}
      </nav>
    </aside>
  )
}


