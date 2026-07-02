import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getAccountAggregate, getProspectDetail } from '../../api/internal'
import type { AggregateView, ProspectDetail } from '../../types'

function StatusBadge({ status }: { status: string | null }) {
  if (!status) {
    return <span className="text-xs text-gray-400 dark:text-gray-500">Not started</span>
  }
  const styles: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    in_progress: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    completed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  }
  const labels: Record<string, string> = {
    pending: 'Pending',
    in_progress: 'In Progress',
    completed: 'Completed',
  }
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${styles[status] ?? ''}`}>
      {labels[status] ?? status}
    </span>
  )
}

export default function ProspectDetailPage() {
  const { id, prospectId } = useParams<{ id: string; prospectId: string }>()
  const navigate = useNavigate()
  const [prospect, setProspect] = useState<ProspectDetail | null>(null)
  const [aggregate, setAggregate] = useState<AggregateView | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!id || !prospectId) return
    getProspectDetail(id, prospectId)
      .then((p) => {
        setProspect(p)
        const completedCount = p.assessments.filter((a) => a.status === 'completed').length
        if (completedCount >= 2) {
          getAccountAggregate(id).then(setAggregate).catch(() => null)
        }
      })
      .catch(() => setError('Failed to load prospect'))
      .finally(() => setLoading(false))
  }, [id, prospectId])

  const handleCopyUrl = () => {
    if (!prospect) return
    navigator.clipboard.writeText(prospect.full_url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-gray-500 dark:text-gray-400">Loading prospect…</div>
      </div>
    )
  }

  if (error || !prospect) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-red-600 dark:text-red-400">{error ?? 'Prospect not found'}</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="px-6 py-8 max-w-4xl mx-auto">
        <button
          onClick={() => navigate(`/dashboard/accounts/${id}`)}
          className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 mb-4 flex items-center gap-1"
        >
          ← Account
        </button>

        {/* Prospect info card */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
          <h1 className="text-xl font-bold text-[#1B2B4B] dark:text-gray-100 mb-1">
            {prospect.name ?? prospect.email}
          </h1>
          {prospect.name && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">{prospect.email}</p>
          )}
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">
            Created {new Date(prospect.created_at).toLocaleDateString()}
          </p>

          <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded p-3">
            <span className="flex-1 text-sm text-gray-700 dark:text-gray-300 font-mono break-all">
              {prospect.full_url}
            </span>
            <button
              onClick={handleCopyUrl}
              className="shrink-0 px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
            >
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          </div>
        </div>

        {/* Aggregate view — shown only when 2+ pillars completed */}
        {aggregate && aggregate.scores.length >= 2 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden mb-6">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-[#1B2B4B] dark:text-gray-100">Aggregate Score</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Combined maturity across {aggregate.completed_count} completed pillars.
              </p>
            </div>
            <div className="px-6 py-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {aggregate.scores.map((s) => (
                <div key={s.pillar_id} className="border border-gray-100 dark:border-gray-700 rounded-lg p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1">
                    {s.pillar_name}
                  </p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-[#1B2B4B] dark:text-gray-100">
                      {s.pillar_score.toFixed(1)}
                    </span>
                    <span className="text-sm text-gray-400 dark:text-gray-500">/ 4.0</span>
                    <span className="ml-auto text-xs font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">
                      {s.maturity_label}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Assessment table */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-[#1B2B4B] dark:text-gray-100">Assessments</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Status per pillar for this prospect.
            </p>
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Pillar</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Score</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Maturity</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Completed</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Report</th>
              </tr>
            </thead>
            <tbody>
              {prospect.assessments.map((row) => (
                <tr key={row.pillar_id} className="border-b border-gray-100 dark:border-gray-700 last:border-0">
                  <td className="px-4 py-3 text-gray-800 dark:text-gray-200 font-medium">{row.pillar_name}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                    {row.pillar_score != null ? row.pillar_score.toFixed(2) : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                    {row.maturity_label ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                    {row.completed_at ? new Date(row.completed_at).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {row.assessment_id && row.status === 'completed' ? (
                      <Link
                        to={`/dashboard/assessments/${row.assessment_id}`}
                        className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 hover:underline text-sm"
                      >
                        View Report
                      </Link>
                    ) : (
                      <span className="text-gray-400 dark:text-gray-500 text-sm">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
