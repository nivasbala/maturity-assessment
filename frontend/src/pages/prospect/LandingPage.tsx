import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams, Link } from 'react-router-dom'
import { getAssessmentInfo, registerProspect } from '../../api/public'
import { extractApiError } from '../../api'
import type { AssessmentInfo, AvailablePillar } from '../../types'
import { PERSONAS } from '../../types'
import ProspectHeader from '../../components/ProspectHeader'

const INPUT_CLS = 'w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent'
const TEXTAREA_CLS = `${INPUT_CLS} resize-none`

export default function LandingPage() {
  const { token } = useParams<{ token: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const [info, setInfo] = useState<AssessmentInfo | null>(null)
  const [loadError, setLoadError] = useState('')

  // Seed from URL query params (?name=Jane+Smith&email=jane@co.com) first,
  // then fall back to sessionStorage for returning visitors.
  const urlName = searchParams.get('name') ?? ''
  const urlEmail = searchParams.get('email') ?? ''
  const urlParts = urlName.split(' ')
  const savedName = sessionStorage.getItem('prospect_name') ?? ''
  const savedParts = savedName.split(' ')

  const [firstName, setFirstName] = useState(urlParts[0] || savedParts[0] || '')
  const [lastName, setLastName] = useState(urlParts.slice(1).join(' ') || savedParts.slice(1).join(' ') || '')
  const [email, setEmail] = useState(urlEmail || sessionStorage.getItem('prospect_email') || '')
  const [role, setRole] = useState(sessionStorage.getItem('prospect_role') ?? '')
  const [gateAnswers, setGateAnswers] = useState<Record<string, boolean | null>>({})
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [infrastructureLocation, setInfrastructureLocation] = useState(
    sessionStorage.getItem('infrastructure_location') ?? ''
  )
  const [techStackDescription, setTechStackDescription] = useState(
    sessionStorage.getItem('tech_stack_description') ?? ''
  )
  const [currentTools, setCurrentTools] = useState(
    sessionStorage.getItem('current_tools') ?? ''
  )
  const [keyChallengesInput, setKeyChallengesInput] = useState(
    sessionStorage.getItem('key_challenges_input') ?? ''
  )

  useEffect(() => {
    if (!token) return
    getAssessmentInfo(token)
      .then((data) => {
        setInfo(data)
        if (data.prospect_email) setEmail(data.prospect_email)
        if (data.prospect_name) {
          const parts = data.prospect_name.trim().split(' ')
          setFirstName((prev) => prev || parts[0] || '')
          setLastName((prev) => prev || parts.slice(1).join(' ') || '')
        }
        // Pre-populate context fields from saved prospect data
        if (data.infrastructure_location) setInfrastructureLocation((prev) => prev || data.infrastructure_location!)
        if (data.tech_stack_description) setTechStackDescription((prev) => prev || data.tech_stack_description!)
        if (data.current_tools) setCurrentTools((prev) => prev || data.current_tools!)
        if (data.key_challenges_input) setKeyChallengesInput((prev) => prev || data.key_challenges_input!)
      })
      .catch((e) => {
        setLoadError(extractApiError(e, 'Failed to load assessment.'))
      })
  }, [token])

  // Restore gate answers from sessionStorage once pillar IDs are known
  useEffect(() => {
    if (!info) return
    const gated = info.available_pillars.filter((p) => p.is_gated)
    if (gated.length === 0) return
    const p3Raw = sessionStorage.getItem('p3_gate')
    const p4Raw = sessionStorage.getItem('p4_gate')
    const restored: Record<string, boolean | null> = {}
    if (gated[0] && p3Raw !== null) {
      const val: boolean | null = JSON.parse(p3Raw)
      if (val !== null) restored[gated[0].id] = val
    }
    if (gated[1] && p4Raw !== null) {
      const val: boolean | null = JSON.parse(p4Raw)
      if (val !== null) restored[gated[1].id] = val
    }
    if (Object.keys(restored).length > 0) {
      setGateAnswers((prev) => ({ ...restored, ...prev }))
    }
  }, [info])

  const gatedPillars = info?.available_pillars.filter((p) => p.is_gated) ?? []

  function handleGate(pillarId: string, val: boolean) {
    setGateAnswers((prev) => ({ ...prev, [pillarId]: val }))
  }

  async function handleBegin() {
    setFormError('')
    if (!firstName.trim() || !lastName.trim()) {
      setFormError('First and last name are required.')
      return
    }
    if (!email.trim()) {
      setFormError('Email is required.')
      return
    }
    if (!role) {
      setFormError('Please select your role.')
      return
    }
    for (const gp of gatedPillars) {
      if (gateAnswers[gp.id] === undefined || gateAnswers[gp.id] === null) {
        setFormError(`Please answer the gate question for: ${gp.name}`)
        return
      }
    }

    setSubmitting(true)
    try {
      // gatedPillars ordered by display_order from backend (P3 first, P4 second)
      const gateByIndex = gatedPillars.map((gp) => gateAnswers[gp.id] ?? null)
      const p3GateFinal = gateByIndex[0] ?? null
      const p4GateFinal = gateByIndex[1] ?? null

      const result = await registerProspect(token!, {
        prospect_name: `${firstName.trim()} ${lastName.trim()}`,
        prospect_email: email.trim(),
        prospect_role: role,
        p3_gate_answered_yes: p3GateFinal,
        p4_gate_answered_yes: p4GateFinal,
        infrastructure_location: infrastructureLocation.trim() || null,
        tech_stack_description: techStackDescription.trim() || null,
        current_tools: currentTools.trim() || null,
        key_challenges_input: keyChallengesInput.trim() || null,
      })

      sessionStorage.setItem('session_token', result.session_token)
      sessionStorage.setItem('p3_gate', JSON.stringify(p3GateFinal))
      sessionStorage.setItem('p4_gate', JSON.stringify(p4GateFinal))
      // Clear stale cached pillar assessment IDs so selectPillar fires fresh
      // on every registration, ensuring Agent 2 runs with current context.
      for (const key of Object.keys(sessionStorage)) {
        if (key.startsWith(`pillar_assessment_${token!}_`)) {
          sessionStorage.removeItem(key)
        }
      }
      sessionStorage.setItem('prospect_name', `${firstName.trim()} ${lastName.trim()}`)
      sessionStorage.setItem('prospect_role', role)
      sessionStorage.setItem('prospect_email', email.trim())
      sessionStorage.setItem('infrastructure_location', infrastructureLocation.trim())
      sessionStorage.setItem('tech_stack_description', techStackDescription.trim())
      sessionStorage.setItem('current_tools', currentTools.trim())
      sessionStorage.setItem('key_challenges_input', keyChallengesInput.trim())
      navigate(`/assess/${token}/pillars`)
    } catch (e) {
      setFormError(extractApiError(e, 'Registration failed. Please try again.'))
    } finally {
      setSubmitting(false)
    }
  }

  if (loadError) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
        <ProspectHeader />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-red-600 dark:text-red-400 font-medium">{loadError}</p>
        </div>
      </div>
    )
  }

  if (!info) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
        <ProspectHeader />
        <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400">
          Loading assessment…
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      <ProspectHeader />
      <div className="flex-1 flex items-center justify-center py-6 px-4">
        <div className="w-full max-w-3xl bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">

          {/* Header */}
          <div className="mb-5">
            <p className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-1">
              {info.company_name}
            </p>
            <h1 className="text-xl font-bold text-[#1B2B4B] dark:text-gray-100 mb-1">
              Observability Maturity Assessment
            </h1>
            <p className="text-gray-500 dark:text-gray-400 text-xs leading-relaxed">
              Answer a few questions to receive a personalized maturity report with actionable recommendations.
            </p>
          </div>

          {/* Returning visitor — existing assessments */}
          {info.is_registered && info.existing_assessments.length > 0 && (
            <div className="mb-5 border border-blue-200 dark:border-blue-800 rounded-lg bg-blue-50 dark:bg-blue-950/30 p-4">
              <p className="text-sm font-semibold text-blue-700 dark:text-blue-300 mb-1">
                Welcome back — your previous assessments
              </p>
              <p className="text-xs text-blue-600 dark:text-blue-400 mb-3">
                You can view your completed reports below, or fill in the form and start a new pillar assessment.
              </p>
              <div className="space-y-2">
                {info.existing_assessments.map((a) => (
                  <div
                    key={a.assessment_id}
                    className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-lg px-3 py-2 border border-gray-200 dark:border-gray-700"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{a.pillar_name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{a.status.replace('_', ' ')}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      {a.pillar_score !== null && (
                        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                          {a.pillar_score.toFixed(1)} / 4.0
                        </span>
                      )}
                      {a.status === 'completed' ? (
                        <Link
                          to={`/assess/${token}/report/${a.assessment_id}`}
                          className="text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 underline"
                        >
                          View report
                        </Link>
                      ) : (
                        <span className="text-xs text-gray-400 dark:text-gray-500">In progress</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {info.is_registered && (
            <div className="mb-4 px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
              <p className="text-xs text-amber-700 dark:text-amber-300">
                Your details are pre-filled below. Update them if needed, then click <strong>Begin Assessment</strong> to start a new pillar.
              </p>
            </div>
          )}

          {/* Two-column form */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Left: identity + gate questions */}
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">First Name</label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className={INPUT_CLS}
                    placeholder="Jane"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Last Name</label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className={INPUT_CLS}
                    placeholder="Smith"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Work Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => { if (!info?.prospect_email) setEmail(e.target.value) }}
                  readOnly={!!info?.prospect_email}
                  className={`${INPUT_CLS} ${info?.prospect_email ? 'bg-gray-100 dark:bg-gray-600 cursor-not-allowed' : ''}`}
                  placeholder="jane@company.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Your Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className={INPUT_CLS}
                >
                  <option value="">Select your role…</option>
                  {PERSONAS.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>

              {/* Gate questions */}
              {gatedPillars.map((gp) => (
                <GateQuestion
                  key={gp.id}
                  pillar={gp}
                  value={gateAnswers[gp.id] ?? null}
                  onChange={(val) => handleGate(gp.id, val)}
                />
              ))}
            </div>

            {/* Right: optional context */}
            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-0.5">
                  Add context{' '}
                  <span className="text-gray-400 dark:text-gray-500 font-normal text-xs">(optional)</span>
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  Helps us select the most relevant questions for your environment.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Infrastructure &amp; deployment
                </label>
                <textarea
                  rows={2}
                  value={infrastructureLocation}
                  onChange={(e) => setInfrastructureLocation(e.target.value)}
                  placeholder="e.g. AWS us-east-1, on-premises DB, GCP for ML"
                  className={TEXTAREA_CLS}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Tech stack
                </label>
                <textarea
                  rows={2}
                  value={techStackDescription}
                  onChange={(e) => setTechStackDescription(e.target.value)}
                  placeholder="e.g. Python microservices, Kubernetes, PostgreSQL, Kafka"
                  className={TEXTAREA_CLS}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Current tools
                </label>
                <textarea
                  rows={2}
                  value={currentTools}
                  onChange={(e) => setCurrentTools(e.target.value)}
                  placeholder="e.g. Datadog, PagerDuty, GitHub Actions, Terraform"
                  className={TEXTAREA_CLS}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Key challenges
                </label>
                <textarea
                  rows={2}
                  value={keyChallengesInput}
                  onChange={(e) => setKeyChallengesInput(e.target.value)}
                  placeholder="e.g. Alert fatigue, slow incident triage, no observability on ML pipelines"
                  className={TEXTAREA_CLS}
                />
              </div>
            </div>
          </div>

          {/* Error + submit */}
          <div className="mt-5 space-y-3">
            {formError && (
              <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                {formError}
              </p>
            )}
            <button
              onClick={handleBegin}
              disabled={submitting}
              className="w-full bg-brand text-white font-semibold py-2.5 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2"
            >
              {submitting ? 'Starting…' : 'Begin Assessment'}
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}

function GateQuestion({
  pillar,
  value,
  onChange,
}: {
  pillar: AvailablePillar
  value: boolean | null
  onChange: (val: boolean) => void
}) {
  return (
    <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-3 bg-gray-50 dark:bg-gray-700">
      <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">{pillar.gate_question}</p>
      <div className="flex gap-6">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name={`gate-${pillar.id}`}
            checked={value === true}
            onChange={() => onChange(true)}
            className="accent-brand"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">Yes</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name={`gate-${pillar.id}`}
            checked={value === false}
            onChange={() => onChange(false)}
            className="accent-brand"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">No</span>
        </label>
      </div>
    </div>
  )
}
