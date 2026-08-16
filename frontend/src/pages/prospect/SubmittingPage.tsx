import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { submitAssessment } from '../../api/public'
import { extractApiError } from '../../api'
import AgentLoadingScreen from '../../components/AgentLoadingScreen'

interface LocationState {
  answers: { question_id: string; answer_option_id: string }[]
  companyName?: string
  pillarName?: string
  prospectName?: string
  prospectRole?: string
}

const MESSAGES = [
  'Analyzing your responses…',
  'Calculating your maturity score…',
  'Identifying capability gaps…',
  'Mapping strengths across pillars…',
  'Generating your observability maturity report…',
  'Researching industry context…',
  'Building prioritized recommendations…',
  'Drafting your executive summary…',
  'Preparing next steps…',
  'Almost there…',
]

export default function SubmittingPage() {
  const { token, assessmentId } = useParams<{ token: string; assessmentId: string }>()
  const location = useLocation()
  const navigate = useNavigate()

  const state = location.state as LocationState | null
  const sessionToken = sessionStorage.getItem('session_token') ?? ''

  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const submitted = useRef(false)

  useEffect(() => {
    if (!state?.answers || !token || !assessmentId || !sessionToken) {
      navigate(`/assess/${token}`)
      return
    }
    if (submitted.current) return
    submitted.current = true

    submitAssessment(token, sessionToken, assessmentId, state.answers)
      .then(() => {
        setDone(true)
        setTimeout(() => navigate(`/assess/${token}/report/${assessmentId}`), 500)
      })
      .catch((e) => {
        setError(extractApiError(e, 'Submission failed. Please try again.'))
      })
  }, [])

  const companyName = state?.companyName ?? ''
  const pillarName = state?.pillarName ?? ''
  const prospectName = state?.prospectName ?? ''
  const prospectRole = state?.prospectRole ?? ''

  return (
    <AgentLoadingScreen
      eyebrow={companyName || undefined}
      title={pillarName || undefined}
      subtitle={
        prospectName
          ? `${prospectName}${prospectRole ? ` · ${prospectRole}` : ''}`
          : undefined
      }
      progressLabel="Generating your report"
      messages={MESSAGES}
      estimatedTime="15–45 seconds"
      backLabel="← Back to Assessment"
      onBack={() => navigate(-1)}
      complete={done}
      error={error || undefined}
      errorBackLabel="← Go back and try again"
    />
  )
}
