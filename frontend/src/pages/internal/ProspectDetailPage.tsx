import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer,
} from 'recharts'
import { getProspectDetail, getProspectAggregate, resetAssessment } from '../../api/internal'
import type { ProspectDetail, ProspectAggregate } from '../../types'

type Tab = 'assessments' | 'aggregate'

const TABS: { key: Tab; label: string }[] = [
  { key: 'assessments', label: 'Assessments' },
  { key: 'aggregate', label: 'Aggregate View' },
]

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
  const location = useLocation()
  const fromProspectsList = (location.state as { from?: string } | null)?.from === 'prospects'
  const [prospect, setProspect] = useState<ProspectDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [resettingId, setResettingId] = useState<string | null>(null)
  const [resetError, setResetError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('assessments')
  const [aggregate, setAggregate] = useState<ProspectAggregate | null>(null)
  const [aggregateLoading, setAggregateLoading] = useState(false)
  const [aggregateError, setAggregateError] = useState<string | null>(null)
  const [aggregateFetched, setAggregateFetched] = useState(false)

  useEffect(() => {
    if (!id || !prospectId) return
    getProspectDetail(id, prospectId)
      .then(setProspect)
      .catch(() => setError('Failed to load prospect'))
      .finally(() => setLoading(false))
  }, [id, prospectId])

  const completedWithScoreCount = prospect
    ? prospect.assessments.filter((a) => a.status === 'completed' && a.pillar_score != null).length
    : 0

  useEffect(() => {
    if (activeTab !== 'aggregate' || aggregateFetched || !id || !prospectId) return
    setAggregateFetched(true)
    setAggregateLoading(true)
    setAggregateError(null)
    getProspectAggregate(id, prospectId)
      .then(setAggregate)
      .catch((err: unknown) => {
        const status = (err as { response?: { status?: number } })?.response?.status
        setAggregateError(
          status === 404
            ? 'Aggregate view requires at least 2 completed assessments.'
            : 'Failed to load aggregate view. Please try again.'
        )
      })
      .finally(() => setAggregateLoading(false))
  }, [activeTab, aggregateFetched, id, prospectId])

  const handleResetAssessment = async (assessmentId: string, pillarName: string) => {
    if (!window.confirm(`Reset the "${pillarName}" assessment? This will clear all answers, scores, and the report. The prospect can retake it using the same link.`)) return
    setResettingId(assessmentId)
    setResetError(null)
    try {
      await resetAssessment(assessmentId)
      setProspect((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          assessments: prev.assessments.map((a) =>
            a.assessment_id === assessmentId
              ? { ...a, status: 'pending', pillar_score: null, maturity_label: null, completed_at: null }
              : a
          ),
        }
      })
      setAggregateFetched(false)
      setAggregate(null)
    } catch {
      setResetError('Failed to reset assessment. Please try again.')
    } finally {
      setResettingId(null)
    }
  }

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
          onClick={() => fromProspectsList ? navigate('/prospects') : navigate(`/dashboard/accounts/${id}`)}
          className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 mb-4 flex items-center gap-1"
        >
          {fromProspectsList ? '← Prospects' : '← Account'}
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

        {resetError && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded text-sm">
            {resetError}
          </div>
        )}

        {/* Tab bar */}
        <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700 mb-6">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeTab === tab.key
                  ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'assessments' && (
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
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Actions</th>
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
                        className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 hover:underline text-sm whitespace-nowrap"
                      >
                        View Report
                      </Link>
                    ) : (
                      <span className="text-gray-400 dark:text-gray-500 text-sm">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {row.assessment_id && (row.status === 'in_progress' || row.status === 'completed') ? (
                      <button
                        onClick={() => handleResetAssessment(row.assessment_id!, row.pillar_name)}
                        disabled={resettingId === row.assessment_id}
                        className="text-sm text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300 disabled:opacity-40"
                      >
                        {resettingId === row.assessment_id ? 'Resetting…' : 'Reset'}
                      </button>
                    ) : (
                      <span className="text-gray-400 dark:text-gray-500 text-sm">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}

        {activeTab === 'aggregate' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden p-6">
            {completedWithScoreCount < 2 && !aggregateLoading ? (
              <p className="text-sm text-gray-400 dark:text-gray-500">
                Aggregate view requires at least 2 completed assessments for this prospect.
              </p>
            ) : aggregateLoading ? (
              <p className="text-sm text-gray-400 dark:text-gray-500">Loading aggregate view…</p>
            ) : aggregateError ? (
              <p className="text-sm text-red-600 dark:text-red-400">{aggregateError}</p>
            ) : aggregate ? (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-semibold text-[#1B2B4B] dark:text-gray-100">Aggregate View</h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Maturity across all {aggregate.completed_count} completed pillars for this prospect.
                  </p>
                </div>

                <ResponsiveContainer width="100%" height={280}>
                  <RadarChart
                    cx="50%" cy="50%" outerRadius="75%"
                    data={aggregate.assessments.map((a) => ({ subject: a.pillar_name, score: a.pillar_score, fullMark: 4 }))}
                  >
                    <PolarGrid stroke="#e5e7eb" />
                    <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12, fill: '#6b7280' }} />
                    <PolarRadiusAxis domain={[0, 4]} tick={{ fontSize: 10, fill: '#9ca3af' }} />
                    <Radar name="Score" dataKey="score" stroke="#2563eb" fill="#2563eb" fillOpacity={0.25} />
                  </RadarChart>
                </ResponsiveContainer>

                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                      <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Pillar</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Score</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Maturity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {aggregate.assessments.map((row) => (
                      <tr key={row.pillar_name} className="border-b border-gray-100 dark:border-gray-700 last:border-0">
                        <td className="px-4 py-3 text-gray-800 dark:text-gray-200 font-medium">{row.pillar_name}</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{row.pillar_score.toFixed(2)}</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{row.maturity_label}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}
