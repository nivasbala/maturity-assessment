import { useEffect, useState, type ReactNode } from 'react'
import ProspectHeader from './ProspectHeader'

interface AgentLoadingScreenProps {
  eyebrow?: string
  title?: ReactNode
  subtitle?: ReactNode
  progressLabel: string
  messages: string[]
  estimatedTime: string
  backLabel: string
  onBack: () => void
  /** Set true once the underlying agent call resolves — snaps progress to 100% before the caller navigates away. */
  complete?: boolean
  error?: string
  errorBackLabel?: string
  onErrorBack?: () => void
}

/**
 * Shared "agent is working" loading screen used by every page that waits on a
 * background LLM call (research, question selection, report generation).
 * Owns the stall-at-88% progress bar and cycling status message so every
 * call site stays visually and behaviorally consistent.
 */
export default function AgentLoadingScreen({
  eyebrow,
  title,
  subtitle,
  progressLabel,
  messages,
  estimatedTime,
  backLabel,
  onBack,
  complete = false,
  error,
  errorBackLabel,
  onErrorBack,
}: AgentLoadingScreenProps) {
  const [progress, setProgress] = useState(0)
  const [msgIdx, setMsgIdx] = useState(0)

  useEffect(() => {
    if (error || complete) return
    const p = setInterval(() => setProgress((v) => (v < 88 ? v + 2 : v)), 700)
    const m = setInterval(() => setMsgIdx((i) => (i + 1) % messages.length), 3000)
    return () => {
      clearInterval(p)
      clearInterval(m)
    }
  }, [error, complete, messages.length])

  useEffect(() => {
    if (complete) setProgress(100)
  }, [complete])

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      <ProspectHeader />
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-10 text-center">
          <div className="mb-8">
            {eyebrow && (
              <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-1">
                {eyebrow}
              </p>
            )}
            {title && (
              <h2 className="text-xl font-bold text-[#1B2B4B] dark:text-gray-100 mb-1">
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {subtitle}
              </p>
            )}
          </div>

          {error ? (
            <div className="space-y-4">
              <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                {error}
              </p>
              <button
                onClick={onErrorBack ?? onBack}
                className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 underline underline-offset-2 transition-colors"
              >
                {errorBackLabel ?? backLabel}
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
                  <span>{progressLabel}</span>
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
                    {messages[msgIdx]}
                  </span>
                </div>
              </div>

              <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
                This usually takes {estimatedTime}
              </p>

              <button
                onClick={onBack}
                className="mt-5 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 underline underline-offset-2 transition-colors"
              >
                {backLabel}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
