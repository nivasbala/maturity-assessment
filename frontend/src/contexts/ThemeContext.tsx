import { createContext, useContext, useEffect, useState } from 'react'

export const COLOR_THEMES = [
  { id: 'dark-green', label: 'Dark Green', swatch: '#2D6A4F' },
  { id: 'platinum-blue', label: 'Platinum Blue', swatch: '#3D6EA8' },
  { id: 'midnight-glass', label: 'Midnight Glass', swatch: '#535FC7' },
  { id: 'frost-steel', label: 'Frost & Steel', swatch: '#2F8298' },
  { id: 'signal', label: 'Signal', swatch: '#C17A2E' },
] as const

export type ColorTheme = (typeof COLOR_THEMES)[number]['id']

const DEFAULT_COLOR_THEME: ColorTheme = 'dark-green'

function isColorTheme(value: string | null): value is ColorTheme {
  return COLOR_THEMES.some((t) => t.id === value)
}

type ThemeContextType = {
  isDark: boolean
  toggle: () => void
  colorTheme: ColorTheme
  setColorTheme: (theme: ColorTheme) => void
}

const ThemeContext = createContext<ThemeContextType>({
  isDark: false,
  toggle: () => {},
  colorTheme: DEFAULT_COLOR_THEME,
  setColorTheme: () => {},
})

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(() => {
    const stored = localStorage.getItem('theme')
    if (stored) return stored === 'dark'
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })
  const [colorTheme, setColorTheme] = useState<ColorTheme>(() => {
    const stored = localStorage.getItem('colorTheme')
    return isColorTheme(stored) ? stored : DEFAULT_COLOR_THEME
  })

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark)
    localStorage.setItem('theme', isDark ? 'dark' : 'light')
  }, [isDark])

  useEffect(() => {
    document.documentElement.setAttribute('data-color-theme', colorTheme)
    localStorage.setItem('colorTheme', colorTheme)
  }, [colorTheme])

  const toggle = () => setIsDark((v) => !v)

  return (
    <ThemeContext.Provider value={{ isDark, toggle, colorTheme, setColorTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
