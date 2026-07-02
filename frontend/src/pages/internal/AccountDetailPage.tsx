import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { createProspect, deleteAccount, deleteProspect, getAccountDetail, listProspects } from '../../api/internal'
import type { AccountDetail, Prospect } from '../../types'

function CreateProspectModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (prospect: Prospect) => void
}) {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { id } = useParams<{ id: string }>()

  const handleSubmit = async () => {
    if (!id || !email.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      const prospect = await createProspect(id, { email: email.trim(), name: name.trim() || null })
      onCreated(prospect)
    } catch {
      setError('Failed to create prospect. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6">
        <h2 className="text-xl font-semibold text-[#1B2B4B] dark:text-gray-100 mb-1">Create Prospect</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
          Enter the prospect's email to generate their personalised assessment link.
        </p>

        <div className="space-y-3 mb-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jane@company.com"
              className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Name <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jane Smith"
              className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400 mb-3">{error}</p>
        )}

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !email.trim()}
            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed dark:bg-blue-500 dark:hover:bg-blue-600"
          >
            {submitting ? 'Creating…' : 'Create Prospect'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ProspectUrlModal({
  prospect,
  onClose,
}: {
  prospect: Prospect
  onClose: () => void
}) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(prospect.full_url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg p-6">
        <h2 className="text-xl font-semibold text-[#1B2B4B] dark:text-gray-100 mb-1">Prospect Created</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Share this link with <strong className="text-gray-700 dark:text-gray-300">{prospect.name ?? prospect.email}</strong> to start their assessment.
        </p>

        <div className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded p-3 flex items-center gap-2 mb-5">
          <span className="flex-1 text-sm text-gray-800 dark:text-gray-200 break-all font-mono">{prospect.full_url}</span>
          <button
            onClick={handleCopy}
            className="shrink-0 px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 focus:outline-none dark:bg-blue-500 dark:hover:bg-blue-600"
          >
            {copied ? '✓ Copied' : 'Copy'}
          </button>
        </div>

        <div className="flex justify-end">
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
          This will permanently delete all prospects and assessments for this account.
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
  const [prospects, setProspects] = useState<Prospect[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createdProspect, setCreatedProspect] = useState<Prospect | null>(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [copyStates, setCopyStates] = useState<Record<string, boolean>>({})
  const [deletingProspectId, setDeletingProspectId] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    Promise.all([getAccountDetail(id), listProspects(id)])
      .then(([acc, pros]) => {
        setAccount(acc)
        setProspects(pros)
      })
      .catch(() => setError('Failed to load account'))
      .finally(() => setLoading(false))
  }, [id])

  const handleProspectCreated = (prospect: Prospect) => {
    setProspects((prev) => [prospect, ...prev])
    setShowCreateModal(false)
    setCreatedProspect(prospect)
  }

  const handleCopy = (prospect: Prospect) => {
    navigator.clipboard.writeText(prospect.full_url).then(() => {
      setCopyStates((s) => ({ ...s, [prospect.id]: true }))
      setTimeout(() => setCopyStates((s) => ({ ...s, [prospect.id]: false })), 2000)
    })
  }

  const handleDeleteProspect = async (prospect: Prospect) => {
    if (!id) return
    if (!window.confirm(`Delete prospect ${prospect.email}? This cannot be undone.`)) return
    setDeletingProspectId(prospect.id)
    try {
      await deleteProspect(id, prospect.id)
      setProspects((prev) => prev.filter((p) => p.id !== prospect.id))
    } catch {
      setActionError('Failed to delete prospect. Please try again.')
    } finally {
      setDeletingProspectId(null)
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
      <div className="px-6 py-8 max-w-4xl mx-auto">
        <button
          onClick={() => navigate('/dashboard')}
          className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 mb-4 flex items-center gap-1"
        >
          ← Accounts
        </button>

        {/* Account header */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
          <div className="flex items-start justify-between">
            <div>
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

        {/* Prospects section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-[#1B2B4B] dark:text-gray-100">Prospects</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Each prospect gets a unique assessment link.
              </p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors dark:bg-blue-500 dark:hover:bg-blue-600"
            >
              + Create Prospect
            </button>
          </div>

          {prospects.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">No prospects yet for this account.</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium dark:bg-blue-500 dark:hover:bg-blue-600"
              >
                + Create Prospect
              </button>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Email</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Name</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Created</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Action</th>
                </tr>
              </thead>
              <tbody>
                {prospects.map((p) => (
                  <tr key={p.id} className="border-b border-gray-100 dark:border-gray-700 last:border-0">
                    <td className="px-4 py-3">
                      <Link
                        to={`/dashboard/accounts/${id}/prospects/${p.id}`}
                        className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 hover:underline"
                      >
                        {p.email}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{p.name ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                      {new Date(p.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleCopy(p)}
                          className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 hover:underline"
                        >
                          {copyStates[p.id] ? '✓ Copied' : 'Copy URL'}
                        </button>
                        <button
                          onClick={() => handleDeleteProspect(p)}
                          disabled={deletingProspectId === p.id}
                          title="Delete prospect"
                          className="text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-40"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showCreateModal && (
        <CreateProspectModal
          onClose={() => setShowCreateModal(false)}
          onCreated={handleProspectCreated}
        />
      )}

      {createdProspect && (
        <ProspectUrlModal
          prospect={createdProspect}
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
