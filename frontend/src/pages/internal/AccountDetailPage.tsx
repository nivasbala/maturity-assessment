import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { createProspect, deleteAccount, getAccountDetail, getActivePillars } from '../../api/internal'
import type { AccountDetail, Pillar, ProspectCreated } from '../../types'

const BASE_URL = window.location.origin

function AddProspectModal({
  accountId,
  pillars,
  onClose,
  onCreated,
}: {
  accountId: string
  pillars: Pillar[]
  onClose: () => void
  onCreated: (result: ProspectCreated) => void
}) {
  const [email, setEmail] = useState('')
  const [selectedPillars, setSelectedPillars] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const togglePillar = (id: string) =>
    setSelectedPillars((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]))

  const handleSubmit = async () => {
    if (!email.trim()) {
      setError('Email is required')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const result = await createProspect(accountId, {
        email: email.trim(),
        suggested_pillars: selectedPillars,
      })
      onCreated(result)
    } catch (err: unknown) {
      const anyErr = err as { response?: { status?: number } }
      if (anyErr?.response?.status === 409) {
        setError('A prospect with this email already exists for this account.')
      } else {
        setError('Failed to create prospect. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6">
        <h2 className="text-xl font-semibold text-[#1B2B4B] dark:text-gray-100 mb-4">Add Prospect</h2>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded text-sm">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Prospect Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
              placeholder="jane@company.com"
            />
          </div>

          {pillars.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Suggested Pillars <span className="text-xs font-normal text-gray-500">(optional)</span>
              </label>
              <div className="space-y-2">
                {pillars.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedPillars.includes(p.id)}
                      onChange={() => togglePillar(p.id)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-600"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">{p.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 rounded disabled:opacity-50"
          >
            {loading ? 'Creating…' : 'Create Prospect'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ProspectCreatedModal({
  result,
  onClose,
}: {
  result: ProspectCreated
  onClose: () => void
}) {
  const [copied, setCopied] = useState(false)
  const fullUrl = `${BASE_URL}/assess/${result.short_url_token}`

  const handleCopy = () => {
    navigator.clipboard.writeText(fullUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg p-6">
        <h2 className="text-xl font-semibold text-[#1B2B4B] dark:text-gray-100 mb-2">Prospect Created</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Share this link with <span className="font-medium text-gray-700 dark:text-gray-300">{result.email}</span> to start their assessment.
        </p>
        <div className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded p-3 flex items-center gap-2">
          <span className="flex-1 text-sm text-gray-800 dark:text-gray-200 break-all font-mono">{fullUrl}</span>
          <button
            onClick={handleCopy}
            className="shrink-0 px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded focus:outline-none"
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
          Are you sure you want to delete{' '}
          <span className="font-medium text-gray-800 dark:text-gray-200">{companyName}</span>?
          This will permanently delete all prospects, assessments, and reports.
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
            {deleting ? 'Deleting…' : 'Delete Account'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AccountDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [account, setAccount] = useState<AccountDetail | null>(null)
  const [pillars, setPillars] = useState<Pillar[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [createdProspect, setCreatedProspect] = useState<ProspectCreated | null>(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    Promise.all([getAccountDetail(id), getActivePillars()])
      .then(([acct, pillarList]) => {
        setAccount(acct)
        setPillars(pillarList)
      })
      .catch(() => setError('Failed to load account'))
      .finally(() => setLoading(false))
  }, [id])

  const handleProspectCreated = async (result: ProspectCreated) => {
    setShowAddModal(false)
    setCreatedProspect(result)
    if (id) {
      const updated = await getAccountDetail(id).catch(() => null)
      if (updated) setAccount(updated)
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
          className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 mb-4 flex items-center gap-1"
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
                  className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 mt-1 block"
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
              className="shrink-0 px-3 py-1.5 text-sm border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
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
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[#1B2B4B] dark:text-gray-100">
              Prospects{' '}
              <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
                ({account.prospects.length})
              </span>
            </h2>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white rounded focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
            >
              + Add Prospect
            </button>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Email</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Name</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Assessments</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">URL</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Created</th>
              </tr>
            </thead>
            <tbody>
              {account.prospects.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500">
                    No prospects yet. Click "+ Add Prospect" to get started.
                  </td>
                </tr>
              ) : (
                account.prospects.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => navigate(`/dashboard/accounts/${id}/prospects/${p.id}`)}
                    className="border-b border-gray-100 dark:border-gray-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-[#1B2B4B] dark:text-gray-100">{p.email}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{p.name ?? '—'}</td>
                    <td className="px-4 py-3">
                      {p.is_registered ? (
                        <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                          Registered
                        </span>
                      ) : (
                        <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                      {p.assessments_completed}/{p.assessments_total}
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      {p.short_url_token && (
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(`${BASE_URL}/assess/${p.short_url_token}`)
                          }}
                          className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 underline"
                        >
                          Copy URL
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                      {new Date(p.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showAddModal && (
        <AddProspectModal
          accountId={id!}
          pillars={pillars}
          onClose={() => setShowAddModal(false)}
          onCreated={handleProspectCreated}
        />
      )}

      {createdProspect && (
        <ProspectCreatedModal
          result={createdProspect}
          onClose={() => setCreatedProspect(null)}
        />
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
