import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import type { AssessmentAnswers, Report } from '../../types'
import { PdfRadarChart } from './PdfRadarChart'

// ── Color maps ─────────────────────────────────────────────────────────────────

const MATURITY_BG: Record<string, string> = {
  Reactive: '#fef2f2', Developing: '#fffbeb', Defined: '#eff6ff', Optimized: '#f0fdf4',
}
const MATURITY_FG: Record<string, string> = {
  Reactive: '#dc2626', Developing: '#d97706', Defined: '#3d6ea8', Optimized: '#16a34a',
}
const IMPACT_BG: Record<string, string> = { high: '#fef2f2', medium: '#fffbeb', low: '#f0fdf4' }
const IMPACT_FG: Record<string, string> = { high: '#dc2626', medium: '#d97706', low: '#16a34a' }
const EFFORT_BG: Record<string, string> = { high: '#fef2f2', medium: '#fffbeb', low: '#f0fdf4' }
const EFFORT_FG: Record<string, string> = { high: '#dc2626', medium: '#d97706', low: '#16a34a' }
const PRIORITY_BG: Record<string, string> = {
  quick_win: '#f0fdf4', strategic: '#eff6ff', foundational: '#faf5ff',
}
const PRIORITY_FG: Record<string, string> = {
  quick_win: '#16a34a', strategic: '#3d6ea8', foundational: '#7c3aed',
}
const PRIORITY_LABEL: Record<string, string> = {
  quick_win: 'Quick Win', strategic: 'Strategic', foundational: 'Foundational',
}
const LEVEL_BG: Record<number, string> = { 1: '#fef2f2', 2: '#fffbeb', 3: '#eff6ff', 4: '#f0fdf4' }
const LEVEL_FG: Record<number, string> = { 1: '#dc2626', 2: '#d97706', 3: '#3d6ea8', 4: '#16a34a' }

// ── Styles ─────────────────────────────────────────────────────────────────────

function buildStyles(dark: boolean) {
  const bg = dark ? '#111827' : '#f9fafb'
  const cardBg = dark ? '#1f2937' : '#ffffff'
  const primaryText = dark ? '#f9fafb' : '#111827'
  const secondaryText = dark ? '#d1d5db' : '#4b5563'
  const mutedText = dark ? '#9ca3af' : '#6b7280'
  const dimText = dark ? '#6b7280' : '#9ca3af'
  const sectionTitleColor = dark ? '#93c5fd' : '#1e3a5f'
  const barBg = dark ? '#374151' : '#e5e7eb'
  const tfBg = dark ? '#374151' : '#f3f4f6'
  const tfText = dark ? '#d1d5db' : '#374151'

  return StyleSheet.create({
    page: { fontFamily: 'Helvetica', fontSize: 9, color: primaryText, backgroundColor: bg, padding: 36 },

    headerCard: { backgroundColor: '#1e3a5f', borderRadius: 6, padding: 18, marginBottom: 14 },
    headerPillar: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: '#ffffff', marginBottom: 4 },
    headerCompany: { fontSize: 11, color: '#93c5fd' },
    headerScoreRow: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 12, gap: 10 },
    headerScore: { fontSize: 32, fontFamily: 'Courier-Bold', color: '#ffffff' },
    headerScoreOf: { fontSize: 12, color: '#93c5fd', marginBottom: 6 },
    maturityBadge: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
    maturityText: { fontSize: 9, fontFamily: 'Helvetica-Bold' },

    metaCard: { backgroundColor: cardBg, borderRadius: 6, padding: 12, marginBottom: 10 },
    metaGrid: { flexDirection: 'row', gap: 12 },
    metaCell: { flex: 1 },
    metaLabel: { fontSize: 7, color: mutedText, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
    metaValue: { fontSize: 9, color: primaryText, fontFamily: 'Helvetica-Bold' },

    sectionTitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: sectionTitleColor, marginBottom: 8, marginTop: 4 },
    card: { backgroundColor: cardBg, borderRadius: 6, padding: 12, marginBottom: 6 },

    scoreBarBg: { height: 8, backgroundColor: barBg, borderRadius: 4, marginTop: 4, marginBottom: 12 },
    scoreBarFill: { height: 8, backgroundColor: '#3d6ea8', borderRadius: 4 },
    subAreaRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
    subAreaLabel: { width: 140, fontSize: 8, color: tfText },
    subAreaBarBg: { flex: 1, height: 6, backgroundColor: barBg, borderRadius: 3 },
    subAreaBarFill: { height: 6, backgroundColor: '#3d6ea8', borderRadius: 3 },
    subAreaScore: { width: 28, fontSize: 8, fontFamily: 'Courier', color: mutedText, textAlign: 'right' },

    strengthRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
    strengthCheck: { fontSize: 10, color: '#16a34a' },
    strengthTitle: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: primaryText, marginBottom: 2 },
    strengthDesc: { fontSize: 8, color: secondaryText, lineHeight: 1.5 },

    gapTitle: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: primaryText, marginBottom: 6 },
    badgeRow: { flexDirection: 'row', gap: 6, marginBottom: 6 },
    badge: { borderRadius: 20, paddingHorizontal: 6, paddingVertical: 2 },
    badgeText: { fontSize: 7, fontFamily: 'Helvetica-Bold' },
    gapGrid: { flexDirection: 'row', gap: 10 },
    gapCell: { flex: 1 },
    gapCellLabel: { fontSize: 7, color: mutedText, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
    gapCellValue: { fontSize: 8, color: secondaryText, lineHeight: 1.5 },

    stepTitle: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: primaryText, marginBottom: 4 },
    stepDesc: { fontSize: 8, color: secondaryText, lineHeight: 1.5, marginBottom: 6 },
    stepBadgeRow: { flexDirection: 'row', gap: 6 },
    timeframeBadge: { borderRadius: 20, paddingHorizontal: 6, paddingVertical: 2, backgroundColor: tfBg },
    timeframeText: { fontSize: 7, color: tfText, fontFamily: 'Helvetica-Bold' },

    answerRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
    answerNum: { width: 14, fontSize: 8, color: dimText, marginTop: 1 },
    answerQ: { fontSize: 8, color: tfText, lineHeight: 1.5 },
    answerA: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: primaryText, marginTop: 2 },
    levelBadge: { borderRadius: 20, paddingHorizontal: 5, paddingVertical: 2, alignSelf: 'flex-start', marginTop: 1 },
    levelText: { fontSize: 7, fontFamily: 'Helvetica-Bold' },

    contextLabel: { fontSize: 7, color: mutedText, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 },
    contextValue: { fontSize: 9, color: tfText, lineHeight: 1.5 },

    footer: { position: 'absolute', bottom: 20, left: 36, right: 36, flexDirection: 'row', justifyContent: 'space-between' },
    footerText: { fontSize: 7, color: dimText },

    _scoreNum: { fontSize: 28, fontFamily: 'Courier-Bold', color: sectionTitleColor },
    _scoreOf: { fontSize: 8, color: mutedText },
    _axisLabel: { fontSize: 7, color: dimText },
  })
}

// ── Shared sub-components ─────────────────────────────────────────────────────

type Styles = ReturnType<typeof buildStyles>

function Footer({ title, s }: { title: string; s: Styles }) {
  return (
    <View style={s.footer} fixed>
      <Text style={s.footerText}>{title}</Text>
      <Text style={s.footerText} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
    </View>
  )
}

function ScoreSection({ report, s }: { report: Report; s: Styles }) {
  const breakdown = (report.pillar_breakdown ?? {}) as Record<string, number>
  const subAreas = Object.entries(breakdown)
  const hasRadar = subAreas.length >= 3
  return (
    <View style={s.card} wrap={false}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 }}>
        <View>
          <Text style={s._scoreNum}>{report.pillar_score.toFixed(1)}</Text>
          <Text style={s._scoreOf}>out of 4.0</Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={s.scoreBarBg}>
            <View style={[s.scoreBarFill, { width: `${((report.pillar_score - 1) / 3) * 100}%` as unknown as number }]} />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={s._axisLabel}>1.0 Initial</Text>
            <Text style={s._axisLabel}>4.0 Optimized</Text>
          </View>
        </View>
      </View>
      {hasRadar && (
        <View style={{ alignItems: 'center', marginBottom: 8 }}>
          <PdfRadarChart subAreas={subAreas} />
        </View>
      )}
      {subAreas.length > 1 && subAreas.map(([name, val]) => (
        <View key={name} style={s.subAreaRow}>
          <Text style={s.subAreaLabel} numberOfLines={1}>{name}</Text>
          <View style={s.subAreaBarBg}>
            <View style={[s.subAreaBarFill, { width: `${(val / 4) * 100}%` as unknown as number }]} />
          </View>
          <Text style={s.subAreaScore}>{val.toFixed(1)}</Text>
        </View>
      ))}
    </View>
  )
}

// ── Document ──────────────────────────────────────────────────────────────────

interface Props {
  answers: AssessmentAnswers
  report: Report
  darkMode?: boolean
}

export function InternalReportPdf({ answers, report, darkMode = false }: Props) {
  const s = buildStyles(darkMode)
  const ml = answers.maturity_label ?? ''
  const completedDate = answers.completed_at
    ? new Date(answers.completed_at).toLocaleDateString()
    : '—'
  const footerTitle = `${answers.company_name} — ${answers.pillar_name} Maturity Report`

  const rd = report.research_data
  const hasContext = !!(
    answers.infrastructure_location ||
    answers.tech_stack_description ||
    answers.current_tools ||
    answers.key_challenges_input ||
    answers.additional_notes
  )

  return (
    <Document title={footerTitle}>

      {/* Page 1: Header + Exec Summary + Score */}
      <Page size="A4" style={s.page}>
        <View style={s.headerCard} wrap={false}>
          <Text style={s.headerPillar}>{answers.pillar_name}</Text>
          <Text style={s.headerCompany}>{answers.company_name}</Text>
          <View style={s.headerScoreRow}>
            {answers.pillar_score != null && (
              <>
                <Text style={s.headerScore}>{answers.pillar_score.toFixed(2)}</Text>
                <Text style={s.headerScoreOf}>/ 4.00</Text>
              </>
            )}
            {ml ? (
              <View style={[s.maturityBadge, { backgroundColor: MATURITY_BG[ml] ?? '#f3f4f6', marginLeft: 8 }]}>
                <Text style={[s.maturityText, { color: MATURITY_FG[ml] ?? '#374151' }]}>{ml}</Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={s.metaCard} wrap={false}>
          <View style={s.metaGrid}>
            <View style={s.metaCell}>
              <Text style={s.metaLabel}>Prospect</Text>
              <Text style={s.metaValue}>{answers.prospect_name ?? '—'}</Text>
            </View>
            <View style={s.metaCell}>
              <Text style={s.metaLabel}>Role</Text>
              <Text style={s.metaValue}>{answers.prospect_role ?? '—'}</Text>
            </View>
            <View style={s.metaCell}>
              <Text style={s.metaLabel}>Email</Text>
              <Text style={s.metaValue}>{answers.prospect_email ?? '—'}</Text>
            </View>
            <View style={s.metaCell}>
              <Text style={s.metaLabel}>Completed</Text>
              <Text style={s.metaValue}>{completedDate}</Text>
            </View>
          </View>
        </View>

        <Text style={s.sectionTitle}>Executive Summary</Text>
        <View style={s.card} wrap={false}>
          <Text style={[{ fontSize: 9, lineHeight: 1.6 }, s.contextValue]}>{report.executive_summary}</Text>
        </View>

        <Text style={s.sectionTitle}>Maturity Score</Text>
        <ScoreSection report={report} s={s} />

        <Footer title={footerTitle} s={s} />
      </Page>

      {/* Page 2: Strengths + Gap Analysis */}
      {(report.strengths.length > 0 || report.gap_analysis.length > 0) && (
        <Page size="A4" style={s.page}>
          {report.strengths.length > 0 && (
            <>
              <Text style={s.sectionTitle}>Strengths</Text>
              {report.strengths.map((st, i) => (
                <View key={i} style={s.card} wrap={false}>
                  <View style={s.strengthRow}>
                    <Text style={s.strengthCheck}>✓</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={s.strengthTitle}>{st.title}</Text>
                      <Text style={s.strengthDesc}>{st.description}</Text>
                    </View>
                  </View>
                </View>
              ))}
            </>
          )}

          {report.gap_analysis.length > 0 && (
            <>
              <Text style={s.sectionTitle}>Gap Analysis</Text>
              {report.gap_analysis.map((g, i) => (
                <View key={i} style={s.card} wrap={false}>
                  <Text style={s.gapTitle}>{g.gap}</Text>
                  <View style={s.badgeRow}>
                    <View style={[s.badge, { backgroundColor: IMPACT_BG[g.impact] ?? '#f3f4f6' }]}>
                      <Text style={[s.badgeText, { color: IMPACT_FG[g.impact] ?? '#374151' }]}>{g.impact} impact</Text>
                    </View>
                    <View style={[s.badge, { backgroundColor: EFFORT_BG[g.effort] ?? '#f3f4f6' }]}>
                      <Text style={[s.badgeText, { color: EFFORT_FG[g.effort] ?? '#374151' }]}>{g.effort} effort</Text>
                    </View>
                  </View>
                  <View style={s.gapGrid}>
                    <View style={s.gapCell}>
                      <Text style={s.gapCellLabel}>Current</Text>
                      <Text style={s.gapCellValue}>{g.current_state}</Text>
                    </View>
                    <View style={s.gapCell}>
                      <Text style={s.gapCellLabel}>Target</Text>
                      <Text style={s.gapCellValue}>{g.target_state}</Text>
                    </View>
                  </View>
                </View>
              ))}
            </>
          )}

          <Footer title={footerTitle} s={s} />
        </Page>
      )}

      {/* Page 3: Next Steps */}
      {report.next_steps.length > 0 && (
        <Page size="A4" style={s.page}>
          <Text style={s.sectionTitle}>Next Steps</Text>
          {report.next_steps.map((n, i) => (
            <View key={i} style={s.card} wrap={false}>
              <Text style={s.stepTitle}>{n.title}</Text>
              <Text style={s.stepDesc}>{n.description}</Text>
              <View style={s.stepBadgeRow}>
                <View style={[s.badge, { backgroundColor: PRIORITY_BG[n.priority] ?? '#f3f4f6' }]}>
                  <Text style={[s.badgeText, { color: PRIORITY_FG[n.priority] ?? '#374151' }]}>
                    {PRIORITY_LABEL[n.priority] ?? n.priority}
                  </Text>
                </View>
                <View style={s.timeframeBadge}>
                  <Text style={s.timeframeText}>{n.timeframe}</Text>
                </View>
              </View>
            </View>
          ))}
          <Footer title={footerTitle} s={s} />
        </Page>
      )}

      {/* Page 4: Questions & Answers */}
      {answers.answers.length > 0 && (
        <Page size="A4" style={s.page}>
          <Text style={s.sectionTitle}>Prospect Answers</Text>
          {answers.answers.map((row, i) => (
            <View key={i} style={[s.card, { marginBottom: 5 }]} wrap={false}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={s.answerNum}>{i + 1}</Text>
                <View style={[s.levelBadge, { backgroundColor: LEVEL_BG[row.maturity_level] ?? '#f3f4f6' }]}>
                  <Text style={[s.levelText, { color: LEVEL_FG[row.maturity_level] ?? '#374151' }]}>
                    L{row.maturity_level}
                  </Text>
                </View>
              </View>
              <Text style={s.answerQ}>{row.question_text}</Text>
              <Text style={[s.answerA, { marginTop: 4 }]}>{row.selected_option_text}</Text>
            </View>
          ))}
          <Footer title={footerTitle} s={s} />
        </Page>
      )}

      {/* Page 5: Research Summary */}
      {rd && (
        <Page size="A4" style={s.page}>
          <Text style={s.sectionTitle}>Research Summary</Text>

          <View style={s.card} wrap={false}>
            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={s.metaLabel}>Industry</Text>
                <Text style={s.metaValue}>{rd.industry || '—'}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.metaLabel}>Company Size</Text>
                <Text style={s.metaValue}>{rd.company_size || '—'}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.metaLabel}>Data Confidence</Text>
                <Text style={s.metaValue}>{rd.data_confidence || '—'}</Text>
              </View>
            </View>

            {rd.products_summary ? (
              <View style={{ marginBottom: 8 }}>
                <Text style={s.metaLabel}>Products / Summary</Text>
                <Text style={s.contextValue}>{rd.products_summary}</Text>
              </View>
            ) : null}

            {rd.target_customers && rd.target_customers !== 'unknown' ? (
              <View>
                <Text style={s.metaLabel}>Target Customers</Text>
                <Text style={s.contextValue}>{rd.target_customers}</Text>
              </View>
            ) : null}
          </View>

          {(rd.cloud_providers?.length ?? 0) > 0 && (
            <View style={s.card} wrap={false}>
              <Text style={s.metaLabel}>Cloud Providers</Text>
              <Text style={[s.contextValue, { marginTop: 3 }]}>{rd.cloud_providers.join(', ')}</Text>
            </View>
          )}

          {(rd.key_challenges?.length ?? 0) > 0 && (
            <View style={s.card} wrap={false}>
              <Text style={s.metaLabel}>Key Challenges</Text>
              {rd.key_challenges.map((c, i) => (
                <Text key={i} style={[s.contextValue, { marginTop: 2 }]}>• {c}</Text>
              ))}
            </View>
          )}

          {(rd.business_outcomes?.length ?? 0) > 0 && (
            <View style={s.card} wrap={false}>
              <Text style={s.metaLabel}>Business Outcomes</Text>
              {rd.business_outcomes.map((o, i) => (
                <Text key={i} style={[s.contextValue, { marginTop: 2 }]}>• {o}</Text>
              ))}
            </View>
          )}

          {'news_insights' in rd && (rd as { news_insights?: string }).news_insights && (
            <View style={s.card} wrap={false}>
              <Text style={s.metaLabel}>News & Context</Text>
              <Text style={[s.contextValue, { marginTop: 3 }]}>{(rd as { news_insights?: string }).news_insights}</Text>
            </View>
          )}

          <Footer title={footerTitle} s={s} />
        </Page>
      )}

      {/* Page 6: Registration Context */}
      {hasContext && (
        <Page size="A4" style={s.page}>
          <Text style={s.sectionTitle}>Registration Context</Text>

          {answers.infrastructure_location && (
            <View style={s.card} wrap={false}>
              <Text style={s.contextLabel}>Infrastructure & Deployment</Text>
              <Text style={s.contextValue}>{answers.infrastructure_location}</Text>
            </View>
          )}

          {answers.tech_stack_description && (
            <View style={s.card} wrap={false}>
              <Text style={s.contextLabel}>Tech Stack</Text>
              <Text style={s.contextValue}>{answers.tech_stack_description}</Text>
            </View>
          )}

          {answers.current_tools && (
            <View style={s.card} wrap={false}>
              <Text style={s.contextLabel}>Current Tools</Text>
              <Text style={s.contextValue}>{answers.current_tools}</Text>
            </View>
          )}

          {answers.key_challenges_input && (
            <View style={s.card} wrap={false}>
              <Text style={s.contextLabel}>Key Challenges (Self-reported)</Text>
              <Text style={s.contextValue}>{answers.key_challenges_input}</Text>
            </View>
          )}

          {answers.additional_notes && (
            <View style={s.card} wrap={false}>
              <Text style={s.contextLabel}>Additional Notes</Text>
              <Text style={s.contextValue}>{answers.additional_notes}</Text>
            </View>
          )}

          <Footer title={footerTitle} s={s} />
        </Page>
      )}

    </Document>
  )
}
