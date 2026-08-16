import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getReport } from '../../api/public'
import { extractApiError } from '../../api'
import type { ReportPublic } from '../../types'
import ProspectHeader from '../../components/ProspectHeader'
import AgentLoadingScreen from '../../components/AgentLoadingScreen'
import { AGENT_TIMING } from '../../utils/agentTiming'
import PdfThemeModal from '../../components/PdfThemeModal'
import { MATURITY_COLORS, IMPACT_COLORS, EFFORT_COLORS, LEVEL_COLORS, PRIORITY_LABELS, PRIORITY_COLORS } from '../../utils/reportColors'
import { safe, triggerPdfDownload } from '../../utils/pdfDownload'
import { ScoreChart } from '../../components/ScoreChart'
import { ProspectReportPdf } from '../../components/pdf/ProspectReportPdf'

const LOADING_MESSAGES = [
  'Analyzing your responses…',
  'Calculating your maturity score…',
  'Identifying capability gaps…',
  'Mapping strengths across pillars…',
  'Building prioritized recommendations…',
  'Drafting your executive summary…',
  'Preparing next steps…',
  'Almost there…',
]

async function downloadPdf(report: ReportPublic, darkMode: boolean) {
  const { pdf } = await import('@react-pdf/renderer')
  const blob = await pdf(<ProspectReportPdf report={report} darkMode={darkMode} />).toBlob()
  await triggerPdfDownload(blob, `${safe(report.company_name)}-${safe(report.pillar_name)}-maturity-report.pdf`)
}

type Tab = 'report' | 'answers' | 'research' | 'context'

const TABS: { key: Tab; label: string }[] = [
  { key: 'report', label: 'Report' },
  { key: 'answers', label: 'Questions & Answers' },
  { key: 'research', label: 'Research Summary' },
  { key: 'context', label: 'Registration Context' },
]

const CONFIDENCE_STYLES: Record<string, string> = {
  high: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
  low: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
}

function ResearchSummaryPanel({ data }: { data: NonNullable<ReportPublic['research_data']> }) {
  const [sourcesExpanded, setSourcesExpanded] = useState(false)

  return (
    <div className="space-y-4 text-sm">
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
          <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-0.5">Data Confidence</p>
          <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${CONFIDENCE_STYLES[data.data_confidence] ?? CONFIDENCE_STYLES.low}`}>
            {data.data_confidence || '—'}
          </span>
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

      {data.news_insights && (
        <div>
          <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-0.5">News & Context</p>
          <p className="text-gray-700 dark:text-gray-300 leading-relaxed">{data.news_insights}</p>
        </div>
      )}

      {data.observability_outcome && (
        <div>
          <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-0.5">Observability Outcome</p>
          <p className="text-gray-700 dark:text-gray-300 leading-relaxed">{data.observability_outcome}</p>
        </div>
      )}

      {data.sources && data.sources.length > 0 && (
        <div className="px-1">
          <button
            type="button"
            onClick={() => setSourcesExpanded((v) => !v)}
            className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <svg
              className={`w-3 h-3 transition-transform ${sourcesExpanded ? 'rotate-180' : ''}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
            {sourcesExpanded ? 'Hide' : 'Show'} sources ({data.sources.length})
          </button>
          {sourcesExpanded && (
            <ul className="mt-2 space-y-1">
              {data.sources.map((s, i) => (
                <li key={i}>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline break-all"
                  >
                    {s.title || s.url}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

export default function ReportPage() {
  const { token, assessmentId } = useParams<{ token: string; assessmentId: string }>()
  const navigate = useNavigate()

  const [report, setReport] = useState<ReportPublic | null>(null)
  const [error, setError] = useState('')
  const [pdfGenerating, setPdfGenerating] = useState(false)
  const [showPdfModal, setShowPdfModal] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('report')

  useEffect(() => {
    if (!token || !assessmentId) return
    let attempts = 0
    const MAX = 20

    async function fetchReport() {
      try {
        const data = await getReport(token!, assessmentId!)
        setReport(data)
      } catch (e) {
        if (attempts < MAX) {
          attempts++
          setTimeout(fetchReport, 3000)
        } else {
          setError(extractApiError(e, 'Failed to load report.'))
        }
      }
    }

    fetchReport()
  }, [token, assessmentId])

  if (error) {
    return (
      <div className="min-h-screen flex flex-col page-shell">
        <ProspectHeader />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
            <button
              onClick={() => navigate(`/assess/${token}/pillars`)}
              className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 underline underline-offset-2 transition-colors"
            >
              Back to pillar selection
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!report) {
    return (
      <AgentLoadingScreen
        title="Generating your report…"
        progressLabel="Generating your report"
        messages={LOADING_MESSAGES}
        estimatedTime={AGENT_TIMING.report}
        backLabel="← Back to Pillar Selection"
        onBack={() => navigate(`/assess/${token}/pillars`)}
      />
    )
  }

  const badgeClass = MATURITY_COLORS[report.maturity_label] ?? 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'

  const handleDownloadPdf = async (darkMode: boolean) => {
    if (!report) return
    setPdfGenerating(true)
    try {
      await downloadPdf(report, darkMode)
    } finally {
      setPdfGenerating(false)
    }
  }

  const hasContext = !!(
    report.infrastructure_location ||
    report.tech_stack_description ||
    report.current_tools ||
    report.key_challenges_input ||
    report.additional_notes
  )

  return (
    <div className="min-h-screen page-shell flex flex-col">
      {showPdfModal && (
        <PdfThemeModal
          onDownload={(dark) => { handleDownloadPdf(dark) }}
          onClose={() => setShowPdfModal(false)}
        />
      )}
      <ProspectHeader />
      <div className="flex-1 py-10 px-4">
        <div className="max-w-3xl mx-auto space-y-6">

          {/* Header card */}
          <div className="glass-panel rounded-xl p-8">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">{report.company_name}</p>
            <h1 className="text-2xl font-bold text-navy dark:text-gray-100 mb-4">{report.pillar_name}</h1>
            <div className="flex items-center gap-4">
              <span className={`inline-flex items-center border text-sm font-semibold px-3 py-1 rounded-full ${badgeClass}`}>
                {report.maturity_label}
              </span>
              <span className="font-mono tabular-nums text-3xl font-bold text-navy dark:text-gray-100">
                {report.pillar_score.toFixed(1)}
                <span className="text-base font-normal text-gray-400 dark:text-gray-500 ml-1">/ 4.0</span>
              </span>
            </div>
          </div>

          {/* Agent 3 failure fallback */}
          {!report.executive_summary && report.strengths.length === 0 && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-6">
              <p className="text-sm text-yellow-800 dark:text-yellow-300 font-medium">
                Report narrative is still being generated. Please refresh in a moment or contact your administrator if this persists.
              </p>
            </div>
          )}

          {/* Tab bar */}
          <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
            {TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  activeTab === tab.key
                    ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* ── Report tab ── */}
          {activeTab === 'report' && (
            <div className="space-y-8">
              {/* Executive Summary */}
              {report.executive_summary && (
                <div className="glass-panel rounded-xl p-8">
                  <h2 className="text-lg font-semibold text-navy dark:text-gray-100 mb-4">Executive Summary</h2>
                  <div className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed whitespace-pre-line">
                    {report.executive_summary}
                  </div>
                </div>
              )}

              {/* Score Chart */}
              <div className="glass-panel rounded-xl p-8">
                <h2 className="text-lg font-semibold text-navy dark:text-gray-100 mb-2">Maturity Score</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                  Score range: 1 (Initial) → 4 (Optimized)
                </p>
                <ScoreChart report={report} />
              </div>

              {/* Strengths */}
              {report.strengths.length > 0 && (
                <div className="glass-panel rounded-xl p-8">
                  <h2 className="text-lg font-semibold text-navy dark:text-gray-100 mb-4">Strengths</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {report.strengths.map((s, i) => (
                      <div key={i} className="border border-green-100 dark:border-green-900 bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                        <div className="flex items-start gap-2">
                          <span className="text-green-500 mt-0.5 flex-shrink-0">✓</span>
                          <div>
                            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">{s.title}</p>
                            <p className="text-xs text-gray-600 dark:text-gray-400">{s.description}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Gap Analysis */}
              {report.gap_analysis.length > 0 && (
                <div className="glass-panel rounded-xl p-8">
                  <h2 className="text-lg font-semibold text-navy dark:text-gray-100 mb-4">Gap Analysis</h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-600">
                          <th className="text-left py-2 pr-4 text-gray-500 dark:text-gray-400 font-medium">Gap</th>
                          <th className="text-left py-2 pr-4 text-gray-500 dark:text-gray-400 font-medium">Current State</th>
                          <th className="text-left py-2 pr-4 text-gray-500 dark:text-gray-400 font-medium">Target State</th>
                          <th className="text-left py-2 pr-4 text-gray-500 dark:text-gray-400 font-medium">Impact</th>
                          <th className="text-left py-2 text-gray-500 dark:text-gray-400 font-medium">Effort</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.gap_analysis.map((g, i) => (
                          <tr key={i} className="border-b border-gray-100 dark:border-gray-700 last:border-0">
                            <td className="py-3 pr-4 font-medium text-gray-800 dark:text-gray-200">{g.gap}</td>
                            <td className="py-3 pr-4 text-gray-600 dark:text-gray-400">{g.current_state}</td>
                            <td className="py-3 pr-4 text-gray-600 dark:text-gray-400">{g.target_state}</td>
                            <td className="py-3 pr-4">
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${IMPACT_COLORS[g.impact]}`}>
                                {g.impact}
                              </span>
                            </td>
                            <td className="py-3">
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${EFFORT_COLORS[g.effort]}`}>
                                {g.effort}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Next Steps */}
              {report.next_steps.length > 0 && (
                <div className="glass-panel rounded-xl p-8">
                  <h2 className="text-lg font-semibold text-navy dark:text-gray-100 mb-4">Recommended Next Steps</h2>
                  <div className="space-y-4">
                    {report.next_steps.map((ns, i) => (
                      <div key={i} className="border border-gray-100 dark:border-gray-700 rounded-lg p-4">
                        <div className="flex items-start justify-between gap-3 mb-1">
                          <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{ns.title}</p>
                          <div className="flex gap-2 flex-shrink-0">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${PRIORITY_COLORS[ns.priority]}`}>
                              {PRIORITY_LABELS[ns.priority] ?? ns.priority}
                            </span>
                            <span className="text-xs text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">
                              {ns.timeframe}
                            </span>
                          </div>
                        </div>
                        <p className="text-xs text-gray-600 dark:text-gray-400">{ns.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Questions & Answers tab ── */}
          {activeTab === 'answers' && (
            <div className="space-y-2">
              {(report.answers?.length ?? 0) === 0 ? (
                <p className="text-sm text-gray-400 dark:text-gray-500">No answers recorded.</p>
              ) : (
                report.answers.map((row, i) => (
                  <div key={i} className="glass-panel rounded-lg p-4 flex items-start gap-4">
                    <span className="shrink-0 font-mono tabular-nums text-xs font-semibold text-gray-400 dark:text-gray-500 w-5 mt-0.5">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-700 dark:text-gray-300">{row.question_text}</p>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mt-1">{row.selected_option_text}</p>
                    </div>
                    <span className={`shrink-0 font-mono tabular-nums text-xs font-semibold px-2 py-0.5 rounded-full ${LEVEL_COLORS[row.maturity_level] ?? 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}`}>
                      L{row.maturity_level}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ── Research Summary tab ── */}
          {activeTab === 'research' && (
            report.research_data ? (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
                <h2 className="text-lg font-semibold text-navy dark:text-gray-100 mb-4">Research Summary</h2>
                <ResearchSummaryPanel data={report.research_data} />
              </div>
            ) : (
              <p className="text-sm text-gray-400 dark:text-gray-500">No research data available.</p>
            )
          )}

          {/* ── Registration Context tab ── */}
          {activeTab === 'context' && (
            hasContext ? (
              <div className="space-y-4">
                {report.infrastructure_location && (
                  <div className="glass-panel rounded-xl p-5">
                    <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">Infrastructure & Deployment</p>
                    <p className="text-sm text-gray-700 dark:text-gray-300">{report.infrastructure_location}</p>
                  </div>
                )}
                {report.tech_stack_description && (
                  <div className="glass-panel rounded-xl p-5">
                    <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">Tech Stack</p>
                    <p className="text-sm text-gray-700 dark:text-gray-300">{report.tech_stack_description}</p>
                  </div>
                )}
                {report.current_tools && (
                  <div className="glass-panel rounded-xl p-5">
                    <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">Current Tools</p>
                    <p className="text-sm text-gray-700 dark:text-gray-300">{report.current_tools}</p>
                  </div>
                )}
                {report.key_challenges_input && (
                  <div className="glass-panel rounded-xl p-5">
                    <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">Key Challenges (Self-reported)</p>
                    <p className="text-sm text-gray-700 dark:text-gray-300">{report.key_challenges_input}</p>
                  </div>
                )}
                {report.additional_notes && (
                  <div className="glass-panel rounded-xl p-5">
                    <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">Additional Notes</p>
                    <p className="text-sm text-gray-700 dark:text-gray-300">{report.additional_notes}</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-400 dark:text-gray-500">No registration context provided.</p>
            )
          )}

          {/* Footer actions — always visible */}
          <div className="flex items-center justify-between pb-8">
            <button
              onClick={() => navigate(`/assess/${token}/pillars`)}
              className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
            >
              ← Back to Pillar Selection
            </button>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowPdfModal(true)}
                disabled={pdfGenerating}
                className="text-sm font-medium border border-blue-600 text-blue-600 hover:bg-blue-50 dark:border-blue-400 dark:text-blue-400 dark:hover:bg-blue-950 disabled:opacity-50 disabled:cursor-not-allowed px-5 py-2 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-1"
              >
                {pdfGenerating ? 'Generating PDF…' : 'Download PDF'}
              </button>
              <button
                onClick={() => navigate(`/assess/${token}/pillars`)}
                className="text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-500 dark:hover:bg-blue-600 px-5 py-2 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-1"
              >
                Take Another Pillar Assessment
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
