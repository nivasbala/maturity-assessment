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
  const { user: me } = useAuth()
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-2xl mx-auto px-6 py-8">
        <h1 className="text-xl font-bold text-[#1B2B4B] dark:text-gray-100 mb-6">System Settings</h1>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg text-sm border border-red-200 dark:border-red-800">
            {error}
          </div>
        )}
        {loading && <p className="text-gray-400 dark:text-gray-500 text-sm">Loading…</p>}

        <div className="space-y-4">
          {settings.map((s) => (
            <div key={s.key} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{LABELS[s.key] ?? s.key}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{DESCRIPTIONS[s.key] ?? s.description}</p>
                </div>
                {editing !== s.key && (
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-lg font-bold text-[#1B2B4B] dark:text-gray-100">{s.value}</span>
                    <button
                      onClick={() => startEdit(s)}
                      className="text-xs text-[#4F46E5] hover:underline"
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
                    min={s.key === 'question_count_min' ? 12 : 1}
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="w-24 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#4F46E5]"
                  />
                  <button
                    onClick={() => handleSave(s.key)}
                    disabled={saving || !editValue || (s.key === 'question_count_min' && parseInt(editValue, 10) < 12)}
                    className="px-3 py-1.5 bg-[#2563EB] text-white text-xs rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
                  >
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                  <button onClick={cancelEdit} className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
                    Cancel
                  </button>
                  {saveError && <span className="text-xs text-red-600 dark:text-red-400">{saveError}</span>}
                </div>
              )}
            </div>
          ))}
        </div>

        <p className="mt-6 text-xs text-gray-400 dark:text-gray-500">
          Changes take effect on the next assessment session — existing in-progress assessments are not affected.
        </p>
      </div>
    </div>
  )
}
