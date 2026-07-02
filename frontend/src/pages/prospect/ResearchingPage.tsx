import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getResearchSummary } from '../../api/public'
import { extractApiError } from '../../api'
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

export default function ResearchingPage() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()

  const sessionToken = sessionStorage.getItem('session_token') ?? ''
  const companyName = sessionStorage.getItem('prospect_company_name') ?? ''

  const [progress, setProgress] = useState(0)
  const [msgIdx, setMsgIdx] = useState(0)
  const [error, setError] = useState('')

  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const delayRef = useRef(2000)
  const doneRef = useRef(false)

  useEffect(() => {
    if (!sessionToken) {
      navigate(`/assess/${token}`, { replace: true })
    }
  }, [sessionToken, token, navigate])

  useEffect(() => {
    const p = setInterval(() => setProgress((v) => (v < 88 ? v + 2 : v)), 700)
    const m = setInterval(() => setMsgIdx((i) => (i + 1) % MESSAGES.length), 3000)
    return () => { clearInterval(p); clearInterval(m) }
  }, [])

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
          setTimeout(() => {
            if (!cancelled) navigate(`/assess/${token}/research-summary`)
          }, 400)
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
  }, [token, sessionToken, navigate])

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
