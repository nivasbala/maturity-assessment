import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getAssessmentAnswers, getAssessmentReport } from '../../api/internal'
import { useAuth } from '../../contexts/AuthContext'
import type { AssessmentAnswers, Report } from '../../types'
import { MATURITY_COLORS, IMPACT_COLORS, EFFORT_COLORS, LEVEL_COLORS, PRIORITY_LABELS, PRIORITY_COLORS } from '../../utils/reportColors'
import { safe, triggerPdfDownload } from '../../utils/pdfDownload'
import { ScoreChart } from '../../components/ScoreChart'
import { InternalReportPdf } from '../../components/pdf/InternalReportPdf'

function ResearchPanel({ data }: { data: NonNullable<Report['research_data']> }) {
  const [open, setOpen] = useState(false)
  return (
    <section>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between text-base font-semibold text-[#1B2B4B] dark:text-gray-100 mb-3 text-left"
      >
        <span>Company Research</span>
        <span className="text-sm font-normal text-gray-400 dark:text-gray-500">{open ? '▲ Hide' : '▼ Show'}</span>
      </button>
      {open && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-4 text-sm">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-0.5">Industry</p>
              <p className="text-gray-900 dark:text-gray-100 font-medium">{data.industry || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-0.5">Company Size</p>
              <p className="text-gray-900 dark:text-gray-100 font-medium capitalize">{data.company_size || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-0.5">Builds AI Products</p>
              <p className="text-gray-900 dark:text-gray-100 font-medium">{data.builds_ai_products ? 'Yes' : 'No'}</p>
            </div>
          </div>

          {data.products_summary && (
            <div>
              <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-0.5">Products / Summary</p>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">{data.products_summary}</p>
            </div>
          )}

          {data.target_customers && data.target_customers !== 'unknown' && (
            <div>
              <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-0.5">Target Customers</p>
              <p className="text-gray-700 dark:text-gray-300">{data.target_customers}</p>
            </div>
          )}

          {data.operational_scale && data.operational_scale.length > 0 && (
            <div>
              <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">Operational Scale</p>
              <ul className="list-disc list-inside space-y-0.5 text-gray-700 dark:text-gray-300">
                {data.operational_scale.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </div>
          )}

          {(data.cloud_providers?.length ?? 0) > 0 && (
            <div>
              <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">Cloud Providers</p>
              <div className="flex flex-wrap gap-1.5">
                {data.cloud_providers.map((c, i) => (
                  <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 font-medium">{c}</span>
                ))}
              </div>
            </div>
          )}

          {(data.key_challenges?.length ?? 0) > 0 && (
            <div>
              <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">Key Challenges</p>
              <ul className="list-disc list-inside space-y-0.5 text-gray-700 dark:text-gray-300">
                {data.key_challenges.map((c, i) => <li key={i}>{c}</li>)}
              </ul>
            </div>
          )}

          {(data.business_outcomes?.length ?? 0) > 0 && (
            <div>
              <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">Business Outcomes</p>
              <ul className="list-disc list-inside space-y-0.5 text-gray-700 dark:text-gray-300">
                {data.business_outcomes.map((o, i) => <li key={i}>{o}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

async function downloadPdf(answers: AssessmentAnswers, report: Report) {
  const { pdf } = await import('@react-pdf/renderer')
  const blob = await pdf(<InternalReportPdf answers={answers} report={report} />).toBlob()
  await triggerPdfDownload(blob, `${safe(answers.company_name)}-${safe(answers.pillar_name)}-maturity-report.pdf`)
}

type Tab = 'report' | 'answers'

export default function ReportDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [answers, setAnswers] = useState<AssessmentAnswers | null>(null)
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('report')

  useEffect(() => {
    if (!user) { navigate('/login'); return }
    if (!id) return

    Promise.all([
      getAssessmentAnswers(id),
      getAssessmentReport(id).catch(() => null),
    ])
      .then(([ans, rep]) => {
        setAnswers(ans)
        setReport(rep)
      })
      .catch(() => setError('Failed to load assessment data.'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-10 text-center">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-[#1B2B4B] dark:text-gray-100 mb-1">
              Loading report…
            </h2>
          </div>
          <div className="flex justify-center mb-6">
            <div className="relative w-14 h-14">
              <div className="absolute inset-0 rounded-full border-4 border-gray-200 dark:border-gray-600" />
              <div className="absolute inset-0 rounded-full border-4 border-brand border-t-transparent animate-spin" />
            </div>
          </div>
          <div className="flex justify-center mt-4">
            <div className="inline-flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-full px-4 py-2">
              <div className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse shrink-0" />
              <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                Fetching assessment data…
              </span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error || !answers) {
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

        {/* Back + Download */}
        <div className="flex items-center justify-between gap-4">
          <button
            onClick={() => answers.prospect_id
              ? navigate(`/dashboard/accounts/${answers.account_id}/prospects/${answers.prospect_id}`)
              : navigate(`/dashboard/accounts/${answers.account_id}`)
            }
            className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
          >
            ← Back to {answers.prospect_name ?? answers.company_name}
          </button>
          {report && (
            <button
              onClick={async () => {
                setDownloading(true)
                try {
                  await downloadPdf(answers, report)
                } finally {
                  setDownloading(false)
                }
              }}
              disabled={downloading}
              className={`text-sm px-4 py-2 rounded-lg font-medium transition-colors ${
                downloading
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed dark:bg-gray-600 dark:text-gray-400'
                  : 'bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-500 dark:hover:bg-blue-600'
              }`}
            >
              {downloading ? 'Generating PDF…' : 'Download PDF'}
            </button>
          )}
        </div>

        {/* Header */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-[#1B2B4B] dark:text-gray-100">
                {answers.pillar_name}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{answers.company_name}</p>
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

        {/* Tabs */}
        <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
          {(['report', 'answers'] as Tab[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeTab === tab
                  ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {tab === 'report' ? 'Report' : 'Raw Answers'}
            </button>
          ))}
        </div>

        {/* Report tab */}
        {activeTab === 'report' && (
          report ? (
            <>
              {/* Company Research */}
              {report.research_data && report.research_data.company_name && (
                <ResearchPanel data={report.research_data} />
              )}

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

              {/* Maturity Score Chart */}
              <section>
                <h2 className="text-base font-semibold text-[#1B2B4B] dark:text-gray-100 mb-3">
                  Maturity Score
                </h2>
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                    Score range: 1 (Initial) → 4 (Optimized)
                  </p>
                  <ScoreChart report={report} />
                </div>
              </section>

              {/* Strengths */}
              {(report.strengths?.length ?? 0) > 0 && (
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
              {(report.gap_analysis?.length ?? 0) > 0 && (
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
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${EFFORT_COLORS[g.effort] ?? ''}`}>
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
              {(report.next_steps?.length ?? 0) > 0 && (
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
          )
        )}

        {/* Raw Answers tab */}
        {activeTab === 'answers' && (
          <section>
            {(answers.answers?.length ?? 0) === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-500">No answers recorded.</p>
            ) : (
              <div className="space-y-2">
                {(answers.answers ?? []).map((row, i) => (
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
        )}
      </div>
    </div>
  )
}
