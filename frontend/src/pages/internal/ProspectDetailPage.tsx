import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getAccountDetail } from '../../api/internal'
import type { AccountDetail, PillarStatusRow } from '../../types'

function StatusBadge({ status }: { status: PillarStatusRow['status'] }) {
  if (!status) return <span className="text-gray-400 dark:text-gray-500 text-sm">Not Sent</span>
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

function CopyUrlButton({ token }: { token: string }) {
  const [copied, setCopied] = useState(false)

  const url = `${window.location.origin}/assess/${token}`

  const handleCopy = () => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-500 dark:text-gray-400 font-mono truncate max-w-[160px]" title={url}>
        /assess/{token}
      </span>
      <button
        onClick={handleCopy}
        className="shrink-0 px-2 py-0.5 text-xs bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white rounded"
      >
        {copied ? '✓' : 'Copy'}
      </button>
    </div>
  )
}

export default function ProspectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [account, setAccount] = useState<AccountDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    getAccountDetail(id)
      .then(setAccount)
      .catch(() => setError('Failed to load prospect'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <p className="text-gray-500 dark:text-gray-400">Loading…</p>
      </div>
    )
  }

  if (error || !account) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <p className="text-red-600 dark:text-red-400">{error ?? 'Prospect not found'}</p>
      </div>
    )
  }

  const sentAssessments = account.pillar_statuses.filter((r) => r.status !== null)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="px-6 py-8">
        <button
          onClick={() => navigate('/prospects')}
          className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 mb-4 flex items-center gap-1"
        >
          ← Prospects
        </button>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
          <h1 className="text-2xl font-bold text-[#1B2B4B] dark:text-gray-100">{account.company_name}</h1>
          {account.company_website && (
            <a
              href={account.company_website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:underline dark:text-blue-400 mt-1 block"
            >
              {account.company_website}
            </a>
          )}
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            Created by {account.internal_user_name} · {new Date(account.created_at).toLocaleDateString()}
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-[#1B2B4B] dark:text-gray-100">Assessments</h2>
          </div>

          {sentAssessments.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-gray-400 dark:text-gray-500">
              No assessments sent yet for this prospect.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Pillar</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Prospect</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Score</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">URL</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Action</th>
                </tr>
              </thead>
              <tbody>
                {sentAssessments.map((row) => (
                  <tr key={row.pillar_id} className="border-b border-gray-100 dark:border-gray-700">
                    <td className="px-4 py-3 font-medium text-[#1B2B4B] dark:text-gray-100">
                      {row.pillar_name}
                      {row.is_gated && (
                        <span className="ml-2 text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 px-1.5 py-0.5 rounded">
                          Gated
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-gray-800 dark:text-gray-200">{row.prospect_name ?? '—'}</div>
                      {row.prospect_email && (
                        <div className="text-xs text-gray-400 dark:text-gray-500">{row.prospect_email}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="px-4 py-3">
                      {row.pillar_score !== null ? (
                        <span className="font-medium text-[#1B2B4B] dark:text-gray-100">
                          {row.pillar_score.toFixed(1)} / 4.0
                        </span>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-500">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {row.short_url_token ? (
                        <CopyUrlButton token={row.short_url_token} />
                      ) : (
                        <span className="text-gray-400 dark:text-gray-500">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {row.status === 'completed' && row.assessment_id ? (
                        <button
                          onClick={() =>
                            navigate(`/dashboard/assessments/${row.assessment_id}`, {
                              state: { from: `/prospects/${id}`, fromLabel: account.company_name },
                            })
                          }
                          className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 hover:underline"
                        >
                          View Report
                        </button>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-500 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
