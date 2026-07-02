import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import type { QuestionPublic } from '../../types'
import ProspectHeader from '../../components/ProspectHeader'

interface LocationState {
  questions: QuestionPublic[]
  companyName?: string
  pillarName?: string
  prospectName?: string
  prospectRole?: string
}

export default function AssessmentPage() {
  const { token, assessmentId } = useParams<{ token: string; assessmentId: string }>()
  const location = useLocation()
  const navigate = useNavigate()

  const state = location.state as LocationState | null
  const questions: QuestionPublic[] = state?.questions ?? []
  const companyName = state?.companyName ?? ''
  const pillarName = state?.pillarName ?? ''
  const prospectName = state?.prospectName ?? sessionStorage.getItem('prospect_name') ?? ''
  const prospectRole = state?.prospectRole ?? ''

  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>(() => {
    try {
      const stored = sessionStorage.getItem(`assessment_answers_${assessmentId}`)
      return stored ? (JSON.parse(stored) as Record<string, string>) : {}
    } catch {
      return {}
    }
  })

  const sessionToken = sessionStorage.getItem('session_token') ?? ''

  const sessionExpired = !sessionToken

  useEffect(() => {
    if (!sessionExpired && questions.length === 0) {
      navigate(`/assess/${token}/pillars`, { replace: true })
    }
  }, [sessionExpired, questions.length, token, navigate])

  if (sessionExpired) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
        <ProspectHeader />
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-8 text-center">
            <p className="text-gray-700 dark:text-gray-300 font-medium mb-2">Your session has expired.</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
              Please return to pillar selection to restart your assessment.
            </p>
            <button
              onClick={() => navigate(`/assess/${token}/pillars`)}
              className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 underline underline-offset-2 transition-colors"
            >
              ← Back to Pillar Selection
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (questions.length === 0) {
    return null
  }

  const currentQuestion = questions[currentIndex]
  const totalQuestions = questions.length
  const selectedOptionId = answers[currentQuestion.id]
  const isLastQuestion = currentIndex === totalQuestions - 1
  const allAnswered = questions.every((q) => answers[q.id])

  function selectOption(optionId: string) {
    setAnswers((prev) => {
      const next = { ...prev, [currentQuestion.id]: optionId }
      try {
        sessionStorage.setItem(`assessment_answers_${assessmentId}`, JSON.stringify(next))
      } catch {
        // storage full or unavailable — answers still work in memory
      }
      return next
    })
    if (currentIndex < totalQuestions - 1) {
      setTimeout(() => setCurrentIndex((i) => i + 1), 300)
    }
  }

  function goNext() {
    if (currentIndex < totalQuestions - 1) {
      setCurrentIndex((i) => i + 1)
    }
  }

  function goBack() {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1)
    }
  }

  function handleSubmit() {
    if (!allAnswered) return
    const answerList = questions.map((q) => ({
      question_id: q.id,
      answer_option_id: answers[q.id],
    }))
    navigate(`/assess/${token}/submitting/${assessmentId}`, {
      state: { answers: answerList, companyName, pillarName, prospectName, prospectRole },
    })
  }

  const progress = Math.round(((currentIndex + 1) / totalQuestions) * 100)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      <ProspectHeader />
      <div className="flex-1 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Company + user info header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            {companyName && (
              <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-0.5">
                {companyName}
              </p>
            )}
            {pillarName && (
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{pillarName}</p>
            )}
          </div>
          <div className="text-right">
            {prospectName && (
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{prospectName}</p>
            )}
            {prospectRole && (
              <p className="text-xs text-gray-400 dark:text-gray-500">{prospectRole}</p>
            )}
            <button
              onClick={() => navigate(`/assess/${token}/pillars`)}
              className="mt-1 text-xs text-brand hover:text-blue-700 dark:hover:text-blue-300 underline underline-offset-2 transition-colors"
            >
              ← Back to Pillar Selection
            </button>
          </div>
        </div>

        {/* Progress */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Question {currentIndex + 1} of {totalQuestions}
            </span>
            <span className="text-sm text-gray-400 dark:text-gray-500">{progress}%</span>
          </div>
          <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-brand rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Question card */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-8 mb-4">
          <h2 className="text-lg font-semibold text-[#1B2B4B] dark:text-gray-100 mb-6 leading-snug">
            {currentQuestion.text}
          </h2>

          <div className="space-y-3">
            {currentQuestion.answer_options.map((option) => {
              const isSelected = selectedOptionId === option.id
              return (
                <button
                  key={option.id}
                  onClick={() => selectOption(option.id)}
                  className={`w-full text-left border rounded-lg px-4 py-3 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-1 ${
                    isSelected
                      ? 'border-brand bg-blue-50 dark:bg-blue-900/20 text-[#1B2B4B] dark:text-gray-100 font-medium'
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  <span className="inline-block w-5 h-5 rounded-full border-2 mr-3 align-middle flex-shrink-0 transition-colors" style={{
                    borderColor: isSelected ? '#2563EB' : '#d1d5db',
                    backgroundColor: isSelected ? '#2563EB' : 'transparent',
                  }} />
                  {option.text}
                </button>
              )
            })}
          </div>

          {/* Navigation inside card */}
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100 dark:border-gray-700">
            <button
              onClick={goBack}
              disabled={currentIndex === 0}
              className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-1"
            >
              ← Previous
            </button>

            {isLastQuestion && (
              <button
                onClick={handleSubmit}
                disabled={!allAnswered}
                className="px-5 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-1"
              >
                Submit Assessment
              </button>
            )}
          </div>
        </div>

      </div>
      </div>
    </div>
  )
}
