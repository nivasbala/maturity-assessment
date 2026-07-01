import React from 'react'
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

/* ── Horizontal animated mockup (How it works) ───────────────────────────── */
function HorizontalMockup({ animName, children }: { animName: string; children: React.ReactNode }) {
  return (
    <div className="relative w-full overflow-hidden rounded-2xl border border-gray-300 dark:border-gray-600 shadow-lg bg-white dark:bg-gray-900 h-80">
      <div
        className="absolute inset-0 flex flex-row"
        style={{
          width: '400%',
          animation: `${animName} 15s ease-in-out infinite`,
        }}
      >
        {children}
      </div>
      <div className="absolute top-0 right-0 bottom-0 w-12 pointer-events-none bg-gradient-to-l from-white to-transparent dark:from-gray-900" />
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 pointer-events-none">
        {[0, 1, 2].map((i) => (
          <div key={i} className="w-1.5 h-1.5 rounded-full bg-brand/30" />
        ))}
      </div>
    </div>
  )
}

const SLIDE = 'w-1/4 shrink-0 h-80 px-5 py-5 flex flex-col gap-2 overflow-hidden'
const LABEL = 'text-[9px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider'
const HEADING = 'text-[13px] font-bold text-[#1B2B4B] dark:text-gray-100'
const SKEL = 'h-2 rounded-full bg-gray-200 dark:bg-gray-700'

/* ── Vertical report mockup (What you'll get) ────────────────────────────── */
function VerticalReportMockup() {
  return (
    <div className="w-full max-w-xs mx-auto rounded-2xl border border-gray-300 dark:border-gray-600 shadow-lg bg-white dark:bg-gray-900 overflow-hidden">
      {/* Header */}
      <div className="bg-[#1B2B4B] px-4 py-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-white text-xs font-bold">Observability Maturity Report</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="bg-amber-400 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">
            Overall: 2.8 / 4.0
          </span>
          <span className="text-white/60 text-[10px]">Developing</span>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 py-3 space-y-4">
        {/* Executive Summary */}
        <div>
          <p className="text-[9px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1.5">
            Executive Summary
          </p>
          <div className="space-y-1.5">
            {['100%', '90%', '95%', '82%', '88%'].map((w, i) => (
              <div key={i} className={`${SKEL}`} style={{ width: w }} />
            ))}
          </div>
        </div>

        {/* Pillar Scores */}
        <div>
          <p className="text-[9px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1.5">
            Pillar Scores
          </p>
          <div className="space-y-2">
            {[
              ['Full-Stack Obs.', 85, '#22c55e', '3.4'],
              ['AIOps', 52, '#f59e0b', '2.1'],
              ['AI System Obs.', 45, '#ef4444', '1.8'],
              ['Security', 77, '#22c55e', '3.1'],
              ['ML & Model Ops', 60, '#f59e0b', '2.4'],
            ].map(([name, pct, color, score]) => (
              <div key={String(name)}>
                <div className="flex justify-between text-[9px] text-gray-500 dark:text-gray-400 mb-0.5">
                  <span>{String(name)}</span>
                  <span className="font-semibold" style={{ color }}>{String(score)}</span>
                </div>
                <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Next Steps */}
        <div>
          <p className="text-[9px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1.5">
            Prioritised Next Steps
          </p>
          <div className="space-y-1.5">
            {[
              ['1', 'Centralise log aggregation across all services', '#3b82f6'],
              ['2', 'Implement distributed tracing end-to-end', '#3b82f6'],
              ['3', 'Enable AIOps anomaly detection baselines', '#f59e0b'],
              ['4', 'Shift security scanning left into CI pipeline', '#f59e0b'],
            ].map(([num, text, color]) => (
              <div key={String(num)} className="flex items-start gap-1.5">
                <span className="text-[10px] font-bold shrink-0 w-3" style={{ color }}>{String(num)}.</span>
                <span className="text-[10px] text-gray-500 dark:text-gray-400 leading-snug">{String(text)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* PDF Button */}
        <div className="border border-brand/30 bg-brand/5 dark:bg-brand/10 rounded-lg py-2 text-center">
          <span className="text-brand text-[11px] font-semibold">Download PDF Report</span>
        </div>
      </div>
    </div>
  )
}

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
      <header className="bg-[#1B2B4B] px-8 h-14 relative flex items-center">
        <span className="absolute left-1/2 -translate-x-1/2 text-white font-bold text-2xl tracking-tight">
          Observability Maturity Assessment
        </span>
        <div className="flex items-center gap-3 ml-auto">
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
      <section className="bg-[#1B2B4B] text-white pt-5 pb-14 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 text-white/80 text-xs font-medium px-3 py-1 rounded-full mb-4 tracking-wide uppercase">
            AI-Powered Assessment
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold leading-tight mb-4">
            Know exactly where you stand and what to do next.
          </h1>
          <p className="text-white/70 text-base leading-relaxed mb-6 max-w-lg mx-auto">
            Benchmark your observability posture across five critical pillars
            <br />and get a prioritised action plan — in under 10 minutes.
          </p>
          <button
            onClick={handleCta}
            className="bg-brand hover:bg-blue-600 text-white font-semibold px-7 py-2.5 rounded-lg transition-colors text-sm shadow-lg"
          >
            {user ? 'Go to dashboard' : 'Log in to get started'}
          </button>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <section className="py-12 px-6 bg-gray-50 dark:bg-gray-800 border-t-2 border-brand">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-[#1B2B4B] dark:text-gray-100 text-center mb-1">
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
                  <div className="text-2xl font-black text-brand w-10 shrink-0 leading-none pt-0.5">
                    {step.number}
                  </div>
                  <div>
                    <h3 className="font-semibold text-[#1B2B4B] dark:text-gray-100 text-sm mb-0.5">
                      {step.title}
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Right: horizontal flow mockup */}
            <HorizontalMockup animName="flowH">
              {/* Slide 1: prospect registration */}
              <div className={SLIDE}>
                <div className="flex items-center gap-1.5 mb-0.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-brand" />
                  <span className={LABEL}>Step 01 · Registration</span>
                </div>
                <p className={HEADING}>Tell us about yourself</p>
                <p className="text-[10px] text-gray-400 dark:text-gray-500">Personalise your assessment</p>
                <div className="flex flex-col gap-2 mt-1">
                  {['Your name', 'Company', 'Job title'].map((placeholder) => (
                    <div
                      key={placeholder}
                      className="border border-gray-300 dark:border-gray-600 rounded-lg px-2.5 py-1.5 text-[10px] text-gray-400 dark:text-gray-500 bg-white dark:bg-gray-800"
                    >
                      {placeholder}
                    </div>
                  ))}
                </div>
                <div className="mt-auto bg-brand rounded-lg py-1.5 text-center">
                  <span className="text-white text-[11px] font-semibold">Start Assessment →</span>
                </div>
              </div>

              {/* Slide 2: question screen */}
              <div className={SLIDE}>
                <div className="flex items-center gap-1.5 mb-0.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-brand" />
                  <span className={LABEL}>Step 02 · Question 3 of 8</span>
                </div>
                <div className="h-1 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full bg-brand rounded-full" style={{ width: '37.5%' }} />
                </div>
                <p className={HEADING}>Full-Stack Observability</p>
                <div className="bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-2.5 py-2">
                  <div className={`${SKEL} w-full mb-1`} />
                  <div className={`${SKEL} w-4/5`} />
                </div>
                <div className="flex flex-col gap-1.5">
                  {[
                    ['Ad hoc, no standard practice', false],
                    ['Basic tooling, limited coverage', true],
                    ['Consistent, team-wide adoption', false],
                    ['Automated & continuously improved', false],
                  ].map(([label, sel]) => (
                    <div
                      key={String(label)}
                      className={`flex items-center gap-1.5 rounded px-2 py-1 border text-[10px] ${
                        sel
                          ? 'border-brand bg-brand/5 dark:bg-brand/10 text-brand font-medium'
                          : 'border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400'
                      }`}
                    >
                      <div className={`w-2.5 h-2.5 rounded-full border shrink-0 ${sel ? 'border-brand bg-brand' : 'border-gray-300 dark:border-gray-600'}`} />
                      {String(label)}
                    </div>
                  ))}
                </div>
              </div>

              {/* Slide 3: report ready */}
              <div className={SLIDE}>
                <div className="flex items-center gap-1.5 mb-0.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-brand" />
                  <span className={LABEL}>Step 03 · Your Report</span>
                </div>
                <p className={HEADING}>Assessment complete</p>
                <div className="inline-flex self-start text-white text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: '#f59e0b' }}>
                  Overall: 2.8 / 4.0
                </div>
                <div className="flex flex-col gap-1.5 mt-1">
                  {[
                    ['Full-Stack Observability', 85, '#22c55e', '3.4'],
                    ['AIOps & Intelligent Obs.', 52, '#f59e0b', '2.1'],
                    ['Security & DevSecOps', 77, '#22c55e', '3.1'],
                  ].map(([name, pct, color, score]) => (
                    <div key={String(name)}>
                      <div className="flex justify-between text-[9px] text-gray-400 dark:text-gray-500 mb-0.5">
                        <span className="truncate mr-1">{String(name)}</span>
                        <span className="font-semibold shrink-0" style={{ color }}>{String(score)}</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-auto border border-brand/30 bg-brand/5 dark:bg-brand/10 rounded-lg py-1.5 text-center">
                  <span className="text-brand text-[11px] font-semibold">Download PDF Report</span>
                </div>
              </div>

              {/* Slide 4: repeat slide 1 for seamless loop */}
              <div className={SLIDE}>
                <div className="flex items-center gap-1.5 mb-0.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-brand" />
                  <span className={LABEL}>Step 01 · Registration</span>
                </div>
                <p className={HEADING}>Tell us about yourself</p>
                <p className="text-[10px] text-gray-400 dark:text-gray-500">Personalise your assessment</p>
                <div className="flex flex-col gap-2 mt-1">
                  {['Your name', 'Company', 'Job title'].map((placeholder) => (
                    <div
                      key={placeholder}
                      className="border border-gray-300 dark:border-gray-600 rounded-lg px-2.5 py-1.5 text-[10px] text-gray-400 dark:text-gray-500 bg-white dark:bg-gray-800"
                    >
                      {placeholder}
                    </div>
                  ))}
                </div>
                <div className="mt-auto bg-brand rounded-lg py-1.5 text-center">
                  <span className="text-white text-[11px] font-semibold">Start Assessment →</span>
                </div>
              </div>
            </HorizontalMockup>
          </div>
        </div>
      </section>

      {/* ── Pillars ──────────────────────────────────────────────────────── */}
      <section className="py-12 px-6 bg-white dark:bg-gray-900 border-t-2 border-brand">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-[#1B2B4B] dark:text-gray-100 text-center mb-1">
            Five pillars. One clear picture.
          </h2>
          <p className="text-gray-500 dark:text-gray-400 text-center text-sm mb-8 max-w-lg mx-auto">
            Each assessment is scored from 1.0 (Initial) to 4.0 (Optimised),
            giving you a precise, actionable maturity level per pillar.
          </p>
          {/* First row: 3 cards */}
          <div className="grid sm:grid-cols-3 gap-4 mb-4">
            {PILLARS.slice(0, 3).map((p) => (
              <div
                key={p.title}
                className="border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-xl p-4 hover:shadow-md transition-shadow"
              >
                <div className="text-xl mb-2">{p.icon}</div>
                <h3 className="font-semibold text-[#1B2B4B] dark:text-gray-100 text-sm mb-1">
                  {p.title}
                </h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">
                  {p.description}
                </p>
              </div>
            ))}
          </div>
          {/* Second row: 2 cards centered */}
          <div className="flex justify-center gap-4">
            {PILLARS.slice(3).map((p) => (
              <div
                key={p.title}
                className="border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-xl p-4 hover:shadow-md transition-shadow w-full sm:max-w-[calc(33.333%-8px)]"
              >
                <div className="text-xl mb-2">{p.icon}</div>
                <h3 className="font-semibold text-[#1B2B4B] dark:text-gray-100 text-sm mb-1">
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

      {/* ── What you'll get ──────────────────────────────────────────────── */}
      <section className="py-12 px-6 bg-gray-50 dark:bg-gray-800 border-t-2 border-brand">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-[#1B2B4B] dark:text-gray-100 text-center mb-1">
            What you'll get
          </h2>
          <p className="text-gray-500 dark:text-gray-400 text-center text-sm mb-10 max-w-lg mx-auto">
            A comprehensive, AI-generated report tailored to your organisation — ready in minutes.
          </p>
          <div className="grid md:grid-cols-2 gap-10 items-center">
            {/* Left: benefits */}
            <div className="space-y-4">
              {REPORT_BENEFITS.map((b) => (
                <div key={b.title} className="flex items-start gap-3">
                  <div className="text-lg w-7 shrink-0">{b.icon}</div>
                  <div>
                    <h3 className="font-semibold text-[#1B2B4B] dark:text-gray-100 text-sm mb-0.5">
                      {b.title}
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">
                      {b.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Right: vertical report mockup */}
            <VerticalReportMockup />
          </div>
        </div>
      </section>

      {/* ── Maturity levels ──────────────────────────────────────────────── */}
      <section className="py-12 px-6 bg-white dark:bg-gray-900 border-t-2 border-brand">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-[#1B2B4B] dark:text-gray-100 text-center mb-8">
            Four maturity levels
          </h2>
          <div className="space-y-2.5">
            {[
              ['1.0 – 1.9', 'Initial', 'Ad-hoc processes, reactive operations, limited visibility.', '#ef4444'],
              ['2.0 – 2.9', 'Developing', 'Foundational tooling in place; gaps in coverage and automation.', '#f59e0b'],
              ['3.0 – 3.4', 'Defined', 'Consistent practices, proactive monitoring, team-wide adoption.', '#3b82f6'],
              ['3.5 – 4.0', 'Optimised', 'Automated, intelligent, continuously improving at scale.', '#22c55e'],
            ].map(([range, label, desc, color]) => (
              <div
                key={label}
                className="flex items-start gap-4 bg-gray-50 dark:bg-gray-700 rounded-lg px-4 py-3 border border-gray-300 dark:border-gray-600"
              >
                <div className="w-1.5 self-stretch rounded-full shrink-0" style={{ backgroundColor: color }} />
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
      <section className="bg-[#1B2B4B] py-12 px-6 text-center border-t-2 border-brand">
        <h2 className="text-2xl font-bold text-white mb-2">
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

      {/* ── Animation keyframes ──────────────────────────────────────────── */}
      <style>{`
        @keyframes flowH {
          0%     { transform: translateX(0); }
          26.7%  { transform: translateX(0); }
          33.3%  { transform: translateX(-25%); }
          60%    { transform: translateX(-25%); }
          66.7%  { transform: translateX(-50%); }
          93.3%  { transform: translateX(-50%); }
          100%   { transform: translateX(-75%); }
        }
      `}</style>
    </div>
  )
}
