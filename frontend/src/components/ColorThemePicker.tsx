import { COLOR_THEMES, useTheme } from '../contexts/ThemeContext'

export default function ColorThemePicker() {
  const { colorTheme, setColorTheme } = useTheme()

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {COLOR_THEMES.map((t) => {
        const selected = t.id === colorTheme
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => setColorTheme(t.id)}
            aria-pressed={selected}
            className={`flex items-center gap-3 rounded-lg border px-3.5 py-3 text-left transition-colors ${
              selected
                ? 'border-brand ring-2 ring-brand bg-brand/5 dark:bg-brand/10'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            <span
              className="w-6 h-6 rounded-full shrink-0 border border-black/10 dark:border-white/10"
              style={{ backgroundColor: t.swatch }}
              aria-hidden="true"
            />
            <span className="text-sm font-medium text-gray-800 dark:text-gray-100">{t.label}</span>
          </button>
        )
      })}
    </div>
  )
}
