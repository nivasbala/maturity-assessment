import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { deleteProspect, getAssessmentReport, getProspectDetail } from '../../api/internal'
import type { PillarStatusRow, ProspectDetail } from '../../types'

const BASE_URL = window.location.origin

function StatusBadge({ status }: { status: PillarStatusRow['status'] }) {
  if (!status) return <span className="text-gray-400 dark:text-gray-500 text-sm">Not started</span>
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

function DeleteProspectModal({
  email,
  onConfirm,
  onCancel,
  deleting,
}: {
  email: string
  onConfirm: () => void
  onCancel: () => void
  deleting: boolean
}) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6">
        <h2 className="text-xl font-semibold text-[#1B2B4B] dark:text-gray-100 mb-2">Delete Prospect</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Are you sure you want to delete prospect{' '}
          <span className="font-medium text-gray-800 dark:text-gray-200">{email}</span>?
          This will permanently remove all assessments and reports for this prospect.
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
            className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded disabled:opacity-50"
          >
            {deleting ? 'Deleting…' : 'Delete Prospect'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ProspectDetailPage() {
  const { id: accountId, prospectId } = useParams<{ id: string; prospectId: string }>()
  const navigate = useNavigate()

  const [prospect, setProspect] = useState<ProspectDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [viewingReport, setViewingReport] = useState<string | null>(null)

  useEffect(() => {
    if (!accountId || !prospectId) return
    getProspectDetail(accountId, prospectId)
      .then(setProspect)
      .catch(() => setError('Failed to load prospect'))
      .finally(() => setLoading(false))
  }, [accountId, prospectId])

  const handleDelete = async () => {
    if (!accountId || !prospectId) return
    setDeleting(true)
    try {
      await deleteProspect(accountId, prospectId)
      navigate(`/dashboard/accounts/${accountId}`)
    } catch {
      setActionError('Failed to delete prospect. Please try again.')
      setShowDeleteModal(false)
    } finally {
      setDeleting(false)
    }
  }

  const handleViewReport = async (assessmentId: string) => {
    setViewingReport(assessmentId)
    try {
      const report = await getAssessmentReport(assessmentId)
      navigate(`/dashboard/assessments/${report.id}`)
    } catch {
      setActionError('Failed to load report. Please try again.')
    } finally {
      setViewingReport(null)
    }
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

  const assessmentUrl = prospect.short_url_token
    ? `${BASE_URL}/assess/${prospect.short_url_token}`
    : null

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="px-6 py-8">
        <button
          onClick={() => navigate(`/dashboard/accounts/${accountId}`)}
          className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 mb-4 flex items-center gap-1"
        >
          ← Back to Account
        </button>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-[#1B2B4B] dark:text-gray-100">
                {prospect.name ?? prospect.email}
              </h1>
              {prospect.name && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{prospect.email}</p>
              )}
              {prospect.job_title && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{prospect.job_title}</p>
              )}
              <div className="flex items-center gap-3 mt-2">
                {prospect.is_registered ? (
                  <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                    Registered
                  </span>
                ) : (
                  <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                    Awaiting registration
                  </span>
                )}
                {assessmentUrl && (
                  <button
                    onClick={() => navigator.clipboard.writeText(assessmentUrl)}
                    className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 underline"
                  >
                    Copy assessment URL
                  </button>
                )}
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                Created {new Date(prospect.created_at).toLocaleDateString()}
              </p>
            </div>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="shrink-0 px-3 py-1.5 text-sm border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              Delete Prospect
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
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Score</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Maturity</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Action</th>
              </tr>
            </thead>
            <tbody>
              {prospect.pillar_statuses.map((row) => (
                <tr key={row.pillar_id} className="border-b border-gray-100 dark:border-gray-700">
                  <td className="px-4 py-3 font-medium text-[#1B2B4B] dark:text-gray-100">
                    {row.pillar_name}
                    {row.is_gated && (
                      <span className="ml-2 text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 px-1.5 py-0.5 rounded">
                        Gated
                      </span>
                    )}
                    {!row.is_active && (
                      <span className="ml-2 text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-1.5 py-0.5 rounded">
                        Inactive
                      </span>
                    )}
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
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                    {row.maturity_label ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="px-4 py-3">
                    {row.status === 'completed' && row.assessment_id ? (
                      <button
                        onClick={() => handleViewReport(row.assessment_id!)}
                        disabled={viewingReport === row.assessment_id}
                        className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 disabled:opacity-50"
                      >
                        {viewingReport === row.assessment_id ? 'Loading…' : 'View Report'}
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showDeleteModal && (
        <DeleteProspectModal
          email={prospect.email}
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteModal(false)}
          deleting={deleting}
        />
      )}
    </div>
  )
}
