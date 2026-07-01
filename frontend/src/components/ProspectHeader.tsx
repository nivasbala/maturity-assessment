import { Link } from 'react-router-dom'
import DarkModeToggle from './DarkModeToggle'

export default function ProspectHeader() {
  return (
    <header className="bg-[#1B2B4B] px-8 h-12 flex items-center justify-between shrink-0">
      <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
        <svg width="20" height="20" viewBox="0 0 32 32" fill="none" aria-hidden="true">
          <rect x="2" y="5" width="28" height="18" rx="2" stroke="#3B82F6" strokeWidth="1.8"/>
          <polyline points="6,14 10,14 12,8 16,20 19,10 22,14 26,14" stroke="#3B82F6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          <line x1="13" y1="23" x2="19" y2="23" stroke="#3B82F6" strokeWidth="1.8"/>
          <line x1="16" y1="23" x2="16" y2="28" stroke="#3B82F6" strokeWidth="1.8"/>
          <line x1="11" y1="28" x2="21" y2="28" stroke="#3B82F6" strokeWidth="1.8"/>
        </svg>
        <span className="text-white font-semibold text-sm tracking-tight">
          Observability Maturity Assessment
        </span>
      </Link>
      <DarkModeToggle />
    </header>
  )
}
