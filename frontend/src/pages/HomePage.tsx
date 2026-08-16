import React, { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import DarkModeToggle from '../components/DarkModeToggle'

const PILLARS = [
  {
    icon: 'stack-trace',
    title: 'Full-Stack Observability',
    description:
      'Assess your ability to collect, correlate, and act on metrics, logs, and traces across your entire stack.',
  },
  {
    icon: 'anomaly-spike',
    title: 'AIOps & Intelligent Observability',
    description:
      'Evaluate how effectively your team uses AI-driven alerting, anomaly detection, and automated root cause analysis.',
  },
  {
    icon: 'inference-graph',
    title: 'AI System Observability',
    description:
      'Understand your maturity in monitoring and debugging AI-powered applications in production.',
  },
  {
    icon: 'model-pipeline',
    title: 'ML & Foundation Model Ops',
    description:
      'Gauge your operational readiness for training, fine-tuning, and managing machine learning models at scale.',
  },
  {
    icon: 'shield-scan',
    title: 'Security & DevSecOps',
    description:
      'Benchmark your security observability — threat detection, compliance monitoring, and shift-left practices.',
  },
] as const

/* ── Pillar icons — each drawn from a real observability artifact, not a generic glyph ── */
function PillarIcon({ name }: { name: string }) {
  const common = {
    width: 24,
    height: 24,
    viewBox: '0 0 24 24',
    fill: 'none',
    'aria-hidden': true as const,
  }
  const stroke = { stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

  switch (name) {
    case 'stack-trace':
      // Three infra layers with a single trace threading down through all of them
      return (
        <svg {...common}>
          <rect x="3" y="3.5" width="18" height="4" rx="1" {...stroke} />
          <rect x="3" y="10" width="18" height="4" rx="1" {...stroke} />
          <rect x="3" y="16.5" width="18" height="4" rx="1" {...stroke} />
          <line x1="7" y1="5.5" x2="7" y2="18.5" {...stroke} strokeDasharray="1.5 2" />
          <circle cx="7" cy="5.5" r="1.3" fill="currentColor" />
          <circle cx="7" cy="12" r="1.3" fill="currentColor" />
          <circle cx="7" cy="18.5" r="1.3" fill="currentColor" />
        </svg>
      )
    case 'anomaly-spike':
      // A metric line with one deviation circled — the moment AIOps exists to catch
      return (
        <svg {...common}>
          <polyline points="3,16.5 7,15 10,17.5 13,7 16,14.5 21,12" {...stroke} />
          <circle cx="13" cy="7" r="2.6" {...stroke} />
        </svg>
      )
    case 'inference-graph':
      // A small inference call graph with one node under inspection
      return (
        <svg {...common}>
          <line x1="12" y1="13" x2="6" y2="18" {...stroke} />
          <line x1="12" y1="13" x2="18" y2="18" {...stroke} />
          <line x1="12" y1="13" x2="12" y2="6" {...stroke} />
          <circle cx="6" cy="18.5" r="1.6" fill="currentColor" />
          <circle cx="18" cy="18.5" r="1.6" fill="currentColor" />
          <circle cx="12" cy="6" r="1.6" fill="currentColor" />
          <circle cx="12" cy="13" r="2.4" {...stroke} />
        </svg>
      )
    case 'model-pipeline':
      // A training funnel narrowing raw signal down to a served model artifact
      return (
        <svg {...common}>
          <path d="M4,4.5 L20,4.5 L14,15 L10,15 Z" {...stroke} />
          <rect x="10" y="17" width="4" height="3" rx="0.6" {...stroke} />
        </svg>
      )
    case 'shield-scan':
      // A shield mid-scan, not just "locked"
      return (
        <svg {...common}>
          <path d="M12,3 L19,6 L19,12 C19,17 15.5,20 12,21 C8.5,20 5,17 5,12 L5,6 Z" {...stroke} />
          <path d="M8.5,12 L11,14.5 L16,9" {...stroke} />
        </svg>
      )
    default:
      return null
  }
}

const STEPS = [
  {
    number: '01',
    title: 'Get your link',
    description:
      'Your account team shares a personalised assessment link scoped to your company.',
  },
  {
    number: '02',
    title: 'Answer targeted questions',
    description:
      'Questions are selected by AI based on your role and company context — no generic tick-boxes.',
  },
  {
    number: '03',
    title: 'Receive your report',
    description:
      'Instantly get a scored maturity report with strengths, gaps, and prioritised next steps.',
  },
]

/* ── Report benefit icons — same hand-drawn line language as the pillar icons ── */
function BenefitIcon({ name }: { name: string }) {
  const common = { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': true as const }
  const stroke = { stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

  switch (name) {
    case 'bars':
      // Ascending pillar scores
      return (
        <svg {...common}>
          <rect x="4" y="14" width="4" height="6" rx="0.6" {...stroke} />
          <rect x="10" y="9" width="4" height="11" rx="0.6" {...stroke} />
          <rect x="16" y="4" width="4" height="16" rx="0.6" {...stroke} />
        </svg>
      )
    case 'check-gap':
      // A strength (check) beside a gap (dash) — the report's two-sided read
      return (
        <svg {...common}>
          <circle cx="8" cy="12" r="5" {...stroke} />
          <path d="M5.5,12 L7,13.5 L10.5,9.5" {...stroke} />
          <circle cx="17" cy="12" r="5" {...stroke} />
          <line x1="14.5" y1="12" x2="19.5" y2="12" {...stroke} />
        </svg>
      )
    case 'roadmap':
      // Ordered next steps trending toward the target
      return (
        <svg {...common}>
          <path d="M4.5,18 L12,12 L17,7.5" {...stroke} />
          <path d="M15,4.5 L19.5,6 L18,10.5" {...stroke} />
          <circle cx="4.5" cy="18" r="1.5" fill="currentColor" />
          <circle cx="12" cy="12" r="1.5" fill="currentColor" />
          <circle cx="19.5" cy="6" r="1.5" fill="currentColor" />
        </svg>
      )
    case 'doc-summary':
      // The executive summary, at a glance
      return (
        <svg {...common}>
          <rect x="5" y="3" width="14" height="18" rx="1.4" {...stroke} />
          <line x1="8" y1="8" x2="16" y2="8" {...stroke} />
          <line x1="8" y1="12" x2="16" y2="12" {...stroke} />
          <line x1="8" y1="16" x2="13" y2="16" {...stroke} />
        </svg>
      )
    case 'doc-download':
      // The report, exported
      return (
        <svg {...common}>
          <rect x="5" y="3" width="14" height="13" rx="1.4" {...stroke} />
          <line x1="8" y1="7" x2="14" y2="7" {...stroke} />
          <line x1="8" y1="10.5" x2="14" y2="10.5" {...stroke} />
          <path d="M9,19 L12,22 L15,19" {...stroke} />
          <line x1="12" y1="15" x2="12" y2="22" {...stroke} />
        </svg>
      )
    default:
      return null
  }
}

const REPORT_BENEFITS = [
  {
    icon: 'bars',
    title: 'Pillar-by-pillar scores',
    description: 'A precise maturity score from 1.0 to 4.0 for each of the five observability pillars.',
  },
  {
    icon: 'check-gap',
    title: 'Strengths & gaps analysis',
    description: 'Clear identification of what your team does well and where critical gaps exist.',
  },
  {
    icon: 'roadmap',
    title: 'Prioritised next steps',
    description: 'An ordered action plan tailored to your organisation — no generic recommendations.',
  },
  {
    icon: 'doc-summary',
    title: 'Executive summary',
    description: 'A concise, boardroom-ready narrative summarising your overall observability posture.',
  },
  {
    icon: 'doc-download',
    title: 'PDF download',
    description: 'Export the full report as a polished PDF to share with your team and leadership.',
  },
]

/* ── Signal meter — the maturity-gradient signature element, reused in the hero and the
   Maturity levels tab. "Noise → clear signal" reads directly off the product's own scale
   instead of a literal red/amber/green traffic light. ── */
function SignalMeter({ markerPct, markerLabel, caption }: { markerPct?: number; markerLabel?: string; caption: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-6 py-5">
      <p className="font-mono text-[10px] uppercase tracking-widest text-gray-400 mb-3.5">{caption}</p>
      <div className="relative flex h-2.5 rounded-full overflow-hidden mb-3">
        <span className="flex-1 bg-signal-static" />
        <span className="flex-1 bg-signal-amber" />
        <span className="flex-1 bg-signal-teal" />
        <span className="flex-1 bg-signal-clear" />
        {markerPct === undefined && (
          <div
            className="absolute -top-[3px] -bottom-[3px] w-[3px] rounded-sm bg-white shadow-[0_0_8px_1px_rgba(255,255,255,0.8)] motion-safe:animate-signal-scan motion-reduce:left-[calc(100%-3px)]"
          />
        )}
        {markerPct !== undefined && (
          <div
            className="absolute -top-[5px] w-0.5 h-5 rounded-sm bg-current text-signal-amber"
            style={{ left: `${markerPct}%` }}
          />
        )}
      </div>
      <div className="grid grid-cols-4 text-[10px] text-gray-400">
        <span>Reactive</span>
        <span>Developing</span>
        <span>Defined</span>
        <span className="text-right text-signal-clear font-semibold">Optimized</span>
      </div>
      {markerLabel && (
        <p className="mt-3 text-xs text-gray-400">
          Example score <span className="font-mono font-semibold text-signal-amber">{markerLabel}</span> lands in{' '}
          <span className="font-semibold text-signal-amber">Developing</span>
        </p>
      )}
    </div>
  )
}

const MATURITY_LEVELS = [
  { num: 1, label: 'Initial',    range: '1.0 – 1.9', color: '#8C7B63', pct: 22,  score: '1.4' },
  { num: 2, label: 'Developing', range: '2.0 – 2.9', color: '#D98A3D', pct: 52,  score: '2.5' },
  { num: 3, label: 'Defined',    range: '3.0 – 3.4', color: '#2E8B78', pct: 73,  score: '3.2' },
  { num: 4, label: 'Optimised',  range: '3.5 – 4.0', color: '#1FA8E0', pct: 93,  score: '3.8' },
]

function MaturityProgressAnimation() {
  const [activeIdx, setActiveIdx] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setActiveIdx(i => (i + 1) % 4), 2400)
    return () => clearInterval(id)
  }, [])

  const current = MATURITY_LEVELS[activeIdx]

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden flex flex-col">
      {/* Header bar */}
      <div
        className="h-1.5 transition-all duration-700"
        style={{ backgroundColor: current.color }}
      />
      <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2">
        <div
          className="w-2 h-2 rounded-full transition-colors duration-500"
          style={{ backgroundColor: current.color }}
        />
        <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
          Maturity Progression
        </span>
      </div>

      {/* Score + label */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-6 gap-3">
        <div className="text-center">
          <div
            className="font-mono text-6xl font-black leading-none transition-all duration-500 tabular-nums"
            style={{ color: current.color }}
          >
            {current.score}
          </div>
          <div className="font-mono text-sm text-gray-400 dark:text-gray-500 mt-1">/ 4.0</div>
        </div>
        <div
          className="text-xl font-bold transition-colors duration-500"
          style={{ color: current.color }}
        >
          {current.label}
        </div>
        <div className="text-xs text-gray-400 dark:text-gray-500">{current.range}</div>

        {/* Progress bar */}
        <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden mt-1">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${current.pct}%`, backgroundColor: current.color }}
          />
        </div>

        {/* Step indicators */}
        <div className="flex items-center gap-2 mt-1">
          {MATURITY_LEVELS.map((l, i) => (
            <React.Fragment key={l.label}>
              <div
                className="w-2.5 h-2.5 rounded-full transition-all duration-400 border"
                style={{
                  backgroundColor: i <= activeIdx ? l.color : 'transparent',
                  borderColor: i <= activeIdx ? l.color : '#9ca3af',
                }}
              />
              {i < 3 && (
                <div
                  className="w-5 h-px transition-colors duration-500"
                  style={{ backgroundColor: i < activeIdx ? MATURITY_LEVELS[i + 1].color : '#d1d5db' }}
                />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  )
}

const EXPLORE_TABS = ['How it works', 'Five pillars', 'Maturity levels', 'What you get'] as const

export default function HomePage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState(0)

  const handleCta = () => {
    if (user) {
      navigate(user.role === 'admin' ? '/admin/users' : '/dashboard')
    } else {
      navigate('/login')
    }
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 font-sans">
      {/* ── Nav ──────────────────────────────────────────────────────────── */}
      <header className="bg-ink px-8 h-12 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <svg width="20" height="20" viewBox="0 0 32 32" fill="none" aria-hidden="true">
            <rect x="2" y="5" width="28" height="18" rx="2" stroke="#3B82F6" strokeWidth="1.8"/>
            <polyline points="6,14 10,14 12,8 16,20 19,10 22,14 26,14" stroke="#3B82F6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            <line x1="13" y1="23" x2="19" y2="23" stroke="#3B82F6" strokeWidth="1.8"/>
            <line x1="16" y1="23" x2="16" y2="28" stroke="#3B82F6" strokeWidth="1.8"/>
            <line x1="11" y1="28" x2="21" y2="28" stroke="#3B82F6" strokeWidth="1.8"/>
          </svg>
          <span className="text-white/60 text-xs font-medium tracking-wide">OMA</span>
        </Link>
        <div className="flex items-center gap-3">
          <DarkModeToggle />
          <button
            onClick={handleCta}
            className="text-sm bg-brand text-white font-medium px-4 py-1.5 rounded-lg hover:bg-blue-600 transition-colors"
          >
            {user ? 'Dashboard' : 'Log in'}
          </button>
        </div>
      </header>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="bg-ink text-white px-6 py-12 sm:py-14">
        <div className="max-w-5xl mx-auto grid lg:grid-cols-[1.15fr_0.85fr] gap-10 lg:gap-14 items-center">
          <div>
            <p className="font-mono text-xs uppercase tracking-widest text-signal-clear mb-4">
              Observability Maturity Assessment
            </p>
            <h1 className="font-display text-4xl sm:text-5xl font-semibold leading-[1.08] tracking-tight mb-5 text-balance">
              Know exactly where you stand.
              <br />
              <em className="italic text-signal-clear">Know exactly what&rsquo;s next.</em>
            </h1>
            <p className="text-white/60 text-[15px] leading-relaxed mb-7 max-w-md">
              Benchmark your observability posture across five critical pillars
              and get a prioritised action plan — in under 10 minutes.
            </p>
            <button
              onClick={handleCta}
              className="bg-brand hover:bg-blue-600 text-white font-semibold px-7 py-2.5 rounded-lg transition-colors text-sm shadow-lg"
            >
              {user ? 'Go to dashboard' : 'Log in to get started'}
            </button>
          </div>

          <SignalMeter caption="Your maturity, at a glance" />
        </div>
      </section>

      {/* ── Explore (tabbed walkthrough) ─────────────────────────────────── */}
      <section className="pt-4 pb-10 px-6 bg-gray-50 dark:bg-gray-800">
        <div className="max-w-5xl mx-auto">

          {/* Tab nav */}
          <div className="flex items-center justify-center gap-1.5 sm:gap-2 mb-5 flex-wrap">
            <button
              onClick={() => setActiveTab((i) => Math.max(0, i - 1))}
              disabled={activeTab === 0}
              aria-label="Previous section"
              className="w-8 h-8 shrink-0 flex items-center justify-center rounded-full text-gray-400 dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-white disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            >
              ‹
            </button>
            {EXPLORE_TABS.map((label, i) => (
              <button
                key={label}
                onClick={() => setActiveTab(i)}
                aria-current={i === activeTab ? 'step' : undefined}
                className={`flex items-center gap-1.5 pl-1.5 pr-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  i === activeTab
                    ? 'bg-brand text-white'
                    : 'text-gray-500 dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                <span
                  className={`w-5 h-5 shrink-0 rounded-full flex items-center justify-center text-xs font-mono tabular-nums font-bold ${
                    i === activeTab ? 'bg-white/20' : 'bg-gray-200 dark:bg-gray-700'
                  }`}
                >
                  {i + 1}
                </span>
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
            <button
              onClick={() => setActiveTab((i) => Math.min(EXPLORE_TABS.length - 1, i + 1))}
              disabled={activeTab === EXPLORE_TABS.length - 1}
              aria-label="Next section"
              className="w-8 h-8 shrink-0 flex items-center justify-center rounded-full text-gray-400 dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-white disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            >
              ›
            </button>
          </div>

          {activeTab === 0 && (
          <div>
          <h2 className="font-display text-2xl font-semibold text-navy dark:text-gray-100 text-center mb-1">
            How it works
          </h2>
          <p className="text-gray-500 dark:text-gray-400 text-center text-sm mb-10">
            From link to report in three steps.
          </p>
          <div className="grid md:grid-cols-2 gap-10 items-center">
            {/* Left: steps */}
            <div className="space-y-5">
              {STEPS.map((step) => (
                <div key={step.number} className="flex items-start gap-4">
                  <div className="font-mono text-xs font-bold text-signal-clear w-7 h-7 rounded-full border border-gray-300 dark:border-gray-600 shrink-0 flex items-center justify-center">
                    {step.number}
                  </div>
                  <div>
                    <h3 className="font-semibold text-navy dark:text-gray-100 text-sm mb-0.5">
                      {step.title}
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Right: static filmstrip — no auto-playing carousel to wait through */}
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden flex divide-x divide-gray-200 dark:divide-gray-700">
              <div className="flex-1 min-w-0 px-4 py-4 flex flex-col gap-2">
                <span className="font-mono text-[9px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Registration</span>
                <div className="h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 w-4/5" />
                <div className="h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 w-3/5" />
                <div className="h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 w-2/3" />
              </div>
              <div className="flex-1 min-w-0 px-4 py-4 flex flex-col gap-2">
                <span className="font-mono text-[9px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Question 3 / 8</span>
                <div className="h-1 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                  <div className="h-full rounded-full bg-signal-clear" style={{ width: '37.5%' }} />
                </div>
                <div className="h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 w-full mt-1" />
                <div className="h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 w-4/5" />
              </div>
              <div className="flex-1 min-w-0 px-4 py-4 flex flex-col gap-2">
                <span className="font-mono text-[9px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Your report</span>
                <div className="h-1.5 rounded-full bg-signal-clear w-full" />
                <div className="h-1.5 rounded-full bg-signal-amber w-3/5" />
                <div className="h-1.5 rounded-full bg-signal-teal w-4/5" />
              </div>
            </div>
          </div>
          </div>
          )}

          {activeTab === 1 && (
          <div>
          <h2 className="font-display text-2xl font-semibold text-navy dark:text-gray-100 text-center mb-1">
            Five pillars. One clear picture.
          </h2>
          <p className="text-gray-500 dark:text-gray-400 text-center text-sm mb-8 max-w-lg mx-auto">
            Each assessment is scored from 1.0 (Initial) to 4.0 (Optimised),
            giving you a precise, actionable maturity level per pillar.
          </p>
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden grid sm:grid-cols-3 divide-x divide-y divide-gray-200 dark:divide-gray-700">
            {PILLARS.map((p) => (
              <div
                key={p.title}
                className="bg-white dark:bg-gray-800 p-5 hover:bg-gray-50 dark:hover:bg-gray-700/60 transition-colors"
              >
                <div className="mb-3 w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-navy dark:text-gray-100">
                  <PillarIcon name={p.icon} />
                </div>
                <h3 className="font-semibold text-navy dark:text-gray-100 text-sm mb-1">
                  {p.title}
                </h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">
                  {p.description}
                </p>
              </div>
            ))}
          </div>
          </div>
          )}

          {activeTab === 2 && (
          <div>
          <h2 className="font-display text-2xl font-semibold text-navy dark:text-gray-100 text-center mb-1">
            Four maturity levels
          </h2>
          <p className="text-gray-500 dark:text-gray-400 text-center text-sm mb-10">
            Your score maps to one of four levels, each with a clear profile.
          </p>

          <div className="grid md:grid-cols-2 gap-8 items-stretch">
            {/* Left: list */}
            <div className="space-y-2.5">
              {([
                ['1.0 – 1.9', 'Initial',    'Ad-hoc processes, reactive operations, limited visibility.',             '#8C7B63'],
                ['2.0 – 2.9', 'Developing', 'Foundational tooling in place; gaps in coverage and automation.',       '#D98A3D'],
                ['3.0 – 3.4', 'Defined',    'Consistent practices, proactive monitoring, team-wide adoption.',       '#2E8B78'],
                ['3.5 – 4.0', 'Optimised',  'Automated, intelligent, continuously improving at scale.',              '#1FA8E0'],
              ] as const).map(([range, label, desc, color]) => (
                <div
                  key={label}
                  className="flex items-start gap-4 bg-gray-50 dark:bg-gray-800 rounded-lg px-4 py-3 border border-gray-200 dark:border-gray-700"
                >
                  <div className="w-1.5 self-stretch rounded-full shrink-0" style={{ backgroundColor: color }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 mb-0.5">
                      <span className="font-semibold text-navy dark:text-gray-100 text-sm">{label}</span>
                      <span className="text-gray-400 dark:text-gray-500 text-xs">{range}</span>
                    </div>
                    <p className="text-gray-500 dark:text-gray-400 text-sm">{desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Right: animated progression */}
            <MaturityProgressAnimation />
          </div>
          </div>
          )}

          {activeTab === 3 && (
          <div>
          <h2 className="font-display text-2xl font-semibold text-navy dark:text-gray-100 text-center mb-1">
            What you'll get
          </h2>
          <p className="text-gray-500 dark:text-gray-400 text-center text-sm mb-10 max-w-lg mx-auto">
            A comprehensive, AI-generated report tailored to your organisation — ready in minutes.
          </p>
          <div className="grid md:grid-cols-2 gap-10 items-stretch">
            {/* Left: benefits */}
            <div className="flex flex-col justify-center gap-4">
              {REPORT_BENEFITS.map((b) => (
                <div key={b.title} className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-navy dark:text-gray-100 shrink-0">
                    <BenefitIcon name={b.icon} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-navy dark:text-gray-100 text-sm mb-0.5">
                      {b.title}
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">
                      {b.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Right: static report snapshot */}
            <div className="w-full max-w-[22rem] mx-auto rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5">
              <p className="text-[9px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">
                Pillar scores
              </p>
              <div className="space-y-3">
                {[
                  ['Full-Stack Obs.', 85, 'bg-signal-clear', 'text-signal-clear', '3.4'],
                  ['AIOps', 52, 'bg-signal-amber', 'text-signal-amber', '2.1'],
                  ['AI System Obs.', 45, 'bg-signal-static', 'text-signal-static', '1.8'],
                  ['Security', 77, 'bg-signal-teal', 'text-signal-teal', '3.1'],
                ].map(([name, pct, barClass, textClass, score]) => (
                  <div key={String(name)}>
                    <div className="flex justify-between text-[10px] text-gray-500 dark:text-gray-400 mb-1">
                      <span>{String(name)}</span>
                      <span className={`font-mono font-semibold ${String(textClass)}`}>{String(score)}</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${String(barClass)}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 border border-brand/30 bg-brand/5 dark:bg-brand/10 rounded-lg py-2 text-center">
                <span className="text-brand text-xs font-semibold">Download PDF Report</span>
              </div>
            </div>
          </div>
          </div>
          )}

        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      <section className="bg-ink py-10 px-6 text-center">
        <h2 className="font-display text-2xl font-semibold text-white mb-2">
          Ready to assess your maturity?
        </h2>
        <p className="text-white/60 text-sm mb-6 max-w-sm mx-auto">
          Contact your account team to get your personalised assessment link, or log
          in if you already have access.
        </p>
        <button
          onClick={handleCta}
          className="bg-brand hover:bg-blue-600 text-white font-semibold px-7 py-2.5 rounded-lg transition-colors text-sm"
        >
          {user ? 'Go to dashboard' : 'Log in'}
        </button>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="bg-[#111827] py-5 px-8 text-center">
        <p className="text-gray-500 text-xs">
          Observability Maturity Assessment Platform · Powered by AI
        </p>
      </footer>
    </div>
  )
}
