import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getSettings, updateSetting } from '../../api/admin'
import { extractApiError } from '../../api'
import { useAuth } from '../../contexts/AuthContext'
import type { SystemSetting } from '../../types'

const LABELS: Record<string, string> = {
  question_count_min: 'Min Questions Per Session',
  question_count_max: 'Max Questions Per Session',
}

const DESCRIPTIONS: Record<string, string> = {
  question_count_min: 'Hard floor — no pillar can be configured below this value.',
  question_count_max: 'Ceiling — no pillar can be configured above this value.',
}

export default function SettingsPage() {
  const { user: me, clearAuth } = useAuth()
  const navigate = useNavigate()

  const [settings, setSettings] = useState<SystemSetting[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      setSettings(await getSettings())
    } catch {
      setError('Failed to load settings.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!me) { navigate('/login'); return }
    if (me.role !== 'admin') { navigate('/dashboard'); return }
    load()
  }, [])

  const startEdit = (s: SystemSetting) => {
    setEditing(s.key)
    setEditValue(s.value)
    setSaveError(null)
  }

  const cancelEdit = () => {
    setEditing(null)
    setEditValue('')
    setSaveError(null)
  }

  const handleSave = async (key: string) => {
    setSaving(true)
    setSaveError(null)
    try {
      const updated = await updateSetting(key, editValue)
      setSettings((prev) => prev.map((s) => (s.key === key ? updated : s)))
      setEditing(null)
    } catch (e: unknown) {
      setSaveError(extractApiError(e, 'Failed to save setting.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <nav className="bg-[#1B2B4B] text-white px-6 py-3 flex items-center justify-between">
        <span className="font-semibold text-sm">Admin Panel</span>
        <div className="flex items-center gap-4 text-sm">
          <a href="/admin/users" className="text-gray-300 hover:text-white">Users</a>
          <a href="/admin/pillars" className="text-gray-300 hover:text-white">Pillars</a>
          <a href="/admin/settings" className="text-blue-300 font-medium">Settings</a>
          <button onClick={() => clearAuth().then(() => navigate('/login'))} className="text-gray-400 hover:text-white">
            Sign out
          </button>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-6 py-8">
        <h1 className="text-xl font-bold text-[#1B2B4B] mb-6">System Settings</h1>

        {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm border border-red-200">{error}</div>}
        {loading && <p className="text-gray-400 text-sm">Loading…</p>}

        <div className="space-y-4">
          {settings.map((s) => (
            <div key={s.key} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-800">{LABELS[s.key] ?? s.key}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{DESCRIPTIONS[s.key] ?? s.description}</p>
                </div>
                {editing !== s.key && (
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-lg font-bold text-[#1B2B4B]">{s.value}</span>
                    <button
                      onClick={() => startEdit(s)}
                      className="text-xs text-[#0066FF] hover:underline"
                    >
                      Edit
                    </button>
                  </div>
                )}
              </div>

              {editing === s.key && (
                <div className="mt-3 flex items-center gap-3">
                  <input
                    type="number"
                    min="1"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="w-24 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0066FF]"
                  />
                  <button
                    onClick={() => handleSave(s.key)}
                    disabled={saving || !editValue}
                    className="px-3 py-1.5 bg-[#0066FF] text-white text-xs rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
                  >
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                  <button onClick={cancelEdit} className="text-xs text-gray-500 hover:text-gray-700">
                    Cancel
                  </button>
                  {saveError && <span className="text-xs text-red-600">{saveError}</span>}
                </div>
              )}
            </div>
          ))}
        </div>

        <p className="mt-6 text-xs text-gray-400">
          Changes take effect on the next assessment session — existing in-progress assessments are not affected.
        </p>
      </div>
    </div>
  )
}
