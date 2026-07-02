import { useEffect, useRef, useState, useCallback } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { getResearchSummary, confirmResearch } from '../../api/public'
import { extractApiError } from '../../api'
import type { ResearchSummary } from '../../types'
import ProspectHeader from '../../components/ProspectHeader'

interface LocationState {
  assessmentId: string
  pillarName: string
  companyName: string
}

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

const RESEARCH_MESSAGES = [
  'Researching your company…',
  'Analyzing your tech stack…',
  'Reviewing your industry context…',
  'Building your company profile…',
  'Almost there…',
]

const QUESTION_MESSAGES = [
  'Selecting questions tailored to your profile…',
  'Matching questions to your tech stack…',
  'Prioritizing your key challenges…',
  'Finalizing your assessment…',
  'Almost ready…',
]

function AgentProgressCard({
  label,
  title,
  messages,
  timeEstimate,
  onBack,
  backLabel = '← Back',
}: {
  label: string
  title: string
  messages: string[]
  timeEstimate: string
  onBack?: () => void
  backLabel?: string
}) {
  const [progress, setProgress] = useState(0)
  const [msgIndex, setMsgIndex] = useState(0)

  useEffect(() => {
    const progressId = setInterval(() => {
      setProgress((p) => (p < 88 ? p + 2 : p))
    }, 700)
    const msgId = setInterval(() => {
      setMsgIndex((i) => (i + 1) % messages.length)
    }, 3000)
    return () => {
      clearInterval(progressId)
      clearInterval(msgId)
    }
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      <ProspectHeader />
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-10 text-center">
          <div className="mb-8">
            <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-1">
              {label}
            </p>
            <h2 className="text-xl font-bold text-[#1B2B4B] dark:text-gray-100 mb-1">
              {title}
            </h2>
          </div>

          {/* Circular spinner */}
          <div className="flex justify-center mb-6">
            <div className="relative w-14 h-14">
              <div className="absolute inset-0 rounded-full border-4 border-gray-200 dark:border-gray-600" />
              <div className="absolute inset-0 rounded-full border-4 border-brand border-t-transparent animate-spin" />
            </div>
          </div>

          {/* Progress bar */}
          <div className="mb-3">
            <div className="flex justify-between text-xs text-gray-400 dark:text-gray-500 mb-2">
              <span>{title}</span>
              <span>{progress}%</span>
            </div>
            <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-brand rounded-full transition-all duration-700 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Cycling message badge */}
          <div className="flex justify-center mt-4">
            <div className="inline-flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-full px-4 py-2">
              <div className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse shrink-0" />
              <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                {messages[msgIndex]}
              </span>
            </div>
          </div>

          <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
            {timeEstimate}
          </p>

          {onBack && (
            <button
              onClick={onBack}
              className="mt-5 text-sm text-brand hover:text-blue-700 dark:hover:text-blue-300 underline underline-offset-2 transition-colors"
            >
              {backLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function ResearchProgressPage({ onBack }: { onBack: () => void }) {
  return (
    <AgentProgressCard
      label="Company Research"
      title="Analyzing your company profile…"
      messages={RESEARCH_MESSAGES}
      timeEstimate="This usually takes 10–20 seconds"
      onBack={onBack}
      backLabel="← Back to Pillar Selection"
    />
  )
}

export default function ResearchSummaryPage() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { assessmentId, pillarName, companyName: stateCompanyName } =
    (location.state as LocationState) ?? {}
  const sessionToken = sessionStorage.getItem('session_token') ?? ''

  const prospectName = sessionStorage.getItem('prospect_name') ?? ''
  const prospectRole = sessionStorage.getItem('prospect_role') ?? ''

  // Redirect to pillar select if no assessment context
  useEffect(() => {
    if (!assessmentId) {
      navigate(`/assess/${token}/pillars`, { replace: true })
    }
  }, [assessmentId, token, navigate])

  // Prospect-provided context — always shown regardless of agent result
  const prospectContext = {
    infrastructure: sessionStorage.getItem('infrastructure_location') ?? '',
    techStack: sessionStorage.getItem('tech_stack_description') ?? '',
    tools: sessionStorage.getItem('current_tools') ?? '',
    challenges: sessionStorage.getItem('key_challenges_input') ?? '',
  }
  const hasProspectContext = Object.values(prospectContext).some((v) => v.trim() !== '')

  const additionalNotesKey = assessmentId ? `prospect_additional_notes_${assessmentId}` : null

  const [summary, setSummary] = useState<ResearchSummary | null>(null)
  const [error, setError] = useState('')
  const [additionalNotes, setAdditionalNotes] = useState(() =>
    additionalNotesKey ? (sessionStorage.getItem(additionalNotesKey) ?? '') : ''
  )
  const [additionalNotesExpanded, setAdditionalNotesExpanded] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const delayRef = useRef(2000)

  const handleBack = useCallback(() => {
    navigate(`/assess/${token}/pillars`)
  }, [navigate, token])

  // Redirect to pillar select if no session token or no assessment context
  useEffect(() => {
    if (!sessionToken || !assessmentId) {
      navigate(`/assess/${token}/pillars`, { replace: true })
    }
  }, [sessionToken, assessmentId, token, navigate])

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
    if (!token || !assessmentId) return
    setConfirming(true)
    try {
      const result = await confirmResearch(token, sessionToken, assessmentId, additionalNotes.trim() || null)
      navigate(`/assess/${token}/assessment/${assessmentId}`, {
        state: {
          questions: result.questions,
          companyName: stateCompanyName ?? summary?.company_name ?? '',
          pillarName: pillarName ?? '',
          prospectName,
          prospectRole,
        },
      })
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

  if (!summary || !summary.is_ready) {
    return <ResearchProgressPage key="research-agent" onBack={handleBack} />
  }

  if (confirming) {
    return (
      <AgentProgressCard
        key="question-agent"
        label="Question Selection"
        title="Personalizing your questions…"
        messages={QUESTION_MESSAGES}
        timeEstimate="This usually takes 10–20 seconds"
        onBack={() => setConfirming(false)}
        backLabel="← Back to Research Summary"
      />
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      <ProspectHeader />
      <div className="flex-1 flex items-center justify-center py-12 px-4">
        <div className="w-full max-w-2xl">
          <button
            onClick={() => navigate(`/assess/${token}/pillars`)}
            className="mb-4 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
          >
            ← Back to Pillar Selection
          </button>

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

              {/* Additional Notes */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <button
                  type="button"
                  onClick={() => setAdditionalNotesExpanded((v) => !v)}
                  className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                >
                  <svg
                    className={`w-4 h-4 transition-transform ${additionalNotesExpanded ? 'rotate-180' : ''}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                  Anything to add or correct?
                </button>
                {additionalNotesExpanded && (
                  <div className="mt-3">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Additional notes <span className="text-gray-400 font-normal">(optional)</span>
                    </label>
                    <textarea
                      rows={3}
                      value={additionalNotes}
                      onChange={(e) => {
                        setAdditionalNotes(e.target.value)
                        if (additionalNotesKey) sessionStorage.setItem(additionalNotesKey, e.target.value)
                      }}
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
                {confirming ? 'Personalizing your questions…' : 'Confirm & Continue to Assessment'}
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
