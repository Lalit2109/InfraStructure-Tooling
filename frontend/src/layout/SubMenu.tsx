import React from 'react'
import type { MenuRoute } from './Sidebar'
import './layout.css'
import { NavLink } from 'react-router-dom'

interface SubMenuProps {
  routes: MenuRoute[]
}

export const SubMenu: React.FC<SubMenuProps> = ({ routes }) => {
  if (!routes.length) return null

  return (
    <nav className="submenu">
      {routes.map((route) => (
        <NavLink
          key={route.path}
          to={route.path}
          className={({ isActive }) =>
            'submenu-item' + (isActive ? ' submenu-item-active' : '')
          }
        >
          {route.title}
        </NavLink>
      ))}
    </nav>
  )
}


