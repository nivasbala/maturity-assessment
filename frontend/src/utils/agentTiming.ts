/**
 * Single source of truth for the "this usually takes…" copy shown on each
 * AgentLoadingScreen. Estimates differ by agent (research does a web search
 * plus LLM call, question selection is a light LLM call, report generation
 * synthesizes the full report) — keeping them here means both call sites for
 * the same agent (e.g. report generation, shown from SubmittingPage and
 * ReportPage) can't drift apart from re-typing the string independently.
 */
export const AGENT_TIMING = {
  research: '30–60 seconds',
  questionSelection: '10–20 seconds',
  report: '15–45 seconds',
} as const
