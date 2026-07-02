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
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Prospects</h1>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by name, email, or account…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-sm px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {error && (
        <p className="text-red-600 dark:text-red-400 text-sm mb-4">{error}</p>
      )}
      {actionError && (
        <p className="text-red-600 dark:text-red-400 text-sm mb-4">{actionError}</p>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-700/50 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Account</th>
              <th className="px-4 py-3">Created by</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
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
                  className="hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer"
                  onClick={() =>
                    navigate(`/dashboard/accounts/${p.account_id}/prospects/${p.id}`)
                  }
                >
                  <td className="px-4 py-3 text-gray-900 dark:text-white font-medium">
                    {p.name ?? <span className="text-gray-400 dark:text-gray-500 font-normal">—</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{p.email}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        navigate(`/dashboard/accounts/${p.account_id}`)
                      }}
                      className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 hover:underline"
                    >
                      {p.company_name}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
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

      {!loading && filtered.length > 0 && (
        <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
          {filtered.length} prospect{filtered.length !== 1 ? 's' : ''}
          {search && ` matching "${search}"`}
        </p>
      )}
    </div>
  )
}
