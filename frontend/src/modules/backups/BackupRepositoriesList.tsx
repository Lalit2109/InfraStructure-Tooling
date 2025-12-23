import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'

interface BackupRepository {
  id: string
  org: string
  project: string
  repo: string
  backup_count: number
  last_backup: string | null
}

interface BackupVersion {
  id: string
  timestamp: string
  size_bytes: number
  size_mb: number
  retention_expires: string | null
  blob_path: string
}

export const BackupRepositoriesList: React.FC = () => {
  const [repos, setRepos] = useState<BackupRepository[]>([])
  const [selectedRepo, setSelectedRepo] = useState<string | null>(null)
  const [versions, setVersions] = useState<BackupVersion[]>([])
  const [loading, setLoading] = useState(true)
  const [versionsLoading, setVersionsLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    axios
      .get<BackupRepository[]>('/api/backups/repositories')
      .then((res) => {
        setRepos(res.data)
        setLoading(false)
      })
      .catch((err) => {
        console.error('Failed to load repositories:', err)
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    if (selectedRepo) {
      setVersionsLoading(true)
      axios
        .get<BackupVersion[]>(`/api/backups/repositories/${selectedRepo}/versions`)
        .then((res) => {
          setVersions(res.data)
          setVersionsLoading(false)
        })
        .catch((err) => {
          console.error('Failed to load versions:', err)
          setVersionsLoading(false)
        })
    } else {
      setVersions([])
    }
  }, [selectedRepo])

  const filteredRepos = repos.filter(
    (repo) =>
      repo.repo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      repo.project.toLowerCase().includes(searchTerm.toLowerCase()) ||
      repo.org.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleDownload = async (backupId: string) => {
    if (!selectedRepo) return

    try {
      const res = await axios.post<{ download_url: string }>(
        `/api/backups/repositories/${selectedRepo}/download-link`,
        { backup_id: backupId }
      )
      window.open(res.data.download_url, '_blank')
    } catch (err) {
      console.error('Failed to get download link:', err)
      alert('Failed to generate download link')
    }
  }

  const handleStartRestore = (backupId: string) => {
    navigate(`/backups/restore?repo=${selectedRepo}&backup=${backupId}`)
  }

  if (loading) {
    return <div>Loading repositories...</div>
  }

  return (
    <div className="backups-list-container">
      <div className="backups-search">
        <input
          type="text"
          placeholder="Search by repository, project, or organization..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div>
        <h3 style={{ marginBottom: '12px', color: '#f5f5f5' }}>
          Repositories ({filteredRepos.length})
        </h3>
        {filteredRepos.length === 0 ? (
          <div style={{ color: 'rgba(245, 245, 245, 0.7)', padding: '20px' }}>
            No repositories found
          </div>
        ) : (
          filteredRepos.map((repo) => (
            <div
              key={repo.id}
              className={`repo-card ${selectedRepo === repo.id ? 'repo-card-selected' : ''}`}
              onClick={() => setSelectedRepo(selectedRepo === repo.id ? null : repo.id)}
            >
              <div className="repo-header">
                <div className="repo-title">
                  {repo.org} / {repo.project} / {repo.repo}
                </div>
              </div>
              <div className="repo-meta">
                <span>{repo.backup_count} backups available</span>
                {repo.last_backup && (
                  <span>
                    Last backup: {new Date(repo.last_backup).toLocaleString()}
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {selectedRepo && (
        <div className="versions-table">
          <div className="versions-table-header">
            <h3>Backup Versions</h3>
          </div>
          {versionsLoading ? (
            <div style={{ color: 'rgba(245, 245, 245, 0.7)', padding: '20px' }}>
              Loading versions...
            </div>
          ) : versions.length === 0 ? (
            <div style={{ color: 'rgba(245, 245, 245, 0.7)', padding: '20px' }}>
              No backup versions found
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Size</th>
                  <th>Retention Expires</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {versions.map((version) => (
                  <tr key={version.id}>
                    <td>{new Date(version.timestamp).toLocaleString()}</td>
                    <td>{version.size_mb} MB</td>
                    <td>
                      {version.retention_expires
                        ? new Date(version.retention_expires).toLocaleDateString()
                        : 'N/A'}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          className="backup-action-btn backup-action-btn-secondary"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDownload(version.id)
                          }}
                        >
                          Download
                        </button>
                        <button
                          className="backup-action-btn"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleStartRestore(version.id)
                          }}
                        >
                          Start Restore
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}

