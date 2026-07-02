import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listAllProspects } from '../../api/internal'
import type { ProspectListItem } from '../../types'

export default function ProspectsListPage() {
  const [prospects, setProspects] = useState<ProspectListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [copyStates, setCopyStates] = useState<Record<string, boolean>>({})

  useEffect(() => {
    listAllProspects()
      .then(setProspects)
      .catch(() => setError('Failed to load prospects'))
      .finally(() => setLoading(false))
  }, [])

  const handleCopy = (prospect: ProspectListItem) => {
    navigator.clipboard.writeText(prospect.full_url).then(() => {
      setCopyStates((s) => ({ ...s, [prospect.id]: true }))
      setTimeout(() => setCopyStates((s) => ({ ...s, [prospect.id]: false })), 2000)
    })
  }

  const filtered = prospects.filter((p) => {
    const q = search.toLowerCase()
    return (
      p.email.toLowerCase().includes(q) ||
      (p.name ?? '').toLowerCase().includes(q) ||
      p.company_name.toLowerCase().includes(q)
    )
  })

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-gray-500 dark:text-gray-400">Loading prospects…</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-red-600 dark:text-red-400">{error}</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="px-6 py-8 max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#1B2B4B] dark:text-gray-100">Prospects</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            All prospects across your accounts.
          </p>
        </div>

        <div className="mb-4">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by email, name, or account…"
            className="w-full max-w-sm border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          {filtered.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                {search ? 'No prospects match your search.' : 'No prospects yet.'}
              </p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Email</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Name</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Account</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Created</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className="border-b border-gray-100 dark:border-gray-700 last:border-0">
                    <td className="px-4 py-3">
                      <Link
                        to={`/dashboard/accounts/${p.account_id}/prospects/${p.id}`}
                        className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 hover:underline"
                      >
                        {p.email}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{p.name ?? '—'}</td>
                    <td className="px-4 py-3">
                      <Link
                        to={`/dashboard/accounts/${p.account_id}`}
                        className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 hover:underline"
                      >
                        {p.company_name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                      {new Date(p.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleCopy(p)}
                        className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 hover:underline"
                      >
                        {copyStates[p.id] ? '✓ Copied' : 'Copy URL'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {filtered.length > 0 && (
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
            {filtered.length} prospect{filtered.length !== 1 ? 's' : ''}
            {search ? ' found' : ' total'}
          </p>
        )}
      </div>
    </div>
  )
}
