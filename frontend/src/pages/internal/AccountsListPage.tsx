import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createAccount, getAccounts, getActivePillars } from '../../api/internal'
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
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <h2 className="text-xl font-semibold text-[#1B2B4B] mb-4">New Account</h2>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded text-sm">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Company Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0066FF]"
              placeholder="Acme Corp"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Website
            </label>
            <input
              type="text"
              value={companyWebsite}
              onChange={(e) => setCompanyWebsite(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0066FF]"
              placeholder="https://acmecorp.com"
            />
          </div>

          {pillars.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Suggested Pillars
              </label>
              <div className="space-y-2">
                {pillars.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedPillars.includes(p.id)}
                      onChange={() => togglePillar(p.id)}
                      className="rounded border-gray-300 text-[#0066FF] focus:ring-[#0066FF]"
                    />
                    <span className="text-sm text-gray-700">{p.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-4 py-2 text-sm text-white bg-[#0066FF] rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Creating…' : 'Create Account'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AccountsListPage() {
  const navigate = useNavigate()
  const [accounts, setAccounts] = useState<AccountListItem[]>([])
  const [pillars, setPillars] = useState<Pillar[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)

  const PAGE_SIZE = 25

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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading accounts…</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#1B2B4B]">Accounts</h1>
            <p className="text-sm text-gray-500 mt-1">{total} account{total !== 1 ? 's' : ''}</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-[#0066FF] text-white text-sm font-medium rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-[#0066FF] focus:ring-offset-2"
          >
            New Account
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded text-sm">
            {error}
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Company</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Website</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Suggested Pillars</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Date Created</th>
              </tr>
            </thead>
            <tbody>
              {accounts.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                    No accounts yet. Click "New Account" to get started.
                  </td>
                </tr>
              ) : (
                accounts.map((a) => (
                  <tr
                    key={a.id}
                    onClick={() => navigate(`/dashboard/accounts/${a.id}`)}
                    className="border-b border-gray-100 hover:bg-blue-50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-[#1B2B4B]">{a.company_name}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {a.company_website ? (
                        <a
                          href={a.company_website}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-[#0066FF] hover:underline"
                        >
                          {a.company_website.replace(/^https?:\/\//, '')}
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {a.suggested_pillars.length > 0 ? a.suggested_pillars.length : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(a.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Pagination */}
          {total > PAGE_SIZE && (
            <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between text-sm text-gray-500">
              <span>
                Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1 border rounded disabled:opacity-40 hover:bg-gray-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page * PAGE_SIZE >= total}
                  className="px-3 py-1 border rounded disabled:opacity-40 hover:bg-gray-50"
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
