import React, { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import axios from 'axios'

interface RestorePreview {
  source_org: string
  source_project: string
  source_repo: string
  backup_timestamp: string
  backup_size_mb: number
  suggested_target_repo_name: string
}

interface RestoreResult {
  status: 'success' | 'error'
  message: string
  repo_url?: string
  repo_id?: string
  download_url?: string
}

export const RestoreWizard: React.FC = () => {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [repoId, setRepoId] = useState<string | null>(searchParams.get('repo') || null)
  const [backupId, setBackupId] = useState<string | null>(searchParams.get('backup') || null)
  const [preview, setPreview] = useState<RestorePreview | null>(null)
  const [loading, setLoading] = useState(false)
  const [restoreResult, setRestoreResult] = useState<RestoreResult | null>(null)

  // Form fields
  const [targetOrg, setTargetOrg] = useState('')
  const [targetProject, setTargetProject] = useState('')
  const [targetRepoName, setTargetRepoName] = useState('')
  const [visibility, setVisibility] = useState('private')

  useEffect(() => {
    if (repoId && backupId) {
      loadPreview()
    }
  }, [repoId, backupId])

  const loadPreview = async () => {
    if (!repoId || !backupId) return

    try {
      setLoading(true)
      const res = await axios.post<RestorePreview>(
        `/api/backups/repositories/${repoId}/restore-preview`,
        { backup_id: backupId }
      )
      setPreview(res.data)
      setTargetRepoName(res.data.suggested_target_repo_name)
      setLoading(false)
    } catch (err) {
      console.error('Failed to load preview:', err)
      setLoading(false)
    }
  }

  const handleNext = () => {
    if (step === 1 && repoId && backupId) {
      setStep(2)
    } else if (step === 2) {
      if (targetOrg && targetProject && targetRepoName) {
        setStep(3)
      }
    }
  }

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1)
    }
  }

  const handleRestore = async () => {
    if (!repoId || !backupId) return

    try {
      setLoading(true)
      const res = await axios.post<RestoreResult>(
        `/api/backups/repositories/${repoId}/restore`,
        {
          backup_id: backupId,
          target_org: targetOrg,
          target_project: targetProject,
          target_repo_name: targetRepoName,
          visibility,
        }
      )
      setRestoreResult(res.data)
      setStep(4)
      setLoading(false)
    } catch (err: any) {
      setRestoreResult({
        status: 'error',
        message: err.response?.data?.message || err.message || 'Restore failed',
      })
      setStep(4)
      setLoading(false)
    }
  }

  const canProceedStep1 = repoId && backupId && preview !== null
  const canProceedStep2 = targetOrg.trim() && targetProject.trim() && targetRepoName.trim()

  return (
    <div className="restore-wizard">
      {step === 1 && (
        <div className="wizard-step">
          <div className="wizard-step-title">Step 1: Select Backup</div>
          {loading ? (
            <div>Loading backup preview...</div>
          ) : preview ? (
            <div className="wizard-summary">
              <h4>Selected Backup</h4>
              <div className="wizard-summary-item">
                <span className="wizard-summary-label">Source Organization:</span>
                <span className="wizard-summary-value">{preview.source_org}</span>
              </div>
              <div className="wizard-summary-item">
                <span className="wizard-summary-label">Source Project:</span>
                <span className="wizard-summary-value">{preview.source_project}</span>
              </div>
              <div className="wizard-summary-item">
                <span className="wizard-summary-label">Source Repository:</span>
                <span className="wizard-summary-value">{preview.source_repo}</span>
              </div>
              <div className="wizard-summary-item">
                <span className="wizard-summary-label">Backup Date:</span>
                <span className="wizard-summary-value">
                  {new Date(preview.backup_timestamp).toLocaleString()}
                </span>
              </div>
              <div className="wizard-summary-item">
                <span className="wizard-summary-label">Backup Size:</span>
                <span className="wizard-summary-value">{preview.backup_size_mb} MB</span>
              </div>
            </div>
          ) : (
            <div>
              <p style={{ color: 'rgba(245, 245, 245, 0.7)', marginBottom: '16px' }}>
                No backup selected. Please select a backup from the Available Backups tab.
              </p>
              <button
                className="wizard-btn wizard-btn-secondary"
                onClick={() => navigate('/backups/list')}
              >
                Go to Available Backups
              </button>
            </div>
          )}
          <div className="wizard-actions">
            <button
              className="wizard-btn wizard-btn-primary"
              onClick={handleNext}
              disabled={!canProceedStep1}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="wizard-step">
          <div className="wizard-step-title">Step 2: Choose Target</div>
          <div className="wizard-form-group">
            <label>Target Azure DevOps Organization *</label>
            <input
              type="text"
              value={targetOrg}
              onChange={(e) => setTargetOrg(e.target.value)}
              placeholder="e.g., myorg"
            />
            <small>Enter the Azure DevOps organization name</small>
          </div>
          <div className="wizard-form-group">
            <label>Target Azure DevOps Project *</label>
            <input
              type="text"
              value={targetProject}
              onChange={(e) => setTargetProject(e.target.value)}
              placeholder="e.g., MyProject"
            />
            <small>Enter the Azure DevOps project name where the repository will be created</small>
          </div>
          <div className="wizard-form-group">
            <label>Target Repository Name *</label>
            <input
              type="text"
              value={targetRepoName}
              onChange={(e) => setTargetRepoName(e.target.value)}
              placeholder="e.g., my-repo"
            />
            <small>Name for the new repository (must be unique in the project)</small>
          </div>
          <div className="wizard-form-group">
            <label>Repository Visibility</label>
            <select value={visibility} onChange={(e) => setVisibility(e.target.value)}>
              <option value="private">Private</option>
              <option value="public">Public</option>
            </select>
            <small>Set repository visibility (Private recommended)</small>
          </div>
          <div className="wizard-actions">
            <button className="wizard-btn wizard-btn-secondary" onClick={handleBack}>
              Back
            </button>
            <button
              className="wizard-btn wizard-btn-primary"
              onClick={handleNext}
              disabled={!canProceedStep2}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="wizard-step">
          <div className="wizard-step-title">Step 3: Confirm & Execute</div>
          <div className="wizard-summary">
            <h4>Restore Summary</h4>
            <div className="wizard-summary-item">
              <span className="wizard-summary-label">Source:</span>
              <span className="wizard-summary-value">
                {preview?.source_org}/{preview?.source_project}/{preview?.source_repo}
              </span>
            </div>
            <div className="wizard-summary-item">
              <span className="wizard-summary-label">Target Organization:</span>
              <span className="wizard-summary-value">{targetOrg}</span>
            </div>
            <div className="wizard-summary-item">
              <span className="wizard-summary-label">Target Project:</span>
              <span className="wizard-summary-value">{targetProject}</span>
            </div>
            <div className="wizard-summary-item">
              <span className="wizard-summary-label">Target Repository:</span>
              <span className="wizard-summary-value">{targetRepoName}</span>
            </div>
            <div className="wizard-summary-item">
              <span className="wizard-summary-label">Visibility:</span>
              <span className="wizard-summary-value">{visibility}</span>
            </div>
          </div>
          <div className="wizard-actions">
            <button className="wizard-btn wizard-btn-secondary" onClick={handleBack}>
              Back
            </button>
            <button
              className="wizard-btn wizard-btn-primary"
              onClick={handleRestore}
              disabled={loading}
            >
              {loading ? 'Restoring...' : 'Start Restore'}
            </button>
          </div>
        </div>
      )}

      {step === 4 && restoreResult && (
        <div className="wizard-step">
          <div className="wizard-step-title">Step 4: Result</div>
          <div
            className={`wizard-status ${
              restoreResult.status === 'success'
                ? 'wizard-status-success'
                : 'wizard-status-error'
            }`}
          >
            <h4>{restoreResult.status === 'success' ? 'Restore Successful' : 'Restore Failed'}</h4>
            <p>{restoreResult.message}</p>
            {restoreResult.repo_url && (
              <p style={{ marginTop: '12px' }}>
                <a
                  href={restoreResult.repo_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#1db954', textDecoration: 'underline' }}
                >
                  Open Repository
                </a>
              </p>
            )}
            {restoreResult.download_url && (
              <p style={{ marginTop: '8px', fontSize: '0.85rem' }}>
                <a
                  href={restoreResult.download_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#64b5f6', textDecoration: 'underline' }}
                >
                  Download Backup (for manual import)
                </a>
              </p>
            )}
          </div>
          <div className="wizard-actions">
            <button
              className="wizard-btn wizard-btn-secondary"
              onClick={() => {
                setStep(1)
                setRestoreResult(null)
                setTargetOrg('')
                setTargetProject('')
                setTargetRepoName('')
                setVisibility('private')
              }}
            >
              Start New Restore
            </button>
            <button
              className="wizard-btn wizard-btn-primary"
              onClick={() => navigate('/backups/list')}
            >
              Back to Backups
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

