import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { submitAssessment } from '../../api/public'
import { extractApiError } from '../../api'
import type { QuestionPublic } from '../../types'
import FloatingThemeToggle from '../../components/FloatingThemeToggle'

interface LocationState {
  questions: QuestionPublic[]
}

export default function AssessmentPage() {
  const { token, assessmentId } = useParams<{ token: string; assessmentId: string }>()
  const location = useLocation()
  const navigate = useNavigate()

  const state = location.state as LocationState | null
  const questions: QuestionPublic[] = state?.questions ?? []

  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const sessionToken = sessionStorage.getItem('session_token') ?? ''

  useEffect(() => {
    if (!sessionToken || questions.length === 0) {
      navigate(`/assess/${token}`)
    }
  }, [sessionToken, questions.length, token, navigate])

  if (questions.length === 0) {
    return null
  }

  const currentQuestion = questions[currentIndex]
  const totalQuestions = questions.length
  const selectedOptionId = answers[currentQuestion.id]
  const isLastQuestion = currentIndex === totalQuestions - 1
  const allAnswered = questions.every((q) => answers[q.id])

  function selectOption(optionId: string) {
    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: optionId }))
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

  async function handleSubmit() {
    if (!allAnswered) return
    setSubmitError('')
    setSubmitting(true)
    try {
      const answerList = questions.map((q) => ({
        question_id: q.id,
        answer_option_id: answers[q.id],
      }))
      const result = await submitAssessment(token!, sessionToken, assessmentId!, answerList)
      navigate(`/assess/${token}/report/${result.report_id}`)
    } catch (e) {
      setSubmitError(extractApiError(e, 'Submission failed. Please try again.'))
      setSubmitting(false)
    }
  }

  const progress = Math.round(((currentIndex + 1) / totalQuestions) * 100)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4">
      <FloatingThemeToggle />
      <div className="max-w-2xl mx-auto">
        {/* Progress */}
        <div className="mb-8">
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
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-8 mb-6">
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
        </div>

        {submitError && (
          <div className="mb-4 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
            {submitError}
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={goBack}
            disabled={currentIndex === 0}
            className="px-5 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-1"
          >
            Back
          </button>

          {!isLastQuestion ? (
            <button
              onClick={goNext}
              disabled={!selectedOptionId}
              className="px-6 py-2 text-sm font-semibold bg-brand text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-1"
            >
              Next
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!allAnswered || submitting}
              className="px-6 py-2 text-sm font-semibold bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-green-600 focus:ring-offset-1"
            >
              {submitting ? 'Submitting…' : 'Submit Assessment'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
