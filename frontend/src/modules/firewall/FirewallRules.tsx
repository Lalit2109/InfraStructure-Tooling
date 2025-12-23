import React, { useEffect, useState } from 'react'
import axios from 'axios'

interface FirewallRule {
  id: string
  name: string
  source: string
  destination: string
  protocol: string
  port: number
  action: string
}

export const FirewallRules: React.FC = () => {
  const [rules, setRules] = useState<FirewallRule[]>([])

  useEffect(() => {
    axios.get<{ rules: FirewallRule[] }>('/api/firewall/rules').then((res) => {
      setRules(res.data.rules)
    })
  }, [])

  return (
    <div>
      <h2>Firewall Rules</h2>
      <table className="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Source</th>
            <th>Destination</th>
            <th>Protocol</th>
            <th>Port</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {rules.map((r) => (
            <tr key={r.id}>
              <td>{r.name}</td>
              <td>{r.source}</td>
              <td>{r.destination}</td>
              <td>{r.protocol}</td>
              <td>{r.port}</td>
              <td>{r.action}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}


