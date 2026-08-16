import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { listAllProspects, deleteProspect } from '../../api/internal'
import type { ProspectWithAccount } from '../../types'

export default function ProspectsListPage() {
  const navigate = useNavigate()
  const [prospects, setProspects] = useState<ProspectWithAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    listAllProspects()
      .then(setProspects)
      .catch(() => setError('Failed to load prospects.'))
      .finally(() => setLoading(false))
  }, [])

  const handleDelete = async (e: React.MouseEvent, p: ProspectWithAccount) => {
    e.stopPropagation()
    if (!window.confirm(`Delete prospect ${p.email}? This cannot be undone.`)) return
    setDeletingId(p.id)
    setActionError(null)
    try {
      await deleteProspect(p.account_id, p.id)
      setProspects((prev) => prev.filter((x) => x.id !== p.id))
    } catch {
      setActionError('Failed to delete prospect. Please try again.')
    } finally {
      setDeletingId(null)
    }
  }

  const filtered = prospects.filter((p) => {
    const q = search.toLowerCase()
    return (
      p.email.toLowerCase().includes(q) ||
      (p.name ?? '').toLowerCase().includes(q) ||
      p.company_name.toLowerCase().includes(q)
    )
  })

  return (
    <div className="min-h-screen">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-navy dark:text-gray-100">Prospects</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {filtered.length} prospect{filtered.length !== 1 ? 's' : ''}
              {search && ` matching "${search}"`}
            </p>
          </div>
          <input
            type="text"
            placeholder="Search by name, email, or account…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full max-w-sm px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded text-sm">
            {error}
          </div>
        )}
        {actionError && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded text-sm">
            {actionError}
          </div>
        )}

        {/* Table */}
        <div className="glass-panel rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-black/5 dark:bg-white/5 border-b border-black/10 dark:border-white/10">
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Name</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Email</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Account</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Created by</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Created</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500">
                    Loading…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500">
                    {search ? 'No prospects match your search.' : 'No prospects yet.'}
                  </td>
                </tr>
              ) : (
                filtered.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() =>
                      navigate(`/dashboard/accounts/${p.account_id}/prospects/${p.id}`, { state: { from: 'prospects' } })
                    }
                    className="border-b border-gray-100 dark:border-gray-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-navy dark:text-gray-100">
                      {p.name ?? <span className="text-gray-400 dark:text-gray-500 font-normal">—</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{p.email}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          navigate(`/dashboard/accounts/${p.account_id}`)
                        }}
                        className="text-brand hover:underline"
                      >
                        {p.company_name}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                      {p.internal_user_name || '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                      {new Date(p.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={(e) => handleDelete(e, p)}
                        disabled={deletingId === p.id}
                        title="Delete prospect"
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
        </div>
      </div>
    </div>
  )
}
