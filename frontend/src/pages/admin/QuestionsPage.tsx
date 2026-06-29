import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { createQuestion, deactivateQuestion, getQuestions, updateQuestion } from '../../api/admin'
import { useAuth } from '../../contexts/AuthContext'
import type { Question } from '../../types'
import { PERSONAS } from '../../types'

const MATURITY_LABELS = ['', 'Level 1 — Reactive', 'Level 2 — Developing', 'Level 3 — Defined', 'Level 4 — Optimized']
const WEIGHT_OPTIONS = [1.0, 1.5, 2.0]

const EMPTY_FORM = {
  text: '',
  question_weight: 1.0,
  is_general: false,
  is_active: true,
  answer_options: [
    { text: '', maturity_level: 1 },
    { text: '', maturity_level: 2 },
    { text: '', maturity_level: 3 },
    { text: '', maturity_level: 4 },
  ],
  personas: [] as { persona: string; persona_weight: number }[],
}

export default function QuestionsPage() {
  const { id: pillarId } = useParams<{ id: string }>()
  const { user: me, clearAuth } = useAuth()
  const navigate = useNavigate()

  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [selected, setSelected] = useState<Question | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [isEditing, setIsEditing] = useState(false)

  const load = async () => {
    if (!pillarId) return
    setLoading(true)
    setError(null)
    try {
      const data = await getQuestions(pillarId, 1, 100)
      setQuestions(data.items)
    } catch {
      setError('Failed to load questions.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!me) { navigate('/login'); return }
    if (me.role !== 'admin') { navigate('/dashboard'); return }
    load()
  }, [pillarId])

  const startCreate = () => {
    setSelected(null)
    setIsEditing(true)
    setForm(EMPTY_FORM)
    setFormError(null)
  }

  const startEdit = (q: Question) => {
    setSelected(q)
    setIsEditing(true)
    setForm({
      text: q.text,
      question_weight: Number(q.question_weight),
      is_general: q.is_general,
      is_active: q.is_active,
      answer_options: [1, 2, 3, 4].map((level) => {
        const opt = q.answer_options.find((o) => o.maturity_level === level)
        return { text: opt?.text ?? '', maturity_level: level }
      }),
      personas: q.personas.map((p) => ({ persona: p.persona, persona_weight: Number(p.persona_weight) })),
    })
    setFormError(null)
  }

  const handleSave = async () => {
    if (!pillarId) return
    setFormError(null)
    setSaving(true)
    try {
      const payload = {
        ...form,
        personas: form.is_general ? [] : form.personas,
      }
      if (selected) {
        await updateQuestion(selected.id, payload)
      } else {
        await createQuestion(pillarId, payload)
      }
      setIsEditing(false)
      setSelected(null)
      load()
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setFormError(msg ?? 'Failed to save question.')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (q: Question) => {
    try {
      if (q.is_active) {
        await deactivateQuestion(q.id)
      } else {
        await updateQuestion(q.id, { is_active: true })
      }
      load()
    } catch {
      alert('Failed to update question.')
    }
  }

  const togglePersona = (persona: string) => {
    setForm((prev) => {
      const exists = prev.personas.find((p) => p.persona === persona)
      if (exists) {
        return { ...prev, personas: prev.personas.filter((p) => p.persona !== persona) }
      }
      return { ...prev, personas: [...prev.personas, { persona, persona_weight: 1.0 }] }
    })
  }

  const updatePersonaWeight = (persona: string, weight: number) => {
    setForm((prev) => ({
      ...prev,
      personas: prev.personas.map((p) => p.persona === persona ? { ...p, persona_weight: weight } : p),
    }))
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <nav className="bg-[#1B2B4B] text-white px-6 py-3 flex items-center justify-between">
        <span className="font-semibold text-sm">Admin Panel</span>
        <div className="flex items-center gap-4 text-sm">
          <a href="/admin/users" className="text-gray-300 hover:text-white">Users</a>
          <a href="/admin/pillars" className="text-gray-300 hover:text-white">Pillars</a>
          <button onClick={() => clearAuth().then(() => navigate('/login'))} className="text-gray-400 hover:text-white">
            Sign out
          </button>
        </div>
      </nav>

      <div className="flex h-[calc(100vh-48px)]">
        {/* Left panel — question list */}
        <div className="w-96 border-r border-gray-200 bg-white flex flex-col">
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
            <div>
              <a href="/admin/pillars" className="text-xs text-[#0066FF] hover:underline">← Pillars</a>
              <h2 className="text-sm font-bold text-[#1B2B4B] mt-0.5">Questions</h2>
            </div>
            <button
              onClick={startCreate}
              className="text-xs bg-[#0066FF] text-white px-3 py-1.5 rounded-lg font-medium hover:bg-blue-700"
            >
              + New
            </button>
          </div>

          {error && <div className="m-3 p-2 bg-red-50 text-red-700 text-xs rounded border border-red-200">{error}</div>}

          <div className="overflow-y-auto flex-1">
            {loading && <div className="px-4 py-6 text-center text-sm text-gray-400">Loading…</div>}
            {!loading && questions.length === 0 && (
              <div className="px-4 py-6 text-center text-sm text-gray-400">No questions yet.</div>
            )}
            {questions.map((q) => (
              <button
                key={q.id}
                onClick={() => startEdit(q)}
                className={`w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-blue-50 transition-colors ${selected?.id === q.id ? 'bg-blue-50 border-l-2 border-l-[#0066FF]' : ''}`}
              >
                <div className="flex items-start gap-2">
                  <span className={`mt-0.5 text-xs px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${q.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                    {q.display_order}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs text-gray-800 leading-snug line-clamp-2">{q.text}</p>
                    <div className="mt-1 flex items-center gap-2 text-xs text-gray-400">
                      {q.is_general && <span className="px-1.5 py-0.5 bg-purple-100 text-purple-600 rounded-full">General</span>}
                      <span>w: {q.question_weight}</span>
                      {!q.is_general && <span>{q.personas.length} persona{q.personas.length !== 1 ? 's' : ''}</span>}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Right panel — form */}
        <div className="flex-1 overflow-y-auto">
          {!isEditing && (
            <div className="flex items-center justify-center h-full text-sm text-gray-400">
              Select a question to edit, or click + New
            </div>
          )}

          {isEditing && (
            <div className="max-w-2xl mx-auto px-6 py-6">
              <h3 className="text-base font-bold text-[#1B2B4B] mb-4">
                {selected ? 'Edit Question' : 'New Question'}
              </h3>

              {formError && <div className="mb-3 p-2 bg-red-50 text-red-700 text-sm rounded border border-red-200">{formError}</div>}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Question Text</label>
                  <textarea
                    value={form.text}
                    onChange={(e) => setForm({ ...form, text: e.target.value })}
                    rows={3}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0066FF]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Question Weight</label>
                    <select
                      value={form.question_weight}
                      onChange={(e) => setForm({ ...form, question_weight: parseFloat(e.target.value) })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0066FF]"
                    >
                      {WEIGHT_OPTIONS.map((w) => <option key={w} value={w}>{w}</option>)}
                    </select>
                  </div>
                  <div className="flex flex-col gap-2 pt-6">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={form.is_general}
                        onChange={(e) => setForm({ ...form, is_general: e.target.checked })}
                        className="rounded"
                      />
                      <span className="font-medium text-gray-700">Show to all personas</span>
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={form.is_active}
                        onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                        className="rounded"
                      />
                      <span className="font-medium text-gray-700">Active</span>
                    </label>
                  </div>
                </div>

                {!form.is_general && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Personas</label>
                    <div className="grid grid-cols-2 gap-2">
                      {PERSONAS.map(({ value, label }) => {
                        const selected_p = form.personas.find((p) => p.persona === value)
                        return (
                          <div key={value} className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2">
                            <input
                              type="checkbox"
                              checked={!!selected_p}
                              onChange={() => togglePersona(value)}
                              className="rounded flex-shrink-0"
                            />
                            <span className="text-xs text-gray-700 flex-1 min-w-0 truncate">{label}</span>
                            {selected_p && (
                              <input
                                type="number"
                                step="0.1"
                                min="0.1"
                                max="3.0"
                                value={selected_p.persona_weight}
                                onChange={(e) => updatePersonaWeight(value, parseFloat(e.target.value))}
                                className="w-14 text-xs border border-gray-300 rounded px-1 py-0.5"
                              />
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Answer Options</label>
                  <div className="space-y-2">
                    {form.answer_options.map((opt, i) => (
                      <div key={opt.maturity_level} className="flex items-start gap-2">
                        <span className="text-xs text-gray-500 mt-2.5 w-40 flex-shrink-0">{MATURITY_LABELS[opt.maturity_level]}</span>
                        <textarea
                          value={opt.text}
                          onChange={(e) => {
                            const updated = [...form.answer_options]
                            updated[i] = { ...opt, text: e.target.value }
                            setForm({ ...form, answer_options: updated })
                          }}
                          rows={2}
                          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0066FF]"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={handleSave}
                    disabled={saving || !form.text || form.answer_options.some((o) => !o.text)}
                    className="px-4 py-2 bg-[#0066FF] text-white text-sm rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? 'Saving…' : (selected ? 'Save Changes' : 'Create Question')}
                  </button>
                  <button
                    onClick={() => { setIsEditing(false); setSelected(null) }}
                    className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
                  >
                    Cancel
                  </button>
                  {selected && (
                    <button
                      onClick={() => handleToggleActive(selected).then(() => { setIsEditing(false); setSelected(null) })}
                      className="ml-auto text-sm text-red-600 hover:text-red-800 font-medium"
                    >
                      {selected.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
