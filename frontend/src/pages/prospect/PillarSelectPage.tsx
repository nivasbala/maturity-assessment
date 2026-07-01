import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getAssessmentInfo, selectPillar } from '../../api/public'
import { extractApiError } from '../../api'
import type { AssessmentInfo, AvailablePillar } from '../../types'
import FloatingThemeToggle from '../../components/FloatingThemeToggle'

export default function PillarSelectPage() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()

  const [info, setInfo] = useState<AssessmentInfo | null>(null)
  const [loadError, setLoadError] = useState('')
  const [loadingPillarId, setLoadingPillarId] = useState<string | null>(null)
  const [pillarError, setPillarError] = useState('')

  const sessionToken = sessionStorage.getItem('session_token') ?? ''
  const p3Gate: boolean | null = JSON.parse(sessionStorage.getItem('p3_gate') ?? 'null')
  const p4Gate: boolean | null = JSON.parse(sessionStorage.getItem('p4_gate') ?? 'null')

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

  async function handleSelectPillar(pillar: AvailablePillar) {
    setPillarError('')
    setLoadingPillarId(pillar.id)
    try {
      const result = await selectPillar(token!, sessionToken, pillar.id)
      navigate(`/assess/${token}/assessment/${result.assessment_id}`, {
        state: { questions: result.questions },
      })
    } catch (e) {
      setPillarError(extractApiError(e, 'Failed to load questions. Please try again.'))
    } finally {
      setLoadingPillarId(null)
    }
  }

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <FloatingThemeToggle />
        <p className="text-red-600 dark:text-red-400">{loadError}</p>
      </div>
    )
  }

  if (!info) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <FloatingThemeToggle />
        <div className="text-gray-500 dark:text-gray-400">Loading pillars…</div>
      </div>
    )
  }

  const visiblePillars = info.available_pillars.filter(shouldShow)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4">
      <FloatingThemeToggle />
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <p className="text-sm font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-1">
            {info.company_name}
          </p>
          <h1 className="text-2xl font-bold text-[#1B2B4B] dark:text-gray-100 mb-2">Select an Assessment Area</h1>
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            Choose a pillar to assess. Each takes approximately 8 minutes.
          </p>
        </div>

        {pillarError && (
          <div className="mb-6 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
            {pillarError}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {visiblePillars.map((pillar) => {
            const isSuggested = info.suggested_pillars.includes(pillar.id)
            const isLoading = loadingPillarId === pillar.id
            const isDisabled = loadingPillarId !== null

            return (
              <div
                key={pillar.id}
                className={`relative bg-white dark:bg-gray-800 rounded-xl border p-5 flex flex-col ${
                  isSuggested ? 'border-[#0066FF]' : 'border-gray-200 dark:border-gray-700'
                }`}
              >
                {isSuggested && (
                  <span className="absolute top-3 right-3 text-xs font-semibold text-[#0066FF] bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-full">
                    Recommended
                  </span>
                )}
                <h2 className="text-base font-semibold text-[#1B2B4B] dark:text-gray-100 mb-1 pr-20">{pillar.name}</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 flex-1 line-clamp-2">{pillar.description}</p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400 dark:text-gray-500">~8 minutes</span>
                  <button
                    onClick={() => handleSelectPillar(pillar)}
                    disabled={isDisabled}
                    className="text-sm font-medium bg-[#0066FF] text-white px-4 py-1.5 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[#0066FF] focus:ring-offset-1"
                  >
                    {isLoading ? 'Personalizing your questions…' : 'Start Assessment'}
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
  )
}
