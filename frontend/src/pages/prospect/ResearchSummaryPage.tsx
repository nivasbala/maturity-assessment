import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getResearchSummary, saveResearchAdditionalNotes } from '../../api/public'
import { extractApiError } from '../../api'
import type { ResearchSummary } from '../../types'
import ProspectHeader from '../../components/ProspectHeader'

const CONFIDENCE_STYLES: Record<string, string> = {
  high: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
  low: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
}

export default function ResearchSummaryPage() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()

  const sessionToken = sessionStorage.getItem('session_token') ?? ''
  const companyName = sessionStorage.getItem('prospect_company_name') ?? ''

  const [summary, setSummary] = useState<ResearchSummary | null>(null)
  const [error, setError] = useState('')
  const [additionalNotes, setAdditionalNotes] = useState(
    sessionStorage.getItem('prospect_additional_notes') ?? ''
  )
  const [sourcesExpanded, setSourcesExpanded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const delayRef = useRef(2000)

  useEffect(() => {
    if (!sessionToken) {
      navigate(`/assess/${token}`, { replace: true })
    }
  }, [sessionToken, token, navigate])

  // Poll in case we arrive before research is fully ready
  useEffect(() => {
    if (!token || !sessionToken) return

    let cancelled = false

    async function poll() {
      try {
        const data = await getResearchSummary(token!, sessionToken)
        if (cancelled) return
        setSummary(data)
        if (!data.is_ready) {
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

  async function handleSelectAssessment() {
    setSaveError('')
    const trimmed = additionalNotes.trim()
    sessionStorage.setItem('prospect_additional_notes', trimmed)

    if (trimmed) {
      setSaving(true)
      try {
        await saveResearchAdditionalNotes(token!, sessionToken, trimmed)
      } catch (e) {
        setSaveError(extractApiError(e, 'Failed to save additional notes. Please try again.'))
        setSaving(false)
        return
      }
      setSaving(false)
    }

    navigate(`/assess/${token}/pillars`)
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
      <div className="flex-1 py-10 px-4">
        <div className="max-w-2xl mx-auto">

          <button
            onClick={() => navigate(`/assess/${token}`)}
            className="mb-4 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
          >
            ← Back to Registration
          </button>

          <div className="space-y-4">

            {/* Company header */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-start justify-between gap-4 mb-1">
                <div>
                  <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-1">
                    Company Research
                  </p>
                  <h1 className="text-xl font-bold text-[#1B2B4B] dark:text-gray-100">
                    {summary?.company_name ?? companyName}
                  </h1>
                </div>
                {summary?.data_confidence && (
                  <span className={`shrink-0 text-xs font-medium px-2.5 py-1 rounded-full ${CONFIDENCE_STYLES[summary.data_confidence] ?? CONFIDENCE_STYLES.low}`}>
                    {summary.data_confidence.charAt(0).toUpperCase() + summary.data_confidence.slice(1)} confidence
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 mb-4">
                Here's what we found about your company. Review and add any context before starting your assessment.
              </p>

              {summary ? (
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
              ) : (
                <div className="animate-pulse space-y-2">
                  <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded w-3/4" />
                  <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded w-1/2" />
                </div>
              )}
            </div>

            {/* Key Challenges */}
            {summary?.key_challenges && summary.key_challenges.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">
                  Key Operational Challenges
                </h2>
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
            {summary?.business_outcomes && summary.business_outcomes.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">
                  Business Outcomes
                </h2>
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
            {((summary?.cloud_providers && summary.cloud_providers.length > 0) ||
              (summary?.operational_scale && summary.operational_scale.length > 0)) && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">
                  Infrastructure Detected
                </h2>
                {summary?.cloud_providers && summary.cloud_providers.length > 0 && (
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
                {summary?.operational_scale && summary.operational_scale.length > 0 && (
                  <ul className="space-y-1">
                    {summary.operational_scale.map((s, i) => (
                      <li key={i} className="text-sm text-gray-700 dark:text-gray-300">{s}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Recent news */}
            {summary?.news_insights && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl p-5">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400 mb-2">
                  Recent News & Market Context
                </h2>
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                  {summary.news_insights}
                </p>
              </div>
            )}

            {/* Research notes */}
            {summary?.research_notes && (
              <p className="text-xs text-gray-400 dark:text-gray-500 px-1">
                Note: {summary.research_notes}
              </p>
            )}

            {/* Sources */}
            {summary?.sources && summary.sources.length > 0 && (
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
                  {sourcesExpanded ? 'Hide' : 'Show'} sources ({summary.sources.length})
                </button>
                {sourcesExpanded && (
                  <ul className="mt-2 space-y-1">
                    {summary.sources.map((s, i) => (
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

            {/* Additional notes */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Anything to add or correct?{' '}
                <span className="text-gray-400 dark:text-gray-500 font-normal">(optional)</span>
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                Let us know if anything looks off or if there's additional context that would help personalize your assessment.
              </p>
              <textarea
                rows={3}
                value={additionalNotes}
                onChange={(e) => setAdditionalNotes(e.target.value)}
                placeholder="e.g. We are primarily on Azure, not AWS. We have 200 engineers and recently acquired a fintech startup."
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent resize-none"
              />
            </div>

            {/* Error */}
            {saveError && (
              <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                {saveError}
              </p>
            )}

            {/* CTA */}
            <button
              onClick={handleSelectAssessment}
              disabled={saving}
              className="w-full bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2"
            >
              {saving ? 'Saving…' : 'Select Assessment →'}
            </button>

          </div>
        </div>
      </div>
    </div>
  )
}
