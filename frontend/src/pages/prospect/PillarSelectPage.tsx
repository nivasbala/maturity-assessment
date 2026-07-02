import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getAssessmentInfo, selectPillar } from '../../api/public'
import { extractApiError } from '../../api'
import type { AssessmentInfo, AvailablePillar } from '../../types'
import { PERSONAS } from '../../types'
import ProspectHeader from '../../components/ProspectHeader'

export default function PillarSelectPage() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()

  const [info, setInfo] = useState<AssessmentInfo | null>(null)
  const [loadError, setLoadError] = useState('')
  const [loadingPillar, setLoadingPillar] = useState<AvailablePillar | null>(null)
  const [pillarError, setPillarError] = useState('')
  const cancelledRef = useRef(false)

  const sessionToken = sessionStorage.getItem('session_token') ?? ''
  const p3Gate: boolean | null = JSON.parse(sessionStorage.getItem('p3_gate') ?? 'null')
  const p4Gate: boolean | null = JSON.parse(sessionStorage.getItem('p4_gate') ?? 'null')
  const prospectName = sessionStorage.getItem('prospect_name') ?? ''
  const prospectRole = sessionStorage.getItem('prospect_role') ?? ''

  const roleLabel = PERSONAS.find((p) => p.value === prospectRole)?.label ?? prospectRole

  useEffect(() => {
    if (!token) return
    getAssessmentInfo(token)
      .then(setInfo)
      .catch((e) => setLoadError(extractApiError(e, 'Failed to load pillars.')))
  }, [token])

  if (!sessionToken) {
    navigate(`/assess/${token}`)
    return null
  }

  function isPillarVisibleByOrder(pillar: AvailablePillar, gatedPillars: AvailablePillar[]): boolean {
    if (!pillar.is_gated) return true
    const idx = gatedPillars.indexOf(pillar)
    if (idx === 0) return p3Gate !== false
    if (idx === 1) return p4Gate !== false
    return true
  }

  const gatedPillars = info?.available_pillars.filter((p) => p.is_gated) ?? []

  function shouldShow(pillar: AvailablePillar): boolean {
    if (!pillar.is_gated) return true
    return isPillarVisibleByOrder(pillar, gatedPillars)
  }

  function getCacheKey(pillarId: string) {
    return `pillar_questions_${token}_${pillarId}`
  }

  function handleCancelLoading() {
    cancelledRef.current = true
    setLoadingPillar(null)
    setPillarError('')
  }

  async function handleSelectPillar(pillar: AvailablePillar) {
    setPillarError('')
    cancelledRef.current = false

    const cacheKey = getCacheKey(pillar.id)
    const cached = sessionStorage.getItem(cacheKey)
    if (cached) {
      // Cache hit — navigate immediately, no agent call, no loading screen
      const result = JSON.parse(cached)
      navigate(`/assess/${token}/assessment/${result.assessment_id}`, {
        state: {
          questions: result.questions,
          companyName: info?.company_name,
          pillarName: pillar.name,
          prospectName,
          prospectRole: roleLabel,
        },
      })
      return
    }

    setLoadingPillar(pillar)
    try {
      const result = await selectPillar(token!, sessionToken, pillar.id)
      if (cancelledRef.current) return
      sessionStorage.setItem(cacheKey, JSON.stringify(result))
      navigate(`/assess/${token}/assessment/${result.assessment_id}`, {
        state: {
          questions: result.questions,
          companyName: info?.company_name,
          pillarName: pillar.name,
          prospectName,
          prospectRole: roleLabel,
        },
      })
    } catch (e) {
      if (cancelledRef.current) return
      setPillarError(extractApiError(e, 'Failed to load questions. Please try again.'))
      setLoadingPillar(null)
    }
  }

  // Full-screen loading state while questions are being personalized
  if (loadingPillar) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
        <ProspectHeader />
        <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-10 text-center">
          <div className="mb-6">
            <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-1">
              {info?.company_name}
            </p>
            <h2 className="text-xl font-bold text-[#1B2B4B] dark:text-gray-100 mb-1">
              {loadingPillar.name}
            </h2>
            {prospectName && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {prospectName} · {roleLabel}
              </p>
            )}
          </div>

          <div className="flex justify-center mb-6">
            <div className="relative w-14 h-14">
              <div className="absolute inset-0 rounded-full border-4 border-gray-200 dark:border-gray-600" />
              <div className="absolute inset-0 rounded-full border-4 border-brand border-t-transparent animate-spin" />
            </div>
          </div>

          <p className="text-base font-medium text-gray-700 dark:text-gray-300 mb-1">
            Personalizing your questions…
          </p>
          <p className="text-sm text-gray-400 dark:text-gray-500">
            Tailoring the assessment for your role and company
          </p>
          <button
            onClick={handleCancelLoading}
            className="mt-5 text-sm text-brand hover:text-blue-700 dark:hover:text-blue-300 underline underline-offset-2 transition-colors"
          >
            ← Choose a different pillar
          </button>
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
        <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400">
          Loading pillars…
        </div>
      </div>
    )
  }

  const visiblePillars = info.available_pillars.filter(shouldShow)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      <ProspectHeader />
      <div className="flex-1 py-10 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header with company + user info */}
        <div className="mb-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-1">
                {info.company_name}
              </p>
              <h1 className="text-2xl font-bold text-[#1B2B4B] dark:text-gray-100 mb-1">Select an Assessment Area</h1>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                Choose a pillar to assess. Each takes approximately 8 minutes.
              </p>
            </div>
            <div className="flex-shrink-0 text-right">
              {prospectName && (
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{prospectName}</p>
              )}
              {roleLabel && (
                <p className="text-xs text-gray-500 dark:text-gray-400">{roleLabel}</p>
              )}
              <button
                onClick={() => navigate(`/assess/${token}/research-summary`)}
                className="mt-2 text-xs text-brand hover:text-blue-700 dark:hover:text-blue-300 underline underline-offset-2 transition-colors"
              >
                ← Back to Company Profile
              </button>
            </div>
          </div>
        </div>

        {pillarError && (
          <div className="mb-6 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
            {pillarError}
          </div>
        )}

        <div className="space-y-3">
          {visiblePillars.map((pillar) => {
            const isSuggested = info.suggested_pillars.includes(pillar.id)
            const isDisabled = loadingPillar !== null

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
                    className="text-sm font-medium bg-brand text-white px-4 py-1.5 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-1"
                  >
                    Start →
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {visiblePillars.length === 0 && (
          <p className="text-center text-gray-500 dark:text-gray-400 mt-8">
            No assessment areas are available. Please contact your Datadog representative.
          </p>
        )}
      </div>
      </div>
    </div>
  )
}
