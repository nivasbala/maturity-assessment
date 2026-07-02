import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAccounts } from '../../api/internal'
import type { AccountListItem } from '../../types'

export default function ProspectsListPage() {
  const navigate = useNavigate()
  const [accounts, setAccounts] = useState<AccountListItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const PAGE_SIZE = 25

  useEffect(() => {
    setLoading(true)
    getAccounts(page, PAGE_SIZE)
      .then((data) => {
        setAccounts(data.items)
        setTotal(data.total)
      })
      .catch(() => setError('Failed to load prospects'))
      .finally(() => setLoading(false))
  }, [page])

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#1B2B4B] dark:text-gray-100">Prospects</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {total} prospect{total !== 1 ? 's' : ''} total
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <p className="text-gray-500 dark:text-gray-400">Loading…</p>
          </div>
        ) : accounts.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
            <p className="text-gray-500 dark:text-gray-400">No prospects yet.</p>
          </div>
        ) : (
          <>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                    <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Company</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Website</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Sent</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Completed</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((account) => (
                    <tr
                      key={account.id}
                      onClick={() => navigate(`/prospects/${account.id}`)}
                      className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
                    >
                      <td className="px-4 py-3 font-medium text-blue-600 dark:text-blue-400">
                        {account.company_name}
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                        {account.company_website ? (
                          <span
                            onClick={(e) => e.stopPropagation()}
                          >
                            <a
                              href={account.company_website}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 dark:text-blue-400 hover:underline"
                            >
                              {account.company_website}
                            </a>
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{account.pillars_sent}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{account.pillars_completed}</td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                        {new Date(account.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
                <span>
                  Page {page} of {totalPages}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
