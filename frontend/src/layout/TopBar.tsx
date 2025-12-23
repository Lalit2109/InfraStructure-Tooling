import React from 'react'
import './layout.css'

interface TopBarProps {
  activeModuleTitle?: string
}

export const TopBar: React.FC<TopBarProps> = ({ activeModuleTitle }) => {
  return (
    <header className="topbar">
      <div className="topbar-left">
        <div className="topbar-title">{activeModuleTitle ?? 'Select a module'}</div>
      </div>
      {/* <div className="topbar-right">
        <span className="topbar-chip">Env: dev</span>
        <span className="topbar-chip">User: demo@corp</span>
      </div> */}
    </header>
  )
}


