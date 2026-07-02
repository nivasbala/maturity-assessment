import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getReport } from '../../api/public'
import { extractApiError } from '../../api'
import type { ReportPublic } from '../../types'
import ProspectHeader from '../../components/ProspectHeader'
import { MATURITY_COLORS, IMPACT_COLORS, EFFORT_COLORS, PRIORITY_LABELS, PRIORITY_COLORS } from '../../utils/reportColors'
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

async function downloadPdf(report: ReportPublic) {
  const { pdf } = await import('@react-pdf/renderer')
  const blob = await pdf(<ProspectReportPdf report={report} />).toBlob()
  await triggerPdfDownload(blob, `${safe(report.company_name)}-${safe(report.pillar_name)}-maturity-report.pdf`)
}

export default function ReportPage() {
  const { token, assessmentId } = useParams<{ token: string; assessmentId: string }>()
  const navigate = useNavigate()

  const [report, setReport] = useState<ReportPublic | null>(null)
  const [error, setError] = useState('')
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0)
  const [polling, setPolling] = useState(true)
  const [pdfGenerating, setPdfGenerating] = useState(false)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    if (!polling) return
    const msgId = setInterval(() => setLoadingMsgIdx((i) => (i + 1) % LOADING_MESSAGES.length), 3000)
    const progressId = setInterval(() => setProgress((p) => (p < 88 ? p + 2 : p)), 700)
    return () => {
      clearInterval(msgId)
      clearInterval(progressId)
    }
  }, [polling])

  useEffect(() => {
    if (!token || !assessmentId) return
    let attempts = 0
    const MAX = 20

    async function fetchReport() {
      try {
        const data = await getReport(token!, assessmentId!)
        // Stop polling on any successful response — submit is synchronous so
        // the report is complete by the time we navigate here.
        setReport(data)
        setPolling(false)
      } catch (e) {
        // 404 means report not yet available (e.g. direct URL visit during submit)
        if (attempts < MAX) {
          attempts++
          setTimeout(fetchReport, 3000)
        } else {
          setError(extractApiError(e, 'Failed to load report.'))
          setPolling(false)
        }
      }
    }

    fetchReport()
  }, [token, assessmentId])

  if (error) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
        <ProspectHeader />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
            <button
              onClick={() => navigate(`/assess/${token}/pillars`)}
              className="text-sm text-brand hover:underline"
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
      <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
        <ProspectHeader />
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-10 text-center">
            <div className="mb-8">
              <h2 className="text-xl font-bold text-[#1B2B4B] dark:text-gray-100 mb-1">
                Generating your report…
              </h2>
            </div>
            <div className="flex justify-center mb-6">
              <div className="relative w-14 h-14">
                <div className="absolute inset-0 rounded-full border-4 border-gray-200 dark:border-gray-600" />
                <div className="absolute inset-0 rounded-full border-4 border-brand border-t-transparent animate-spin" />
              </div>
            </div>
            <div className="mb-3">
              <div className="flex justify-between text-xs text-gray-400 dark:text-gray-500 mb-2">
                <span>Generating your report</span>
                <span>{progress}%</span>
              </div>
              <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand rounded-full transition-all duration-700 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
            <div className="flex justify-center mt-4">
              <div className="inline-flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-full px-4 py-2">
                <div className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse shrink-0" />
                <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                  {LOADING_MESSAGES[loadingMsgIdx]}
                </span>
              </div>
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
              This usually takes 15–45 seconds
            </p>
          </div>
        </div>
      </div>
    )
  }

  const badgeClass = MATURITY_COLORS[report.maturity_label] ?? 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'

  const handleDownloadPdf = async () => {
    if (!report) return
    setPdfGenerating(true)
    try {
      await downloadPdf(report)
    } finally {
      setPdfGenerating(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      <ProspectHeader />
      <div className="flex-1 py-10 px-4">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* 1. Header */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-8">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">{report.company_name}</p>
          <h1 className="text-2xl font-bold text-[#1B2B4B] dark:text-gray-100 mb-4">{report.pillar_name}</h1>
          <div className="flex items-center gap-4">
            <span className={`inline-flex items-center border text-sm font-semibold px-3 py-1 rounded-full ${badgeClass}`}>
              {report.maturity_label}
            </span>
            <span className="text-3xl font-bold text-[#1B2B4B] dark:text-gray-100">
              {report.pillar_score.toFixed(1)}
              <span className="text-base font-normal text-gray-400 dark:text-gray-500 ml-1">/ 4.0</span>
            </span>
          </div>
        </div>

        {/* Agent 3 failure fallback */}
        {!report.executive_summary && report.strengths.length === 0 && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-6">
            <p className="text-sm text-yellow-800 dark:text-yellow-300 font-medium">
              Report narrative is still being generated. Please refresh in a moment or contact your Datadog representative if this persists.
            </p>
          </div>
        )}

        {/* 2. Executive Summary */}
        {report.executive_summary && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-8">
            <h2 className="text-lg font-semibold text-[#1B2B4B] dark:text-gray-100 mb-4">Executive Summary</h2>
            <div className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed whitespace-pre-line">
              {report.executive_summary}
            </div>
          </div>
        )}

        {/* 3. Radar / Score Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-8">
          <h2 className="text-lg font-semibold text-[#1B2B4B] dark:text-gray-100 mb-2">Maturity Score</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            Score range: 1 (Initial) → 4 (Optimized)
          </p>
          <ScoreChart report={report} />
        </div>

        {/* 4. Strengths */}
        {report.strengths.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-8">
            <h2 className="text-lg font-semibold text-[#1B2B4B] dark:text-gray-100 mb-4">Strengths</h2>
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

        {/* 5. Gap Analysis */}
        {report.gap_analysis.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-8">
            <h2 className="text-lg font-semibold text-[#1B2B4B] dark:text-gray-100 mb-4">Gap Analysis</h2>
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

        {/* 6. Next Steps */}
        {report.next_steps.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-8">
            <h2 className="text-lg font-semibold text-[#1B2B4B] dark:text-gray-100 mb-4">Recommended Next Steps</h2>
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

        {/* 7. Footer actions */}
        <div className="flex items-center justify-between pb-8">
          <button
            onClick={() => navigate(`/assess/${token}/pillars`)}
            className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
          >
            ← Back to Pillar Selection
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={handleDownloadPdf}
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
