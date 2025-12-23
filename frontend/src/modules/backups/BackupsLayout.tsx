import React from 'react'
import { Outlet } from 'react-router-dom'
import './backups.css'

export const BackupsLayout: React.FC = () => {
  return (
    <div className="backups-module">
      <div className="backups-content">
        <Outlet />
      </div>
    </div>
  )
}

