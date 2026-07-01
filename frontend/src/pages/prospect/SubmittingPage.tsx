import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { submitAssessment } from '../../api/public'
import { extractApiError } from '../../api'
import ProspectHeader from '../../components/ProspectHeader'

interface LocationState {
  answers: { question_id: string; answer_option_id: string }[]
  companyName?: string
  pillarName?: string
  prospectName?: string
  prospectRole?: string
}

const MESSAGES = [
  'AI is personalizing your questions…',
  'Analyzing your responses…',
  'Researching your company profile…',
  'Identifying capability gaps…',
  'Generating your maturity assessment…',
  'Calculating scores and recommendations…',
  'Mapping strengths across pillars…',
  'Building your personalized report…',
  'Preparing prioritized next steps…',
  'Almost there…',
]

export default function SubmittingPage() {
  const { token, assessmentId } = useParams<{ token: string; assessmentId: string }>()
  const location = useLocation()
  const navigate = useNavigate()

  const state = location.state as LocationState | null
  const sessionToken = sessionStorage.getItem('session_token') ?? ''

  const [progress, setProgress] = useState(0)
  const [msgIdx, setMsgIdx] = useState(0)
  const [error, setError] = useState('')
  const submitted = useRef(false)

  useEffect(() => {
    if (!state?.answers || !token || !assessmentId || !sessionToken) {
      navigate(`/assess/${token}`)
      return
    }
    if (submitted.current) return
    submitted.current = true

    // Fake progress: increment ~2% every 700ms, capped at 88%
    const progressTimer = setInterval(() => {
      setProgress((p) => (p < 88 ? p + 2 : p))
    }, 700)

    // Cycle messages every 3s
    const msgTimer = setInterval(() => {
      setMsgIdx((i) => (i + 1) % MESSAGES.length)
    }, 3000)

    submitAssessment(token, sessionToken, assessmentId, state.answers)
      .then(() => {
        clearInterval(progressTimer)
        clearInterval(msgTimer)
        setProgress(100)
        setTimeout(() => navigate(`/assess/${token}/report/${assessmentId}`), 500)
      })
      .catch((e) => {
        clearInterval(progressTimer)
        clearInterval(msgTimer)
        setError(extractApiError(e, 'Submission failed. Please try again.'))
      })

    return () => {
      clearInterval(progressTimer)
      clearInterval(msgTimer)
    }
  }, [])

  const companyName = state?.companyName ?? ''
  const pillarName = state?.pillarName ?? ''
  const prospectName = state?.prospectName ?? ''
  const prospectRole = state?.prospectRole ?? ''

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      <ProspectHeader />
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-10 text-center">

          {/* Company + user info */}
          <div className="mb-8">
            {companyName && (
              <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-1">
                {companyName}
              </p>
            )}
            {pillarName && (
              <h2 className="text-xl font-bold text-[#1B2B4B] dark:text-gray-100 mb-1">
                {pillarName}
              </h2>
            )}
            {prospectName && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {prospectName}{prospectRole ? ` · ${prospectRole}` : ''}
              </p>
            )}
          </div>

          {error ? (
            <div className="space-y-4">
              <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                {error}
              </p>
              <button
                onClick={() => navigate(-1)}
                className="text-sm text-brand hover:underline"
              >
                ← Go back and try again
              </button>
            </div>
          ) : (
            <>
              {/* Progress bar */}
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

              {/* Cycling message badge */}
              <div className="flex justify-center mt-4">
                <div className="inline-flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-full px-4 py-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse shrink-0" />
                  <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                    {MESSAGES[msgIdx]}
                  </span>
                </div>
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
                This usually takes 15–45 seconds
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
