import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getResearchSummary, confirmResearch } from '../../api/public'
import { extractApiError } from '../../api'
import type { ResearchSummary } from '../../types'
import ProspectHeader from '../../components/ProspectHeader'

interface ProspectCtx {
  infrastructure: string
  techStack: string
  tools: string
  challenges: string
}

function ProspectContextCard({ ctx }: { ctx: ProspectCtx }) {
  const rows: { label: string; value: string }[] = [
    { label: 'Infrastructure & deployment', value: ctx.infrastructure },
    { label: 'Tech stack', value: ctx.techStack },
    { label: 'Current tools', value: ctx.tools },
    { label: 'Key challenges', value: ctx.challenges },
  ].filter((r) => r.value.trim() !== '')

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">
        What you provided
      </h2>
      <dl className="space-y-3">
        {rows.map((r) => (
          <div key={r.label}>
            <dt className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-0.5">
              {r.label}
            </dt>
            <dd className="text-sm text-gray-700 dark:text-gray-300">{r.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

const CONFIDENCE_STYLES: Record<string, string> = {
  high: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
  low: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
}

export default function ResearchSummaryPage() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const sessionToken = sessionStorage.getItem('session_token') ?? ''

  // Prospect-provided context — always shown regardless of agent result
  const prospectContext = {
    infrastructure: sessionStorage.getItem('infrastructure_location') ?? '',
    techStack: sessionStorage.getItem('tech_stack_description') ?? '',
    tools: sessionStorage.getItem('current_tools') ?? '',
    challenges: sessionStorage.getItem('prospect_challenges') ?? '',
  }
  const hasProspectContext = Object.values(prospectContext).some((v) => v.trim() !== '')

  const [summary, setSummary] = useState<ResearchSummary | null>(null)
  const [error, setError] = useState('')
  const [corrections, setCorrections] = useState('')
  const [correctionExpanded, setCorrectionExpanded] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const delayRef = useRef(2000)

  // Redirect to landing if no session token
  useEffect(() => {
    if (!sessionToken) {
      navigate(`/assess/${token}`, { replace: true })
    }
  }, [sessionToken, token, navigate])

  // Poll until is_ready = true
  useEffect(() => {
    if (!token || !sessionToken) return

    let cancelled = false

    async function poll() {
      try {
        const data = await getResearchSummary(token!, sessionToken)
        if (cancelled) return
        setSummary(data)
        if (!data.is_ready) {
          // Backoff: immediate → 4s → 6s → cap at 8s
          delayRef.current = Math.min(delayRef.current + 2000, 8000)
          pollRef.current = setTimeout(poll, delayRef.current)
        }
      } catch (e) {
        if (cancelled) return
        setError(extractApiError(e, 'Failed to load research summary.'))
      }
    }

    poll()
    return () => {
      cancelled = true
      if (pollRef.current) clearTimeout(pollRef.current)
    }
  }, [token, sessionToken])

  async function handleConfirm() {
    if (!token) return
    setConfirming(true)
    try {
      await confirmResearch(token, sessionToken, corrections.trim() || null)
      navigate(`/assess/${token}/pillars`)
    } catch (e) {
      setError(extractApiError(e, 'Failed to confirm research. Please try again.'))
    } finally {
      setConfirming(false)
    }
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
        <ProspectHeader />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-red-600 dark:text-red-400 font-medium">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      <ProspectHeader />
      <div className="flex-1 flex items-center justify-center py-12 px-4">
        <div className="w-full max-w-2xl">

          {/* Loading state */}
          {(!summary || !summary.is_ready) && (
            <div className="space-y-4">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
                <div className="flex justify-center mb-4">
                  <svg className="animate-spin h-8 w-8 text-brand" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                </div>
                <p className="text-lg font-semibold text-[#1B2B4B] dark:text-gray-100 mb-1">
                  Analyzing your company profile…
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  This usually takes 10–20 seconds.
                </p>
              </div>
              {hasProspectContext && <ProspectContextCard ctx={prospectContext} />}
            </div>
          )}

          {/* Ready state */}
          {summary?.is_ready && (
            <div className="space-y-4">
              {/* Header card */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-start justify-between gap-4 mb-1">
                  <h1 className="text-xl font-bold text-[#1B2B4B] dark:text-gray-100">
                    Your Company Profile
                  </h1>
                  <span className={`shrink-0 text-xs font-medium px-2.5 py-1 rounded-full ${CONFIDENCE_STYLES[summary.data_confidence] ?? CONFIDENCE_STYLES.low}`}>
                    {summary.data_confidence.charAt(0).toUpperCase() + summary.data_confidence.slice(1)} confidence
                  </span>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  Review the profile we built for your company. This will be used to tailor your assessment.
                </p>

                <div className="space-y-3">
                  {summary.products_summary && (
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1">About</dt>
                      <dd className="text-sm text-gray-700 dark:text-gray-300">{summary.products_summary}</dd>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    {summary.industry && (
                      <div>
                        <dt className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-0.5">Industry</dt>
                        <dd className="text-sm text-gray-700 dark:text-gray-300 capitalize">{summary.industry}</dd>
                      </div>
                    )}
                    {summary.company_size && (
                      <div>
                        <dt className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-0.5">Size</dt>
                        <dd className="text-sm text-gray-700 dark:text-gray-300 capitalize">{summary.company_size}</dd>
                      </div>
                    )}
                  </div>
                  {summary.target_customers && summary.target_customers !== 'unknown' && (
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-0.5">Target customers</dt>
                      <dd className="text-sm text-gray-700 dark:text-gray-300">{summary.target_customers}</dd>
                    </div>
                  )}
                </div>
              </div>

              {/* Prospect-provided context — always shown */}
              {hasProspectContext && <ProspectContextCard ctx={prospectContext} />}

              {/* Key Challenges */}
              {summary.key_challenges.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">Key Operational Challenges</h2>
                  <ul className="space-y-1.5">
                    {summary.key_challenges.map((c, i) => (
                      <li key={i} className="flex gap-2 text-sm text-gray-700 dark:text-gray-300">
                        <span className="text-brand mt-0.5 shrink-0">•</span>
                        <span>{c}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Business Outcomes */}
              {summary.business_outcomes.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">Business Outcomes</h2>
                  <ul className="space-y-1.5">
                    {summary.business_outcomes.map((o, i) => (
                      <li key={i} className="flex gap-2 text-sm text-gray-700 dark:text-gray-300">
                        <span className="text-brand mt-0.5 shrink-0">•</span>
                        <span>{o}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Infrastructure */}
              {(summary.cloud_providers.length > 0 || summary.operational_scale.length > 0) && (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">Infrastructure Detected</h2>
                  {summary.cloud_providers.length > 0 && (
                    <div className="mb-3">
                      <dt className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Cloud providers</dt>
                      <div className="flex flex-wrap gap-2">
                        {summary.cloud_providers.map((p) => (
                          <span key={p} className="text-xs font-medium bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2.5 py-1 rounded-full uppercase">
                            {p}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {summary.operational_scale.length > 0 && (
                    <ul className="space-y-1">
                      {summary.operational_scale.map((s, i) => (
                        <li key={i} className="text-sm text-gray-700 dark:text-gray-300">{s}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {/* Research notes */}
              {summary.research_notes && (
                <p className="text-xs text-gray-400 dark:text-gray-500 px-1">
                  Note: {summary.research_notes}
                </p>
              )}

              {/* Corrections */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <button
                  type="button"
                  onClick={() => setCorrectionExpanded((v) => !v)}
                  className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                >
                  <svg
                    className={`w-4 h-4 transition-transform ${correctionExpanded ? 'rotate-180' : ''}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                  Something looks inaccurate?
                </button>
                {correctionExpanded && (
                  <div className="mt-3">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Add a correction note <span className="text-gray-400 font-normal">(optional)</span>
                    </label>
                    <textarea
                      rows={3}
                      value={corrections}
                      onChange={(e) => setCorrections(e.target.value)}
                      placeholder="e.g. We are primarily on Azure, not AWS. We have 200 engineers."
                      className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent resize-none"
                    />
                  </div>
                )}
              </div>

              {/* CTA */}
              <button
                onClick={handleConfirm}
                disabled={confirming}
                className="w-full bg-brand text-white font-semibold py-3 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2"
              >
                {confirming ? 'Confirming…' : 'Confirm & Continue to Assessment'}
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
