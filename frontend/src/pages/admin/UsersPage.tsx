import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createUser, deactivateUser, getUsers } from '../../api/admin'
import { extractApiError } from '../../api'
import { useAuth } from '../../contexts/AuthContext'
import type { User } from '../../types'

export default function UsersPage() {
  const { user: me } = useAuth()
  const navigate = useNavigate()

  const [users, setUsers] = useState<User[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const load = async (p = page) => {
    setLoading(true)
    setError(null)
    try {
      const data = await getUsers(p)
      setUsers(data.items)
      setTotal(data.total)
    } catch {
      setError('Failed to load users.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!me) { navigate('/login'); return }
    if (me.role !== 'admin') { navigate('/dashboard'); return }
    load()
  }, [page])

  const handleCreate = async () => {
    setFormError(null)
    setSaving(true)
    try {
      await createUser(form)
      setShowModal(false)
      setForm({ name: '', email: '', password: '' })
      load()
    } catch (e: unknown) {
      setFormError(extractApiError(e, 'Failed to create user.'))
    } finally {
      setSaving(false)
    }
  }

  const handleDeactivate = async (id: string) => {
    if (!confirm('Deactivate this user?')) return
    try {
      await deactivateUser(id)
      load()
    } catch {
      alert('Failed to deactivate user.')
    }
  }

  const totalPages = Math.ceil(total / 25)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-[#1B2B4B] dark:text-gray-100">Internal Users</h1>
          <button
            onClick={() => setShowModal(true)}
            className="bg-[#4F46E5] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            + New User
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg text-sm border border-red-200 dark:border-red-800">
            {error}
          </div>
        )}

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Name</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Email</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Role</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Created</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500">Loading…</td></tr>
              )}
              {!loading && users.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500">No users found.</td></tr>
              )}
              {users.map((u) => (
                <tr key={u.id} className="border-t border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{u.name}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-medium">
                      {u.role === 'admin' ? 'Admin' : 'Internal User'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {u.is_active
                      ? <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">Active</span>
                      : <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">Inactive</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{new Date(u.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right">
                    {u.is_active && u.id !== me?.id && (
                      <button
                        onClick={() => handleDeactivate(u.id)}
                        className="text-xs text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 font-medium"
                      >
                        Deactivate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="mt-4 flex items-center gap-2 justify-end text-sm">
            <button
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
              className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded disabled:opacity-40 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Prev
            </button>
            <span className="text-gray-600 dark:text-gray-400">{page} / {totalPages}</span>
            <button
              disabled={page === totalPages}
              onClick={() => setPage(page + 1)}
              className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded disabled:opacity-40 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-[#1B2B4B] dark:text-gray-100 mb-4">New Internal User</h2>

            {formError && (
              <div className="mb-3 p-2 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm rounded border border-red-200 dark:border-red-800">
                {formError}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Full Name</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#4F46E5]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#4F46E5]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#4F46E5]"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => { setShowModal(false); setFormError(null); setForm({ name: '', email: '', password: '' }) }}
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={saving || !form.name || !form.email || !form.password}
                className="px-4 py-2 bg-[#4F46E5] text-white text-sm rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Creating…' : 'Create User'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
