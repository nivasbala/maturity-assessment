import { useState } from 'react'

interface PdfThemeModalProps {
  onDownload: (darkMode: boolean) => void
  onClose: () => void
}

export default function PdfThemeModal({ onDownload, onClose }: PdfThemeModalProps) {
  const [dark, setDark] = useState(false)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" />

      {/* Modal */}
      <div
        className="relative w-full max-w-sm bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-1">
          Download PDF
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
          Choose a theme for your report
        </p>

        {/* Theme cards */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {/* Light */}
          <button
            type="button"
            onClick={() => setDark(false)}
            className={`rounded-xl border-2 p-4 text-left transition-all focus:outline-none ${
              !dark
                ? 'border-blue-600 ring-2 ring-blue-600 dark:border-blue-400 dark:ring-blue-400'
                : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
            }`}
          >
            <div className="h-12 rounded-lg bg-white border border-gray-200 mb-3" />
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">Light</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">White background</p>
          </button>

          {/* Dark */}
          <button
            type="button"
            onClick={() => setDark(true)}
            className={`rounded-xl border-2 p-4 text-left transition-all focus:outline-none ${
              dark
                ? 'border-blue-600 ring-2 ring-blue-600 dark:border-blue-400 dark:ring-blue-400'
                : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
            }`}
          >
            <div className="h-12 rounded-lg mb-3" style={{ backgroundColor: '#1f2937' }} />
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">Dark</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Dark background</p>
          </button>
        </div>

        <button
          type="button"
          onClick={() => { onDownload(dark); onClose() }}
          className="w-full bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white font-semibold py-2.5 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
        >
          Download PDF
        </button>

        <button
          type="button"
          onClick={onClose}
          className="mt-3 w-full text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
