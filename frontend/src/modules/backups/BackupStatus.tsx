import React, { useEffect, useState } from 'react'
import axios from 'axios'

interface BackupRepo {
  name: string
  provider: string
  last_backup: string
  status: string
}

interface BackupStatusDto {
  summary: {
    repositories_monitored: number
    healthy: number
    failing: number
    last_run: string
  }
  repositories: BackupRepo[]
}

export const BackupStatus: React.FC = () => {
  const [data, setData] = useState<BackupStatusDto | null>(null)

  useEffect(() => {
    axios.get<BackupStatusDto>('/api/backups/status').then((res) => setData(res.data))
  }, [])

  if (!data) {
    return <div>Loading backup status...</div>
  }

  return (
    <div>
      <h2>Git Backup</h2>
      <p>
        Monitored repositories: <strong>{data.summary.repositories_monitored}</strong>
      </p>
      <p>
        Healthy: {data.summary.healthy} | Failing: {data.summary.failing}
      </p>
      <p>Last run: {new Date(data.summary.last_run).toLocaleString()}</p>
      <table className="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Provider</th>
            <th>Last backup</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {data.repositories.map((r) => (
            <tr key={r.name}>
              <td>{r.name}</td>
              <td>{r.provider}</td>
              <td>{new Date(r.last_backup).toLocaleString()}</td>
              <td>{r.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}


