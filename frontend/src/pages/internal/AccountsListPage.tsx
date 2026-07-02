import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createAccount, deleteAccount, getAccounts, getActivePillars } from '../../api/internal'
import { useAuth } from '../../contexts/AuthContext'
import type { AccountListItem, Pillar } from '../../types'

function NewAccountModal({
  pillars,
  onClose,
  onCreated,
}: {
  pillars: Pillar[]
  onClose: () => void
  onCreated: (account: AccountListItem) => void
}) {
  const [companyName, setCompanyName] = useState('')
  const [companyWebsite, setCompanyWebsite] = useState('')
  const [selectedPillars, setSelectedPillars] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const togglePillar = (id: string) => {
    setSelectedPillars((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    )
  }

  const handleSubmit = async () => {
    if (!companyName.trim()) {
      setError('Company name is required')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const account = await createAccount({
        company_name: companyName.trim(),
        company_website: companyWebsite.trim() || null,
        suggested_pillars: selectedPillars,
      })
      onCreated(account)
    } catch {
      setError('Failed to create account. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6">
        <h2 className="text-xl font-semibold text-[#1B2B4B] dark:text-gray-100 mb-4">New Account</h2>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded text-sm">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Company Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand"
              placeholder="Acme Corp"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Website
            </label>
            <input
              type="text"
              value={companyWebsite}
              onChange={(e) => setCompanyWebsite(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand"
              placeholder="https://acmecorp.com"
            />
          </div>

          {pillars.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Suggested Pillars
              </label>
              <div className="space-y-2">
                {pillars.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedPillars.includes(p.id)}
                      onChange={() => togglePillar(p.id)}
                      className="rounded border-gray-300 text-brand focus:ring-brand"
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
            className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-4 py-2 text-sm text-white bg-brand rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Creating…' : 'Create Account'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AccountsListPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const navigate = useNavigate()
  const [accounts, setAccounts] = useState<AccountListItem[]>([])
  const [pillars, setPillars] = useState<Pillar[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const PAGE_SIZE = 25

  const handleDelete = async (e: React.MouseEvent, accountId: string) => {
    e.stopPropagation()
    if (!window.confirm('Delete this account and all its data? This cannot be undone.')) return
    setDeletingId(accountId)
    try {
      await deleteAccount(accountId)
      setAccounts((prev) => prev.filter((a) => a.id !== accountId))
      setTotal((t) => t - 1)
    } catch {
      setError('Failed to delete account. Please try again.')
    } finally {
      setDeletingId(null)
    }
  }

  useEffect(() => {
    setLoading(true)
    Promise.all([getAccounts(page, PAGE_SIZE), getActivePillars()])
      .then(([data, pillarList]) => {
        setAccounts(data.items)
        setTotal(data.total)
        setPillars(pillarList)
      })
      .catch(() => setError('Failed to load accounts'))
      .finally(() => setLoading(false))
  }, [page])

  const handleCreated = (account: AccountListItem) => {
    setAccounts((prev) => [account, ...prev])
    setTotal((t) => t + 1)
    setShowModal(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-gray-500 dark:text-gray-400">Loading accounts…</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#1B2B4B] dark:text-gray-100">Accounts</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{total} account{total !== 1 ? 's' : ''}</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-brand text-white text-sm font-medium rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2"
          >
            New Account
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded text-sm">
            {error}
          </div>
        )}

        {/* Table */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Company</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Website</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Suggested Pillars</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Pillars Sent</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Pillars Completed</th>
                {isAdmin && (
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Created By</th>
                )}
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Date Created</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {accounts.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 8 : 7} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500">
                    No accounts yet. Click "New Account" to get started.
                  </td>
                </tr>
              ) : (
                accounts.map((a) => (
                  <tr
                    key={a.id}
                    onClick={() => navigate(`/dashboard/accounts/${a.id}`)}
                    className="border-b border-gray-100 dark:border-gray-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-[#1B2B4B] dark:text-gray-100">{a.company_name}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                      {a.company_website ? (
                        <a
                          href={a.company_website}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-brand hover:underline"
                        >
                          {a.company_website.replace(/^https?:\/\//, '')}
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                      {a.suggested_pillars.length > 0 ? a.suggested_pillars.length : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{a.pillars_sent}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{a.pillars_completed}</td>
                    {isAdmin && (
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                        {a.internal_user_name || '—'}
                      </td>
                    )}
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                      {new Date(a.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={(e) => handleDelete(e, a.id)}
                        disabled={deletingId === a.id}
                        title="Delete account"
                        className="text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-40"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Pagination */}
          {total > PAGE_SIZE && (
            <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
              <span>
                Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1 border dark:border-gray-600 rounded disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-300"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page * PAGE_SIZE >= total}
                  className="px-3 py-1 border dark:border-gray-600 rounded disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-300"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <NewAccountModal
          pillars={pillars}
          onClose={() => setShowModal(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  )
}
