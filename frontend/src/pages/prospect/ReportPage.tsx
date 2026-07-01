import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getReport } from '../../api/public'
import { extractApiError } from '../../api'
import type { ReportPublic } from '../../types'
import FloatingThemeToggle from '../../components/FloatingThemeToggle'

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

const LOADING_MESSAGES = [
  'Researching your company…',
  'Analyzing your responses…',
  'Generating your report…',
]

export default function ReportPage() {
  const { token, assessmentId } = useParams<{ token: string; assessmentId: string }>()
  const navigate = useNavigate()

  const [report, setReport] = useState<ReportPublic | null>(null)
  const [error, setError] = useState('')
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0)
  const [polling, setPolling] = useState(true)

  useEffect(() => {
    if (!polling) return
    const id = setInterval(() => setLoadingMsgIdx((i) => (i + 1) % LOADING_MESSAGES.length), 2500)
    return () => clearInterval(id)
  }, [polling])

  useEffect(() => {
    if (!token || !assessmentId) return
    let attempts = 0
    const MAX = 20

    async function fetchReport() {
      try {
        const data = await getReport(token!, assessmentId!)
        if (data.executive_summary || attempts >= MAX) {
          setReport(data)
          setPolling(false)
        } else {
          attempts++
          setTimeout(fetchReport, 3000)
        }
      } catch (e) {
        const msg = extractApiError(e, 'Failed to load report.')
        if (attempts < MAX) {
          attempts++
          setTimeout(fetchReport, 3000)
        } else {
          setError(msg)
          setPolling(false)
        }
      }
    }

    fetchReport()
  }, [token, assessmentId])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <FloatingThemeToggle />
        <div className="text-center">
          <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
          <button
            onClick={() => navigate(`/assess/${token}/pillars`)}
            className="text-sm text-[#2563EB] hover:underline"
          >
            Back to pillar selection
          </button>
        </div>
      </div>
    )
  }

  if (!report) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900">
        <FloatingThemeToggle />
        <div className="animate-spin h-10 w-10 border-4 border-[#2563EB] border-t-transparent rounded-full mb-6" />
        <p className="text-gray-600 dark:text-gray-400 font-medium text-lg">{LOADING_MESSAGES[loadingMsgIdx]}</p>
      </div>
    )
  }

  const badgeClass = MATURITY_COLORS[report.maturity_label] ?? 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4">
      <FloatingThemeToggle />
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Header */}
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

        {/* Executive Summary */}
        {report.executive_summary && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-8">
            <h2 className="text-lg font-semibold text-[#1B2B4B] dark:text-gray-100 mb-4">Executive Summary</h2>
            <div className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed whitespace-pre-line">
              {report.executive_summary}
            </div>
          </div>
        )}

        {/* Strengths */}
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

        {/* Gap Analysis */}
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
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${IMPACT_COLORS[g.effort]}`}>
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

        {/* Footer actions */}
        <div className="flex items-center justify-between pb-8">
          <button
            onClick={() => navigate(`/assess/${token}/pillars`)}
            className="text-sm font-medium text-[#2563EB] border border-[#2563EB] px-5 py-2 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:ring-offset-1"
          >
            Take Another Pillar Assessment
          </button>
        </div>
      </div>
    </div>
  )
}
