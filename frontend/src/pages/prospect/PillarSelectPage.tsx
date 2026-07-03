import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getAssessmentInfo, selectPillar, confirmResearch } from '../../api/public'
import { extractApiError } from '../../api'
import type { AssessmentInfo, AvailablePillar } from '../../types'
import { PERSONAS } from '../../types'
import ProspectHeader from '../../components/ProspectHeader'

const CONFIRMING_MESSAGES = [
  'Selecting questions tailored to your profile…',
  'Matching questions to your tech stack…',
  'Prioritizing your key challenges…',
  'Finalizing your assessment…',
  'Almost ready…',
]

export default function PillarSelectPage() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()

  const sessionToken = sessionStorage.getItem('session_token') ?? ''
  const prospectName = sessionStorage.getItem('prospect_name') ?? ''
  const prospectRole = sessionStorage.getItem('prospect_role') ?? ''
  const additionalNotes = sessionStorage.getItem('prospect_additional_notes') ?? ''

  const p3Gate: boolean | null = JSON.parse(sessionStorage.getItem('p3_gate') ?? 'null')
  const p4Gate: boolean | null = JSON.parse(sessionStorage.getItem('p4_gate') ?? 'null')

  const roleLabel = PERSONAS.find((p) => p.value === prospectRole)?.label ?? prospectRole

  const [info, setInfo] = useState<AssessmentInfo | null>(null)
  const [loadError, setLoadError] = useState('')
  const [startingPillarId, setStartingPillarId] = useState<string | null>(null)
  const [pillarError, setPillarError] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [progress, setProgress] = useState(0)
  const [msgIdx, setMsgIdx] = useState(0)
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const msgTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!sessionToken) {
      navigate(`/assess/${token}`, { replace: true })
      return
    }
    if (!token) return
    getAssessmentInfo(token)
      .then(setInfo)
      .catch((e) => setLoadError(extractApiError(e, 'Failed to load assessment areas.')))
  }, [token, sessionToken, navigate])

  useEffect(() => {
    if (!confirming) return
    progressTimerRef.current = setInterval(() => setProgress((v) => (v < 88 ? v + 2 : v)), 700)
    msgTimerRef.current = setInterval(() => setMsgIdx((i) => (i + 1) % CONFIRMING_MESSAGES.length), 3000)
    return () => {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current)
      if (msgTimerRef.current) clearInterval(msgTimerRef.current)
    }
  }, [confirming])

  function isPillarVisible(pillar: AvailablePillar, gatedPillars: AvailablePillar[]): boolean {
    if (!pillar.is_gated) return true
    const idx = gatedPillars.indexOf(pillar)
    if (idx === 0) return p3Gate !== false
    if (idx === 1) return p4Gate !== false
    return true
  }

  async function handleSelectPillar(pillar: AvailablePillar) {
    if (!token || !sessionToken) return
    setPillarError('')
    setStartingPillarId(pillar.id)
    setConfirming(true)

    try {
      const { assessment_id } = await selectPillar(token, sessionToken, pillar.id)
      const result = await confirmResearch(
        token,
        sessionToken,
        assessment_id,
        additionalNotes || null,
      )
      navigate(`/assess/${token}/assessment/${assessment_id}`, {
        state: {
          questions: result.questions,
          companyName: info?.company_name ?? '',
          pillarName: pillar.name,
          prospectName,
          prospectRole,
        },
      })
    } catch (e) {
      setPillarError(extractApiError(e, 'Failed to start assessment. Please try again.'))
      setStartingPillarId(null)
      setConfirming(false)
    }
  }

  if (confirming) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
        <ProspectHeader />
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-10 text-center">
            <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-1">
              Question Selection
            </p>
            <h2 className="text-xl font-bold text-[#1B2B4B] dark:text-gray-100 mb-8">
              Personalizing your questions…
            </h2>

            <div className="flex justify-center mb-6">
              <div className="relative w-14 h-14">
                <div className="absolute inset-0 rounded-full border-4 border-gray-200 dark:border-gray-600" />
                <div className="absolute inset-0 rounded-full border-4 border-brand border-t-transparent animate-spin" />
              </div>
            </div>

            <div className="mb-3">
              <div className="flex justify-between text-xs text-gray-400 dark:text-gray-500 mb-2">
                <span>Preparing your assessment</span>
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
                  {CONFIRMING_MESSAGES[msgIdx]}
                </span>
              </div>
            </div>

            <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
              This usually takes 10–20 seconds
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
        <ProspectHeader />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-red-600 dark:text-red-400">{loadError}</p>
        </div>
      </div>
    )
  }

  if (!info) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
        <ProspectHeader />
        <div className="flex-1 flex items-center justify-center">
          <div className="relative w-10 h-10">
            <div className="absolute inset-0 rounded-full border-4 border-gray-200 dark:border-gray-600" />
            <div className="absolute inset-0 rounded-full border-4 border-brand border-t-transparent animate-spin" />
          </div>
        </div>
      </div>
    )
  }

  const gatedPillars = info.available_pillars.filter((p) => p.is_gated)
  const visiblePillars = info.available_pillars.filter((p) => isPillarVisible(p, gatedPillars))

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      <ProspectHeader />
      <div className="flex-1 py-10 px-4">
        <div className="max-w-2xl mx-auto">

          <button
            onClick={() => navigate(`/assess/${token}/research-summary`)}
            className="mb-6 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
          >
            ← Back to Research Summary
          </button>

          <div className="mb-6">
            <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-1">
              {info.company_name}
            </p>
            <h1 className="text-2xl font-bold text-[#1B2B4B] dark:text-gray-100 mb-1">
              Select an Assessment Area
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Choose a pillar to assess. Each takes approximately 8 minutes.
            </p>
            {(prospectName || roleLabel) && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {prospectName}{prospectName && roleLabel ? ' · ' : ''}{roleLabel}
              </p>
            )}
          </div>

          {pillarError && (
            <div className="mb-4 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
              {pillarError}
            </div>
          )}

          {visiblePillars.length === 0 ? (
            <p className="text-center text-gray-500 dark:text-gray-400 mt-8">
              No assessment areas are available. Please contact your administrator.
            </p>
          ) : (
            <div className="space-y-3">
              {visiblePillars.map((pillar) => {
                const isSuggested = info.suggested_pillars.includes(pillar.id)
                const isLoading = startingPillarId === pillar.id
                const isDisabled = startingPillarId !== null

                return (
                  <div
                    key={pillar.id}
                    className={`bg-white dark:bg-gray-800 rounded-xl border p-5 flex items-center gap-5 ${
                      isSuggested ? 'border-brand' : 'border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h2 className="text-base font-semibold text-[#1B2B4B] dark:text-gray-100">{pillar.name}</h2>
                        {isSuggested && (
                          <span className="text-xs font-semibold text-brand bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-full shrink-0">
                            Recommended
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">{pillar.description}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <span className="text-xs text-gray-400 dark:text-gray-500">~8 min</span>
                      <button
                        onClick={() => handleSelectPillar(pillar)}
                        disabled={isDisabled}
                        className="text-sm font-medium bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white px-4 py-1.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-1"
                      >
                        {isLoading ? 'Starting…' : 'Start →'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
