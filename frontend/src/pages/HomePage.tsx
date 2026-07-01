import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import DarkModeToggle from '../components/DarkModeToggle'

const PILLARS = [
  {
    icon: '📡',
    title: 'Full-Stack Observability',
    description:
      'Assess your ability to collect, correlate, and act on metrics, logs, and traces across your entire stack.',
  },
  {
    icon: '🤖',
    title: 'AIOps & Intelligent Observability',
    description:
      'Evaluate how effectively your team uses AI-driven alerting, anomaly detection, and automated root cause analysis.',
  },
  {
    icon: '🧠',
    title: 'AI System Observability',
    description:
      'Understand your maturity in monitoring and debugging AI-powered applications in production.',
  },
  {
    icon: '⚗️',
    title: 'ML & Foundation Model Ops',
    description:
      'Gauge your operational readiness for training, fine-tuning, and managing machine learning models at scale.',
  },
  {
    icon: '🔒',
    title: 'Security & DevSecOps',
    description:
      'Benchmark your security observability — threat detection, compliance monitoring, and shift-left practices.',
  },
]

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

const REPORT_BENEFITS = [
  {
    icon: '📊',
    title: 'Pillar-by-pillar scores',
    description: 'A precise maturity score from 1.0 to 4.0 for each of the five observability pillars.',
  },
  {
    icon: '💪',
    title: 'Strengths & gaps analysis',
    description: 'Clear identification of what your team does well and where critical gaps exist.',
  },
  {
    icon: '🗺️',
    title: 'Prioritised next steps',
    description: 'An ordered action plan tailored to your organisation — no generic recommendations.',
  },
  {
    icon: '📋',
    title: 'Executive summary',
    description: 'A concise, boardroom-ready narrative summarising your overall observability posture.',
  },
  {
    icon: '📄',
    title: 'PDF download',
    description: 'Export the full report as a polished PDF to share with your team and leadership.',
  },
]

const REPORT_SLIDES = [
  {
    heading: 'Executive Summary',
    lines: [
      { w: '90%', dark: false },
      { w: '75%', dark: false },
      { w: '85%', dark: false },
      { w: '60%', dark: false },
    ],
    badge: { label: 'Overall Score', value: '2.8 / 4.0', color: '#f59e0b' },
  },
  {
    heading: 'Strengths',
    lines: [
      { w: '80%', dark: false },
      { w: '65%', dark: false },
      { w: '70%', dark: false },
    ],
    badge: { label: 'Pillar', value: 'Full-Stack Observability', color: '#22c55e' },
  },
  {
    heading: 'Key Gaps',
    lines: [
      { w: '85%', dark: false },
      { w: '70%', dark: false },
      { w: '75%', dark: false },
    ],
    badge: { label: 'Priority', value: 'High', color: '#ef4444' },
  },
  {
    heading: 'Next Steps',
    lines: [
      { w: '80%', dark: false },
      { w: '90%', dark: false },
      { w: '65%', dark: false },
      { w: '75%', dark: false },
    ],
    badge: { label: 'Action Items', value: '5 recommended', color: '#3b82f6' },
  },
]

export default function HomePage() {
  const navigate = useNavigate()
  const { user } = useAuth()

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
      <header className="bg-[#1B2B4B] px-8 h-14 flex items-center justify-between">
        <span className="text-white font-semibold text-base tracking-tight">
          Maturity Assessment
        </span>
        <div className="flex items-center gap-3">
          <DarkModeToggle />
          <button
            onClick={handleCta}
            className="text-sm text-white/80 hover:text-white transition-colors"
          >
            {user ? 'Go to dashboard →' : 'Log in →'}
          </button>
        </div>
      </header>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="bg-[#1B2B4B] text-white pb-24 pt-20 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 text-white/80 text-xs font-medium px-3 py-1 rounded-full mb-6 tracking-wide uppercase">
            AI-Powered Assessment
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold leading-tight mb-5">
            Know exactly where you stand.
            <br />
            <span className="text-brand">Know exactly what to do next.</span>
          </h1>
          <p className="text-white/70 text-lg leading-relaxed mb-8 max-w-xl mx-auto">
            A personalised observability maturity assessment that benchmarks your
            organisation across five critical pillars and delivers a prioritised
            action plan — in under 10 minutes.
          </p>
          <button
            onClick={handleCta}
            className="bg-brand hover:bg-blue-600 text-white font-semibold px-8 py-3 rounded-lg transition-colors text-base shadow-lg"
          >
            {user ? 'Go to dashboard' : 'Log in to get started'}
          </button>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <section className="py-20 px-6 bg-gray-50 dark:bg-gray-800">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-[#1B2B4B] dark:text-gray-100 text-center mb-2">
            How it works
          </h2>
          <p className="text-gray-500 dark:text-gray-400 text-center text-sm mb-12">
            From link to report in three steps.
          </p>
          <div className="grid sm:grid-cols-3 gap-8">
            {STEPS.map((step) => (
              <div
                key={step.number}
                className="relative bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-6"
              >
                <div className="text-5xl font-black text-brand mb-2 leading-none">
                  {step.number}
                </div>
                <h3 className="font-semibold text-[#1B2B4B] dark:text-gray-100 text-base mb-2">
                  {step.title}
                </h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pillars ──────────────────────────────────────────────────────── */}
      <section className="py-20 px-6 bg-white dark:bg-gray-900">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-[#1B2B4B] dark:text-gray-100 text-center mb-2">
            Five pillars. One clear picture.
          </h2>
          <p className="text-gray-500 dark:text-gray-400 text-center text-sm mb-12 max-w-lg mx-auto">
            Each assessment is scored from 1.0 (Initial) to 4.0 (Optimised),
            giving you a precise, actionable maturity level per pillar.
          </p>
          {/* First row: 3 cards */}
          <div className="grid sm:grid-cols-3 gap-5 mb-5">
            {PILLARS.slice(0, 3).map((p) => (
              <div
                key={p.title}
                className="border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-xl p-5 hover:shadow-md transition-shadow"
              >
                <div className="text-2xl mb-3">{p.icon}</div>
                <h3 className="font-semibold text-[#1B2B4B] dark:text-gray-100 text-sm mb-1.5">
                  {p.title}
                </h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">
                  {p.description}
                </p>
              </div>
            ))}
          </div>
          {/* Second row: 2 cards centered */}
          <div className="flex justify-center gap-5">
            {PILLARS.slice(3).map((p) => (
              <div
                key={p.title}
                className="border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-xl p-5 hover:shadow-md transition-shadow w-full sm:max-w-[calc(33.333%-10px)]"
              >
                <div className="text-2xl mb-3">{p.icon}</div>
                <h3 className="font-semibold text-[#1B2B4B] dark:text-gray-100 text-sm mb-1.5">
                  {p.title}
                </h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">
                  {p.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Report Preview ───────────────────────────────────────────────── */}
      <section className="py-20 px-6 bg-gray-50 dark:bg-gray-800">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-[#1B2B4B] dark:text-gray-100 text-center mb-2">
            What you'll get
          </h2>
          <p className="text-gray-500 dark:text-gray-400 text-center text-sm mb-14 max-w-lg mx-auto">
            A comprehensive, AI-generated report tailored to your organisation — ready in minutes.
          </p>
          <div className="grid md:grid-cols-2 gap-12 items-center">
            {/* Left half: benefits */}
            <div className="space-y-6">
              {REPORT_BENEFITS.map((b) => (
                <div key={b.title} className="flex items-start gap-4">
                  <div className="text-xl w-8 shrink-0">{b.icon}</div>
                  <div>
                    <h3 className="font-semibold text-[#1B2B4B] dark:text-gray-100 text-sm mb-1">
                      {b.title}
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">
                      {b.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Right half: animated report mockup */}
            <div className="flex justify-center">
              <div className="relative w-72 h-96 overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-600 shadow-xl bg-white dark:bg-gray-900">
                {/* Scrolling slides container */}
                <div
                  className="absolute inset-0 flex flex-col"
                  style={{
                    animation: 'reportScroll 12s ease-in-out infinite',
                  }}
                >
                  {[...REPORT_SLIDES, REPORT_SLIDES[0]].map((slide, idx) => (
                    <div
                      key={idx}
                      className="w-full shrink-0 h-96 px-5 py-5 flex flex-col gap-3"
                    >
                      {/* Header bar */}
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-brand" />
                          <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                            Maturity Report
                          </span>
                        </div>
                        <span className="text-[9px] text-gray-300 dark:text-gray-600">
                          {idx + 1} / {REPORT_SLIDES.length}
                        </span>
                      </div>

                      {/* Badge */}
                      <div
                        className="self-start text-white text-[10px] font-semibold px-2.5 py-1 rounded-full"
                        style={{ backgroundColor: slide.badge.color }}
                      >
                        {slide.badge.label}: {slide.badge.value}
                      </div>

                      {/* Section heading */}
                      <h4 className="text-sm font-bold text-[#1B2B4B] dark:text-gray-100">
                        {slide.heading}
                      </h4>

                      {/* Skeleton lines */}
                      <div className="flex flex-col gap-2 mt-1">
                        {slide.lines.map((line, li) => (
                          <div
                            key={li}
                            className="h-2.5 rounded-full bg-gray-100 dark:bg-gray-700"
                            style={{ width: line.w }}
                          />
                        ))}
                      </div>

                      {/* Score bar (first slide) */}
                      {idx % REPORT_SLIDES.length === 0 && (
                        <div className="mt-auto">
                          <div className="flex justify-between text-[10px] text-gray-400 dark:text-gray-500 mb-1">
                            <span>Score</span>
                            <span>2.8 / 4.0</span>
                          </div>
                          <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{ width: '70%', backgroundColor: '#f59e0b' }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Fade overlay at bottom */}
                <div className="absolute bottom-0 left-0 right-0 h-16 pointer-events-none bg-gradient-to-t from-white to-transparent dark:from-gray-900" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Maturity levels ──────────────────────────────────────────────── */}
      <section className="py-20 px-6 bg-white dark:bg-gray-900">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-[#1B2B4B] dark:text-gray-100 text-center mb-12">
            Four maturity levels
          </h2>
          <div className="space-y-3">
            {[
              ['1.0 – 1.9', 'Initial', 'Ad-hoc processes, reactive operations, limited visibility.', '#ef4444'],
              ['2.0 – 2.9', 'Developing', 'Foundational tooling in place; gaps in coverage and automation.', '#f59e0b'],
              ['3.0 – 3.4', 'Defined', 'Consistent practices, proactive monitoring, team-wide adoption.', '#3b82f6'],
              ['3.5 – 4.0', 'Optimised', 'Automated, intelligent, continuously improving at scale.', '#22c55e'],
            ].map(([range, label, desc, color]) => (
              <div
                key={label}
                className="flex items-start gap-4 bg-gray-50 dark:bg-gray-700 rounded-lg px-5 py-4 border border-gray-200 dark:border-gray-600"
              >
                <div
                  className="w-1.5 self-stretch rounded-full shrink-0 mt-0.5"
                  style={{ backgroundColor: color }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 mb-0.5">
                    <span className="font-semibold text-[#1B2B4B] dark:text-gray-100 text-sm">{label}</span>
                    <span className="text-gray-400 dark:text-gray-500 text-xs">{range}</span>
                  </div>
                  <p className="text-gray-500 dark:text-gray-400 text-sm">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      <section className="bg-[#1B2B4B] py-20 px-6 text-center">
        <h2 className="text-2xl font-bold text-white mb-3">
          Ready to assess your maturity?
        </h2>
        <p className="text-white/60 text-sm mb-8 max-w-sm mx-auto">
          Contact your account team to get your personalised assessment link, or log
          in if you already have access.
        </p>
        <button
          onClick={handleCta}
          className="bg-brand hover:bg-blue-600 text-white font-semibold px-8 py-3 rounded-lg transition-colors text-base"
        >
          {user ? 'Go to dashboard' : 'Log in'}
        </button>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="bg-[#111827] py-6 px-8 text-center">
        <p className="text-gray-500 text-xs">
          Maturity Assessment Platform · Powered by AI
        </p>
      </footer>

      {/* ── Animation keyframes ──────────────────────────────────────────── */}
      <style>{`
        @keyframes reportScroll {
          0%   { transform: translateY(0); }
          20%  { transform: translateY(0); }
          28%  { transform: translateY(-384px); }
          45%  { transform: translateY(-384px); }
          53%  { transform: translateY(-768px); }
          70%  { transform: translateY(-768px); }
          78%  { transform: translateY(-1152px); }
          95%  { transform: translateY(-1152px); }
          100% { transform: translateY(-1536px); }
        }
      `}</style>
    </div>
  )
}
