import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { createAssessment, getAccountDetail } from '../../api/internal'
import type { AccountDetail, AssessmentCreated, PillarStatusRow } from '../../types'

// ── URL modal ──────────────────────────────────────────────────────────────────

function UrlModal({
  result,
  onClose,
}: {
  result: AssessmentCreated
  onClose: () => void
}) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(result.full_url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6">
        <h2 className="text-xl font-semibold text-[#1B2B4B] mb-2">Assessment URL Generated</h2>
        <p className="text-sm text-gray-500 mb-4">Share this URL with the prospect to begin their assessment.</p>

        <div className="bg-gray-50 border border-gray-200 rounded p-3 flex items-center gap-2">
          <span className="flex-1 text-sm text-gray-800 break-all font-mono">{result.full_url}</span>
          <button
            onClick={handleCopy}
            className="shrink-0 px-3 py-1 text-sm bg-[#0066FF] text-white rounded hover:bg-blue-700 focus:outline-none"
          >
            {copied ? '✓ Copied' : 'Copy'}
          </button>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50 text-gray-600"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Status badge ───────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: PillarStatusRow['status'] }) {
  if (!status) return <span className="text-gray-400 text-sm">Not Sent</span>
  const map: Record<string, { label: string; className: string }> = {
    pending: { label: 'Sent', className: 'bg-blue-100 text-blue-700' },
    in_progress: { label: 'In Progress', className: 'bg-yellow-100 text-yellow-700' },
    completed: { label: 'Completed', className: 'bg-green-100 text-green-700' },
  }
  const style = map[status] ?? { label: status, className: 'bg-gray-100 text-gray-600' }
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${style.className}`}>
      {style.label}
    </span>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function AccountDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [account, setAccount] = useState<AccountDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [generating, setGenerating] = useState<string | null>(null) // pillar_id being generated
  const [urlResult, setUrlResult] = useState<AssessmentCreated | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

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
      // Refresh account to update pillar status grid
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

  const handleCopyUrl = (token: string) => {
    const url = `${window.location.origin}/assess/${token}`
    navigator.clipboard.writeText(url)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading account…</div>
      </div>
    )
  }

  if (error || !account) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-red-600">{error ?? 'Account not found'}</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Back nav */}
        <button
          onClick={() => navigate('/dashboard')}
          className="text-sm text-[#0066FF] hover:underline mb-4 flex items-center gap-1"
        >
          ← Accounts
        </button>

        {/* Account header */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-[#1B2B4B]">{account.company_name}</h1>
              {account.company_website && (
                <a
                  href={account.company_website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-[#0066FF] hover:underline mt-1 block"
                >
                  {account.company_website}
                </a>
              )}
              <p className="text-sm text-gray-500 mt-2">
                Created by {account.internal_user_name} on{' '}
                {new Date(account.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>

        {actionError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded text-sm">
            {actionError}
          </div>
        )}

        {/* Pillar status grid */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-[#1B2B4B]">Pillar Assessments</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Pillar</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Prospect</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Role</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Score</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Action</th>
              </tr>
            </thead>
            <tbody>
              {account.pillar_statuses.map((row) => (
                <tr key={row.pillar_id} className="border-b border-gray-100">
                  <td className="px-4 py-3 font-medium text-[#1B2B4B]">
                    {row.pillar_name}
                    {row.is_gated && (
                      <span className="ml-2 text-xs bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded">
                        Gated
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{row.prospect_name ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{row.prospect_role ?? '—'}</td>
                  <td className="px-4 py-3">
                    {row.pillar_score !== null ? (
                      <span className="font-medium text-[#1B2B4B]">
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
                        className="text-sm text-[#0066FF] hover:underline"
                      >
                        View Report
                      </button>
                    ) : row.status === 'pending' && row.short_url_token ? (
                      <button
                        onClick={() => handleCopyUrl(row.short_url_token!)}
                        className="text-sm text-[#0066FF] hover:underline"
                      >
                        Copy URL
                      </button>
                    ) : row.status === 'in_progress' && row.short_url_token ? (
                      <button
                        onClick={() => handleCopyUrl(row.short_url_token!)}
                        className="text-sm text-[#0066FF] hover:underline"
                      >
                        Copy URL
                      </button>
                    ) : !row.status ? (
                      <button
                        onClick={() => handleGenerateUrl(row.pillar_id)}
                        disabled={generating === row.pillar_id}
                        className="text-sm text-[#0066FF] hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
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
    </div>
  )
}
