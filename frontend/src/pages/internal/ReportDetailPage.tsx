import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getAssessmentAnswers, getAssessmentDetail, getAssessmentReport } from '../../api/internal'
import { useAuth } from '../../contexts/AuthContext'
import type { AssessmentAnswers, AssessmentDetail, Report } from '../../types'

const MATURITY_COLORS: Record<string, string> = {
  Reactive: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800',
  Developing: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800',
  Defined: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800',
  Optimized: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800',
}

const IMPACT_COLORS: Record<string, string> = {
  high: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
  medium: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
  low: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
}

const PRIORITY_LABELS: Record<string, string> = {
  quick_win: 'Quick Win',
  strategic: 'Strategic',
  foundational: 'Foundational',
}

const PRIORITY_COLORS: Record<string, string> = {
  quick_win: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
  strategic: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  foundational: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
}

const LEVEL_COLORS: Record<number, string> = {
  1: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
  2: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
  3: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  4: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
}

export default function ReportDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [detail, setDetail] = useState<AssessmentDetail | null>(null)
  const [answers, setAnswers] = useState<AssessmentAnswers | null>(null)
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) { navigate('/login'); return }
    if (!id) return

    Promise.all([
      getAssessmentDetail(id),
      getAssessmentAnswers(id),
      getAssessmentReport(id).catch(() => null),
    ])
      .then(([det, ans, rep]) => {
        setDetail(det)
        setAnswers(ans)
        setReport(rep)
      })
      .catch(() => setError('Failed to load assessment data.'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <p className="text-gray-500 dark:text-gray-400">Loading…</p>
      </div>
    )
  }

  if (error || !detail || !answers) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <p className="text-red-600 dark:text-red-400">{error ?? 'Assessment not found.'}</p>
      </div>
    )
  }

  const maturityClass = MATURITY_COLORS[answers.maturity_label ?? ''] ?? 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">

        {/* Back */}
        <button
          onClick={() => navigate(`/dashboard/accounts/${detail.account_id}`)}
          className="text-sm text-[#2563EB] hover:underline"
        >
          ← Back to {detail.company_name}
        </button>

        {/* Header */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-[#1B2B4B] dark:text-gray-100">
                {detail.pillar_name}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{detail.company_name}</p>
            </div>
            {answers.maturity_label && answers.pillar_score != null && (
              <div className="text-right shrink-0">
                <span className={`inline-block text-sm font-semibold px-3 py-1 rounded-full border ${maturityClass}`}>
                  {answers.maturity_label}
                </span>
                <p className="text-2xl font-bold text-[#1B2B4B] dark:text-gray-100 mt-1">
                  {answers.pillar_score.toFixed(2)}
                  <span className="text-sm font-normal text-gray-400 dark:text-gray-500"> / 4.00</span>
                </p>
              </div>
            )}
          </div>

          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide mb-0.5">Prospect</p>
              <p className="text-gray-900 dark:text-gray-100 font-medium">{answers.prospect_name ?? '—'}</p>
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide mb-0.5">Role</p>
              <p className="text-gray-900 dark:text-gray-100 font-medium">{answers.prospect_role ?? '—'}</p>
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide mb-0.5">Email</p>
              <p className="text-gray-900 dark:text-gray-100 font-medium">{answers.prospect_email ?? '—'}</p>
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide mb-0.5">Completed</p>
              <p className="text-gray-900 dark:text-gray-100 font-medium">
                {answers.completed_at ? new Date(answers.completed_at).toLocaleDateString() : '—'}
              </p>
            </div>
          </div>
        </div>

        {/* Raw answers */}
        <section>
          <h2 className="text-base font-semibold text-[#1B2B4B] dark:text-gray-100 mb-3">
            Prospect Answers
          </h2>
          {answers.answers.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500">No answers recorded.</p>
          ) : (
            <div className="space-y-2">
              {answers.answers.map((row, i) => (
                <div
                  key={i}
                  className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 flex items-start gap-4"
                >
                  <span className="shrink-0 text-xs font-semibold text-gray-400 dark:text-gray-500 w-5 mt-0.5">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700 dark:text-gray-300">{row.question_text}</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mt-1">
                      {row.selected_option_text}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${LEVEL_COLORS[row.maturity_level] ?? 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}`}
                  >
                    L{row.maturity_level}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Report */}
        {report ? (
          <>
            {/* Executive Summary */}
            <section>
              <h2 className="text-base font-semibold text-[#1B2B4B] dark:text-gray-100 mb-3">
                Executive Summary
              </h2>
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                  {report.executive_summary}
                </p>
              </div>
            </section>

            {/* Strengths */}
            {report.strengths.length > 0 && (
              <section>
                <h2 className="text-base font-semibold text-[#1B2B4B] dark:text-gray-100 mb-3">
                  Strengths
                </h2>
                <div className="space-y-3">
                  {report.strengths.map((s, i) => (
                    <div
                      key={i}
                      className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 flex gap-3"
                    >
                      <span className="text-green-500 text-lg shrink-0">✓</span>
                      <div>
                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{s.title}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">{s.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Gap Analysis */}
            {report.gap_analysis.length > 0 && (
              <section>
                <h2 className="text-base font-semibold text-[#1B2B4B] dark:text-gray-100 mb-3">
                  Gap Analysis
                </h2>
                <div className="space-y-3">
                  {report.gap_analysis.map((g, i) => (
                    <div
                      key={i}
                      className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{g.gap}</p>
                        <div className="flex gap-2 shrink-0">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${IMPACT_COLORS[g.impact] ?? ''}`}>
                            {g.impact} impact
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${IMPACT_COLORS[g.effort] ?? ''}`}>
                            {g.effort} effort
                          </span>
                        </div>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-0.5">Current</p>
                          <p className="text-gray-600 dark:text-gray-400">{g.current_state}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-0.5">Target</p>
                          <p className="text-gray-600 dark:text-gray-400">{g.target_state}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Next Steps */}
            {report.next_steps.length > 0 && (
              <section>
                <h2 className="text-base font-semibold text-[#1B2B4B] dark:text-gray-100 mb-3">
                  Next Steps
                </h2>
                <div className="space-y-3">
                  {report.next_steps.map((n, i) => (
                    <div
                      key={i}
                      className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{n.title}</p>
                        <div className="flex gap-2 shrink-0">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[n.priority] ?? ''}`}>
                            {PRIORITY_LABELS[n.priority] ?? n.priority}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 font-medium">
                            {n.timeframe}
                          </span>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{n.description}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 text-center">
            <p className="text-sm text-gray-400 dark:text-gray-500">Report not yet generated.</p>
          </div>
        )}
      </div>
    </div>
  )
}
