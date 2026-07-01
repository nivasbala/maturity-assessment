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
    title: 'Answer 12 targeted questions',
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
            <span className="text-[#2563EB]">Know exactly what to do next.</span>
          </h1>
          <p className="text-white/70 text-lg leading-relaxed mb-8 max-w-xl mx-auto">
            A personalised observability maturity assessment that benchmarks your
            organisation across five critical pillars and delivers a prioritised
            action plan — in under 10 minutes.
          </p>
          <button
            onClick={handleCta}
            className="bg-[#2563EB] hover:bg-blue-600 text-white font-semibold px-8 py-3 rounded-lg transition-colors text-base shadow-lg"
          >
            {user ? 'Go to dashboard' : 'Log in to get started'}
          </button>
        </div>

        {/* Score preview strip */}
        <div className="max-w-2xl mx-auto mt-14 grid grid-cols-3 sm:grid-cols-5 gap-3">
          {[
            ['P1', '3.4', '#22c55e'],
            ['P2', '2.1', '#f59e0b'],
            ['P3', '1.8', '#ef4444'],
            ['P4', '2.7', '#f59e0b'],
            ['P5', '3.1', '#22c55e'],
          ].map(([label, score, color]) => (
            <div
              key={label}
              className="bg-white/10 rounded-lg px-4 py-3 text-center backdrop-blur-sm"
            >
              <p className="text-white/50 text-xs mb-1">{label}</p>
              <p className="font-bold text-xl" style={{ color }}>
                {score}
              </p>
              <p className="text-white/40 text-xs">/ 4.0</p>
            </div>
          ))}
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
              <div key={step.number} className="relative">
                <div className="text-5xl font-black text-[#2563EB]/10 mb-2 leading-none">
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
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {PILLARS.map((p) => (
              <div
                key={p.title}
                className="border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-xl p-5 hover:shadow-md transition-shadow"
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
            {/* Filler card */}
            <div className="border border-dashed border-gray-200 dark:border-gray-600 rounded-xl p-5 flex flex-col items-center justify-center text-center">
              <p className="text-gray-400 dark:text-gray-500 text-sm">
                Assessments are AI-personalised to your role and company context.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Maturity levels ──────────────────────────────────────────────── */}
      <section className="py-20 px-6 bg-gray-50 dark:bg-gray-800">
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
                className="flex items-start gap-4 bg-white dark:bg-gray-700 rounded-lg px-5 py-4 border border-gray-100 dark:border-gray-600"
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
          className="bg-[#2563EB] hover:bg-blue-600 text-white font-semibold px-8 py-3 rounded-lg transition-colors text-base"
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
    </div>
  )
}
