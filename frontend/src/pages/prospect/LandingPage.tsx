import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getAssessmentInfo, registerProspect } from '../../api/public'
import { extractApiError } from '../../api'
import type { AssessmentInfo, AvailablePillar } from '../../types'
import { PERSONAS } from '../../types'

export default function LandingPage() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()

  const [info, setInfo] = useState<AssessmentInfo | null>(null)
  const [loadError, setLoadError] = useState('')

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('')
  const [gateAnswers, setGateAnswers] = useState<Record<string, boolean | null>>({})
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  useEffect(() => {
    if (!token) return
    getAssessmentInfo(token)
      .then(setInfo)
      .catch((e) => setLoadError(extractApiError(e, 'Failed to load assessment.')))
  }, [token])

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
      const p3Pillar = gatedPillars.find((p) => p.name.toLowerCase().includes('ai system') || p.name.toLowerCase().includes('p3'))
      const p4Pillar = gatedPillars.find((p) => p.name.toLowerCase().includes('ml') || p.name.toLowerCase().includes('p4') || p.name.toLowerCase().includes('foundation'))

      // Derive gate answers by pillar display_order — use gated pillar index as proxy
      // The backend checks display_order 3 for P3 gate and display_order 4 for P4 gate.
      // Frontend passes them by matching the gate question text to P3/P4 concepts.
      const p3Gate = p3Pillar ? (gateAnswers[p3Pillar.id] ?? null) : null
      const p4Gate = p4Pillar ? (gateAnswers[p4Pillar.id] ?? null) : null

      // Fallback: assign by order of appearance in gatedPillars
      const gateByIndex = gatedPillars.map((gp) => gateAnswers[gp.id] ?? null)
      const p3GateFinal = p3Gate !== null ? p3Gate : (gateByIndex[0] ?? null)
      const p4GateFinal = p4Gate !== null ? p4Gate : (gateByIndex[1] ?? null)

      const result = await registerProspect(token!, {
        prospect_name: `${firstName.trim()} ${lastName.trim()}`,
        prospect_email: email.trim(),
        prospect_role: role,
        p3_gate_answered_yes: p3GateFinal,
        p4_gate_answered_yes: p4GateFinal,
      })

      sessionStorage.setItem('session_token', result.session_token)
      sessionStorage.setItem('p3_gate', JSON.stringify(p3GateFinal))
      sessionStorage.setItem('p4_gate', JSON.stringify(p4GateFinal))
      navigate(`/assess/${token}/pillars`)
    } catch (e) {
      setFormError(extractApiError(e, 'Registration failed. Please try again.'))
    } finally {
      setSubmitting(false)
    }
  }

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-red-600 font-medium">{loadError}</p>
        </div>
      </div>
    )
  }

  if (!info) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500">Loading assessment…</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center py-12 px-4">
      <div className="w-full max-w-lg bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        {/* Header */}
        <div className="mb-8">
          <p className="text-sm font-medium text-blue-600 uppercase tracking-wider mb-1">
            {info.company_name}
          </p>
          <h1 className="text-2xl font-bold text-[#1B2B4B] mb-3">Maturity Assessment</h1>
          <p className="text-gray-600 text-sm leading-relaxed">
            This assessment will evaluate your organization's technology maturity across key pillars.
            Your answers will generate a personalized report with actionable recommendations.
          </p>
        </div>

        {/* Form */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0066FF] focus:border-transparent"
                placeholder="Jane"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0066FF] focus:border-transparent"
                placeholder="Smith"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Work Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0066FF] focus:border-transparent"
              placeholder="jane@company.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Your Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0066FF] focus:border-transparent bg-white"
            >
              <option value="">Select your role…</option>
              {PERSONAS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          {/* Gate questions — rendered for each active gated pillar */}
          {gatedPillars.map((gp) => (
            <GateQuestion
              key={gp.id}
              pillar={gp}
              value={gateAnswers[gp.id] ?? null}
              onChange={(val) => handleGate(gp.id, val)}
            />
          ))}

          {formError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
              {formError}
            </p>
          )}

          <button
            onClick={handleBegin}
            disabled={submitting}
            className="w-full bg-[#0066FF] text-white font-semibold py-3 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[#0066FF] focus:ring-offset-2"
          >
            {submitting ? 'Starting…' : 'Begin Assessment'}
          </button>
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
    <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
      <p className="text-sm font-medium text-gray-700 mb-3">{pillar.gate_question}</p>
      <div className="flex gap-6">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name={`gate-${pillar.id}`}
            checked={value === true}
            onChange={() => onChange(true)}
            className="accent-[#0066FF]"
          />
          <span className="text-sm text-gray-700">Yes</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name={`gate-${pillar.id}`}
            checked={value === false}
            onChange={() => onChange(false)}
            className="accent-[#0066FF]"
          />
          <span className="text-sm text-gray-700">No</span>
        </label>
      </div>
    </div>
  )
}
