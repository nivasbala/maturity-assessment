import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createPillar, deactivatePillar, getPillars, getSettings, updatePillar } from '../../api/admin'
import { extractApiError } from '../../api'
import { useAuth } from '../../contexts/AuthContext'
import type { Pillar } from '../../types'

const EMPTY_FORM = {
  name: '',
  description: '',
  overall_weight: 1.0,
  display_order: 1,
  is_gated: false,
  gate_question: '',
  question_count: 12,
}

export default function PillarsPage() {
  const { user: me } = useAuth()
  const navigate = useNavigate()

  const [pillars, setPillars] = useState<Pillar[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [qMin, setQMin] = useState(12)
  const [qMax, setQMax] = useState(25)

  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Pillar | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const load = async (p = page) => {
    setLoading(true)
    setError(null)
    try {
      const data = await getPillars(p)
      setPillars(data.items)
      setTotal(data.total)
    } catch {
      setError('Failed to load pillars.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!me) { navigate('/login'); return }
    if (me.role !== 'admin') { navigate('/dashboard'); return }
    getSettings()
      .then((rows) => {
        const minRow = rows.find((r) => r.key === 'question_count_min')
        const maxRow = rows.find((r) => r.key === 'question_count_max')
        if (minRow) setQMin(parseInt(minRow.value, 10))
        if (maxRow) setQMax(parseInt(maxRow.value, 10))
      })
      .catch(() => { setError('Failed to load system settings. Question count bounds may be inaccurate.') })
  }, [])

  useEffect(() => {
    if (!me) return
    load()
  }, [page])

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setFormError(null)
    setShowModal(true)
  }

  const openEdit = (p: Pillar) => {
    setEditing(p)
    setForm({
      name: p.name,
      description: p.description,
      overall_weight: p.overall_weight,
      display_order: p.display_order,
      is_gated: p.is_gated,
      gate_question: p.gate_question ?? '',
      question_count: p.question_count,
    })
    setFormError(null)
    setShowModal(true)
  }

  const handleSave = async () => {
    setFormError(null)
    setSaving(true)
    try {
      const payload = {
        ...form,
        gate_question: form.is_gated && form.gate_question ? form.gate_question : null,
      }
      if (editing) {
        await updatePillar(editing.id, payload)
      } else {
        await createPillar(payload)
      }
      setShowModal(false)
      load()
    } catch (e: unknown) {
      setFormError(extractApiError(e, 'Failed to save pillar.'))
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (p: Pillar) => {
    const action = p.is_active ? 'Deactivate' : 'Activate'
    if (!confirm(`${action} pillar "${p.name}"?`)) return
    try {
      if (p.is_active) {
        await deactivatePillar(p.id)
      } else {
        await updatePillar(p.id, { is_active: true })
      }
      load()
    } catch {
      alert('Failed to update pillar.')
    }
  }

  const totalPages = Math.ceil(total / 25)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-[#1B2B4B] dark:text-gray-100">Pillars</h1>
          <button
            onClick={openCreate}
            className="bg-brand text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            + New Pillar
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
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Order</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Weight</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Gated</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Qs/Session</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500">Loading…</td></tr>
              )}
              {!loading && pillars.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500">No pillars found.</td></tr>
              )}
              {pillars.map((p) => (
                <tr key={p.id} className="border-t border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
                    {p.name}
                    <Link to={`/admin/pillars/${p.id}/questions`} className="ml-2 text-xs text-brand hover:underline">
                      Questions →
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{p.display_order}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{p.overall_weight}</td>
                  <td className="px-4 py-3">
                    {p.is_gated
                      ? <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">Gated</span>
                      : <span className="text-xs text-gray-400 dark:text-gray-500">—</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{p.question_count}</td>
                  <td className="px-4 py-3">
                    {p.is_active
                      ? <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">Active</span>
                      : <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">Inactive</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <button onClick={() => openEdit(p)} className="text-xs text-brand hover:underline">Edit</button>
                      <button onClick={() => handleToggleActive(p)} className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200">
                        {p.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
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
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-[#1B2B4B] dark:text-gray-100 mb-4">{editing ? 'Edit Pillar' : 'New Pillar'}</h2>

            {formError && (
              <div className="mb-3 p-2 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm rounded border border-red-200 dark:border-red-800">
                {formError}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Overall Weight</label>
                  <input
                    type="number"
                    step="0.05"
                    min="0.1"
                    value={form.overall_weight}
                    onChange={(e) => setForm({ ...form, overall_weight: parseFloat(e.target.value) })}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Display Order</label>
                  <input
                    type="number"
                    min="1"
                    value={form.display_order}
                    onChange={(e) => setForm({ ...form, display_order: parseInt(e.target.value) })}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Questions Per Session
                  <span className="ml-1 text-xs text-gray-400 dark:text-gray-500 font-normal">(min {qMin} — max {qMax})</span>
                </label>
                <input
                  type="number"
                  min={qMin}
                  max={qMax}
                  value={form.question_count}
                  onChange={(e) => { const v = parseInt(e.target.value, 10); setForm({ ...form, question_count: isNaN(v) ? qMin : v }) }}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_gated"
                  checked={form.is_gated}
                  onChange={(e) => setForm({ ...form, is_gated: e.target.checked })}
                  className="rounded"
                />
                <label htmlFor="is_gated" className="text-sm font-medium text-gray-700 dark:text-gray-300">Gated pillar</label>
              </div>
              {form.is_gated && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Gate Question</label>
                  <textarea
                    value={form.gate_question}
                    onChange={(e) => setForm({ ...form, gate_question: e.target.value })}
                    rows={2}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand"
                  />
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => { setShowModal(false); setFormError(null) }}
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.name || !form.description}
                className="px-4 py-2 bg-brand text-white text-sm rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving…' : (editing ? 'Save Changes' : 'Create Pillar')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
