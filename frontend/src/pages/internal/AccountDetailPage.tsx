import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { createAssessment, deleteAccount, getAccountDetail } from '../../api/internal'
import type { AccountDetail, AssessmentCreated, PillarStatusRow } from '../../types'

function UrlModal({
  result,
  onClose,
}: {
  result: AssessmentCreated
  onClose: () => void
}) {
  const [copied, setCopied] = useState(false)
  const [prospectName, setProspectName] = useState('')
  const [prospectEmail, setProspectEmail] = useState('')

  const buildUrl = () => {
    const params = new URLSearchParams()
    if (prospectName.trim()) params.set('name', prospectName.trim())
    if (prospectEmail.trim()) params.set('email', prospectEmail.trim())
    const qs = params.toString()
    return qs ? `${result.full_url}?${qs}` : result.full_url
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(buildUrl()).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg p-6">
        <h2 className="text-xl font-semibold text-[#1B2B4B] dark:text-gray-100 mb-2">Assessment URL Generated</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Optionally enter the prospect's details to pre-fill their registration form.
        </p>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Prospect name</label>
            <input
              type="text"
              value={prospectName}
              onChange={(e) => setProspectName(e.target.value)}
              placeholder="Jane Smith"
              className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-1.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Prospect email</label>
            <input
              type="email"
              value={prospectEmail}
              onChange={(e) => setProspectEmail(e.target.value)}
              placeholder="jane@company.com"
              className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-1.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>
        </div>

        <div className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded p-3 flex items-center gap-2">
          <span className="flex-1 text-sm text-gray-800 dark:text-gray-200 break-all font-mono">{buildUrl()}</span>
          <button
            onClick={handleCopy}
            className="shrink-0 px-3 py-1 text-sm bg-brand text-white rounded hover:bg-blue-700 focus:outline-none"
          >
            {copied ? '✓ Copied' : 'Copy'}
          </button>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

function DeleteConfirmModal({
  companyName,
  onConfirm,
  onCancel,
  deleting,
}: {
  companyName: string
  onConfirm: () => void
  onCancel: () => void
  deleting: boolean
}) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6">
        <h2 className="text-xl font-semibold text-[#1B2B4B] dark:text-gray-100 mb-2">Delete Account</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Are you sure you want to delete <span className="font-medium text-gray-800 dark:text-gray-200">{companyName}</span>?
          This will permanently delete all assessments and reports for this account.
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={deleting}
            className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="px-4 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
          >
            {deleting ? 'Deleting…' : 'Delete Account'}
          </button>
        </div>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: PillarStatusRow['status'] }) {
  if (!status) return <span className="text-gray-400 text-sm">Not Sent</span>
  const map: Record<string, { label: string; className: string }> = {
    pending: { label: 'Sent', className: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' },
    in_progress: { label: 'In Progress', className: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400' },
    completed: { label: 'Completed', className: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' },
  }
  const style = map[status] ?? { label: status, className: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400' }
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${style.className}`}>
      {style.label}
    </span>
  )
}

export default function AccountDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [account, setAccount] = useState<AccountDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [generating, setGenerating] = useState<string | null>(null)
  const [urlResult, setUrlResult] = useState<AssessmentCreated | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!id) return
    getAccountDetail(id)
      .then(setAccount)
      .catch(() => setError('Failed to load account'))
      .finally(() => setLoading(false))
  }, [id])

  const handleGenerateUrl = async (pillarId: string) => {
    if (!id) return
    setGenerating(pillarId)
    setActionError(null)
    try {
      const result = await createAssessment(id, pillarId)
      setUrlResult(result)
      const updated = await getAccountDetail(id)
      setAccount(updated)
    } catch (err: unknown) {
      const anyErr = err as { response?: { status?: number } }
      if (anyErr?.response?.status === 409) {
        setActionError('An assessment already exists for this pillar.')
      } else {
        setActionError('Failed to generate URL. Please try again.')
      }
    } finally {
      setGenerating(null)
    }
  }

  const handleDelete = async () => {
    if (!id) return
    setDeleting(true)
    try {
      await deleteAccount(id)
      navigate('/dashboard')
    } catch {
      setActionError('Failed to delete account. Please try again.')
      setShowDeleteModal(false)
    } finally {
      setDeleting(false)
    }
  }

  const handleCopyUrl = (token: string, prospectName?: string | null, prospectEmail?: string | null) => {
    const base = `${window.location.origin}/assess/${token}`
    const params = new URLSearchParams()
    if (prospectName) params.set('name', prospectName)
    if (prospectEmail) params.set('email', prospectEmail)
    const qs = params.toString()
    const url = qs ? `${base}?${qs}` : base
    navigator.clipboard.writeText(url).catch(() => {
      setActionError(`Failed to copy. URL: ${url}`)
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-gray-500 dark:text-gray-400">Loading account…</div>
      </div>
    )
  }

  if (error || !account) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-red-600 dark:text-red-400">{error ?? 'Account not found'}</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="px-6 py-8">
        <button
          onClick={() => navigate('/dashboard')}
          className="text-sm text-brand hover:underline mb-4 flex items-center gap-1"
        >
          ← Accounts
        </button>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-[#1B2B4B] dark:text-gray-100">{account.company_name}</h1>
              {account.company_website && (
                <a
                  href={account.company_website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-brand hover:underline mt-1 block"
                >
                  {account.company_website}
                </a>
              )}
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                Created by {account.internal_user_name} on{' '}
                {new Date(account.created_at).toLocaleDateString()}
              </p>
            </div>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="px-3 py-1.5 text-sm border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              Delete Account
            </button>
          </div>
        </div>

        {actionError && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded text-sm">
            {actionError}
          </div>
        )}

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-[#1B2B4B] dark:text-gray-100">Pillar Assessments</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Pillar</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Prospect</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Role</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Score</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Action</th>
              </tr>
            </thead>
            <tbody>
              {account.pillar_statuses.map((row) => (
                <tr key={row.pillar_id} className="border-b border-gray-100 dark:border-gray-700">
                  <td className="px-4 py-3 font-medium text-[#1B2B4B] dark:text-gray-100">
                    {row.pillar_name}
                    {row.is_gated && (
                      <span className="ml-2 text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 px-1.5 py-0.5 rounded">
                        Gated
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{row.prospect_name ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{row.prospect_role ?? '—'}</td>
                  <td className="px-4 py-3">
                    {row.pillar_score !== null ? (
                      <span className="font-medium text-[#1B2B4B] dark:text-gray-100">
                        {row.pillar_score.toFixed(1)} / 4.0
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="px-4 py-3">
                    {row.status === 'completed' && row.assessment_id ? (
                      <button
                        onClick={() => navigate(`/dashboard/assessments/${row.assessment_id}`)}
                        className="text-sm text-brand hover:underline"
                      >
                        View Report
                      </button>
                    ) : row.status === 'pending' && row.short_url_token ? (
                      <button
                        onClick={() => handleCopyUrl(row.short_url_token!, row.prospect_name, row.prospect_email)}
                        className="text-sm text-brand hover:underline"
                      >
                        Copy URL
                      </button>
                    ) : row.status === 'in_progress' && row.short_url_token ? (
                      <button
                        onClick={() => handleCopyUrl(row.short_url_token!, row.prospect_name, row.prospect_email)}
                        className="text-sm text-brand hover:underline"
                      >
                        Copy URL
                      </button>
                    ) : !row.status ? (
                      <button
                        onClick={() => handleGenerateUrl(row.pillar_id)}
                        disabled={generating === row.pillar_id}
                        className="text-sm text-brand hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {generating === row.pillar_id ? 'Generating…' : 'Generate URL'}
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {urlResult && (
        <UrlModal result={urlResult} onClose={() => setUrlResult(null)} />
      )}

      {showDeleteModal && (
        <DeleteConfirmModal
          companyName={account.company_name}
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteModal(false)}
          deleting={deleting}
        />
      )}
    </div>
  )
}
