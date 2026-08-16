import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getResearchSummary } from '../../api/public'
import { extractApiError } from '../../api'
import AgentLoadingScreen from '../../components/AgentLoadingScreen'

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

  const [done, setDone] = useState(false)
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
    if (!token || !sessionToken) return

    let cancelled = false

    async function poll() {
      try {
        const data = await getResearchSummary(token!, sessionToken)
        if (cancelled) return

        if (data.is_ready) {
          if (doneRef.current) return
          doneRef.current = true
          setDone(true)
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
    <AgentLoadingScreen
      eyebrow={companyName || undefined}
      title="Analyzing your company profile…"
      progressLabel="Building your profile"
      messages={MESSAGES}
      estimatedTime="30–60 seconds"
      backLabel="← Back to Registration"
      onBack={() => navigate(`/assess/${token}`)}
      complete={done}
      error={error || undefined}
    />
  )
}
