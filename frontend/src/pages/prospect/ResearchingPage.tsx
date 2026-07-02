import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getResearchSummary, saveResearchAdditionalNotes } from '../../api/public'
import { extractApiError } from '../../api'
import type { ResearchSummary } from '../../types'
import ProspectHeader from '../../components/ProspectHeader'

const MESSAGES = [
  'Researching your company…',
  'Scanning recent news articles…',
  'Analyzing security and AI signals…',
  'Reviewing your industry context…',
  'Building your company profile…',
  'Identifying key challenges…',
  'Almost there…',
]

const CONFIDENCE_STYLES: Record<string, string> = {
  high: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
  low: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
}

export default function ResearchingPage() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()

  const sessionToken = sessionStorage.getItem('session_token') ?? ''
  const companyName = sessionStorage.getItem('prospect_company_name') ?? ''

  // 'loading' while Agent 1 runs; 'results' once is_ready=true
  const [phase, setPhase] = useState<'loading' | 'results'>('loading')
  const [summary, setSummary] = useState<ResearchSummary | null>(null)
  const [additionalInfo, setAdditionalInfo] = useState(
    sessionStorage.getItem('prospect_additional_info') ?? ''
  )
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  const [progress, setProgress] = useState(0)
  const [msgIdx, setMsgIdx] = useState(0)
  const [error, setError] = useState('')
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const delayRef = useRef(2000)
  const doneRef = useRef(false)

  // Redirect to registration if no session
  useEffect(() => {
    if (!sessionToken) {
      navigate(`/assess/${token}`, { replace: true })
    }
  }, [sessionToken, token, navigate])

  // Fake progress while loading
  useEffect(() => {
    if (phase !== 'loading') return
    const id = setInterval(() => setProgress((p) => (p < 88 ? p + 2 : p)), 700)
    return () => clearInterval(id)
  }, [phase])

  // Cycle messages while loading
  useEffect(() => {
    if (phase !== 'loading') return
    const id = setInterval(() => setMsgIdx((i) => (i + 1) % MESSAGES.length), 3000)
    return () => clearInterval(id)
  }, [phase])

  // Poll /research-summary until is_ready=true, then show results
  useEffect(() => {
    if (!token || !sessionToken) return

    let cancelled = false

    async function poll() {
      try {
        const data = await getResearchSummary(token!, sessionToken)
        if (cancelled) return

        if (data.is_ready) {
          if (doneRef.current) return
          doneRef.current = true
          setProgress(100)
          setSummary(data)
          // Brief pause so the bar visually completes before transitioning
          setTimeout(() => {
            if (!cancelled) setPhase('results')
          }, 600)
        } else {
          delayRef.current = Math.min(delayRef.current + 2000, 8000)
          pollRef.current = setTimeout(poll, delayRef.current)
        }
      } catch (e) {
        if (cancelled) return
        setError(extractApiError(e, 'Failed to check research status.'))
      }
    }

    poll()
    return () => {
      cancelled = true
      if (pollRef.current) clearTimeout(pollRef.current)
    }
  }, [token, sessionToken])

  async function handleStartAssessment() {
    setSaveError('')
    const trimmed = additionalInfo.trim()
    sessionStorage.setItem('prospect_additional_info', trimmed)

    // Save additional notes to the prospect record if provided
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

  // ── Loading phase ──────────────────────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
        <ProspectHeader />
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-10 text-center">

            {companyName && (
              <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-1">
                {companyName}
              </p>
            )}
            <h2 className="text-xl font-bold text-[#1B2B4B] dark:text-gray-100 mb-8">
              Analyzing your company profile…
            </h2>

            {error ? (
              <div className="space-y-4">
                <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                  {error}
                </p>
                <button
                  onClick={() => navigate(`/assess/${token}`)}
                  className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 underline underline-offset-2"
                >
                  ← Back to Registration
                </button>
              </div>
            ) : (
              <>
                <div className="flex justify-center mb-6">
                  <div className="relative w-14 h-14">
                    <div className="absolute inset-0 rounded-full border-4 border-gray-200 dark:border-gray-600" />
                    <div className="absolute inset-0 rounded-full border-4 border-brand border-t-transparent animate-spin" />
                  </div>
                </div>

                <div className="mb-3">
                  <div className="flex justify-between text-xs text-gray-400 dark:text-gray-500 mb-2">
                    <span>Building your profile</span>
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
                      {MESSAGES[msgIdx]}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
                  This usually takes 30–60 seconds
                </p>

                <button
                  onClick={() => navigate(`/assess/${token}`)}
                  className="mt-5 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 underline underline-offset-2 transition-colors"
                >
                  ← Back to Registration
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── Results phase ──────────────────────────────────────────────────────────
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

            {/* Header card — company profile */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-start justify-between gap-4 mb-1">
                <div>
                  <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-1">
                    Company Research
                  </p>
                  <h1 className="text-xl font-bold text-[#1B2B4B] dark:text-gray-100">
                    {summary?.company_name || companyName}
                  </h1>
                </div>
                {summary?.data_confidence && (
                  <span className={`shrink-0 text-xs font-medium px-2.5 py-1 rounded-full ${CONFIDENCE_STYLES[summary.data_confidence] ?? CONFIDENCE_STYLES.low}`}>
                    {summary.data_confidence.charAt(0).toUpperCase() + summary.data_confidence.slice(1)} confidence
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Here's what we found about your company. Review and add any context before starting your assessment.
              </p>

              <div className="space-y-3">
                {summary?.products_summary && (
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1">About</dt>
                    <dd className="text-sm text-gray-700 dark:text-gray-300">{summary.products_summary}</dd>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  {summary?.industry && (
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-0.5">Industry</dt>
                      <dd className="text-sm text-gray-700 dark:text-gray-300 capitalize">{summary.industry}</dd>
                    </div>
                  )}
                  {summary?.company_size && (
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-0.5">Size</dt>
                      <dd className="text-sm text-gray-700 dark:text-gray-300 capitalize">{summary.company_size}</dd>
                    </div>
                  )}
                </div>
                {summary?.target_customers && summary.target_customers !== 'unknown' && (
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-0.5">Target customers</dt>
                    <dd className="text-sm text-gray-700 dark:text-gray-300">{summary.target_customers}</dd>
                  </div>
                )}
              </div>
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

            {/* Recent news insights */}
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

            {/* Additional information */}
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
                value={additionalInfo}
                onChange={(e) => setAdditionalInfo(e.target.value)}
                placeholder="e.g. We are primarily on Azure, not AWS. We have 200 engineers and recently acquired a fintech startup."
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent resize-none"
              />
            </div>

            {/* CTA */}
            {saveError && (
              <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                {saveError}
              </p>
            )}
            <button
              onClick={handleStartAssessment}
              disabled={saving}
              className="w-full bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2"
            >
              {saving ? 'Saving…' : 'Start Assessment →'}
            </button>

          </div>
        </div>
      </div>
    </div>
  )
}
