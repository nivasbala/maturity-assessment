import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import type { ReportPublic } from '../../types'
import { PdfRadarChart } from './PdfRadarChart'

// ── Color maps ─────────────────────────────────────────────────────────────────

const MATURITY_BG: Record<string, string> = {
  Reactive: '#fef2f2', Developing: '#fffbeb', Defined: '#eff6ff', Optimized: '#f0fdf4',
}
const MATURITY_FG: Record<string, string> = {
  Reactive: '#dc2626', Developing: '#d97706', Defined: '#2563eb', Optimized: '#16a34a',
}
const IMPACT_BG: Record<string, string> = { high: '#fef2f2', medium: '#fffbeb', low: '#f0fdf4' }
const IMPACT_FG: Record<string, string> = { high: '#dc2626', medium: '#d97706', low: '#16a34a' }
const EFFORT_BG: Record<string, string> = { high: '#fef2f2', medium: '#fffbeb', low: '#f0fdf4' }
const EFFORT_FG: Record<string, string> = { high: '#dc2626', medium: '#d97706', low: '#16a34a' }
const PRIORITY_BG: Record<string, string> = {
  quick_win: '#f0fdf4', strategic: '#eff6ff', foundational: '#faf5ff',
}
const PRIORITY_FG: Record<string, string> = {
  quick_win: '#16a34a', strategic: '#2563eb', foundational: '#7c3aed',
}
const PRIORITY_LABEL: Record<string, string> = {
  quick_win: 'Quick Win', strategic: 'Strategic', foundational: 'Foundational',
}
const LEVEL_BG: Record<number, string> = { 1: '#fef2f2', 2: '#fffbeb', 3: '#eff6ff', 4: '#f0fdf4' }
const LEVEL_FG: Record<number, string> = { 1: '#dc2626', 2: '#d97706', 3: '#2563eb', 4: '#16a34a' }

// ── Styles ─────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  page: { fontFamily: 'Helvetica', fontSize: 9, color: '#111827', backgroundColor: '#f9fafb', padding: 36 },

  headerCard: { backgroundColor: '#1e3a5f', borderRadius: 6, padding: 18, marginBottom: 14 },
  headerPillar: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: '#ffffff', marginBottom: 4 },
  headerCompany: { fontSize: 11, color: '#93c5fd' },
  headerScoreRow: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 12, gap: 10 },
  headerScore: { fontSize: 32, fontFamily: 'Helvetica-Bold', color: '#ffffff' },
  headerScoreOf: { fontSize: 12, color: '#93c5fd', marginBottom: 6 },
  maturityBadge: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
  maturityText: { fontSize: 9, fontFamily: 'Helvetica-Bold' },

  metaRow: { backgroundColor: '#ffffff', borderRadius: 6, padding: 10, marginBottom: 12, flexDirection: 'row', gap: 12 },
  metaCell: { flex: 1 },
  metaLabel: { fontSize: 7, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  metaValue: { fontSize: 9, color: '#111827', fontFamily: 'Helvetica-Bold' },

  sectionTitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#1e3a5f', marginBottom: 8, marginTop: 4 },
  card: { backgroundColor: '#ffffff', borderRadius: 6, padding: 12, marginBottom: 6 },

  scoreBarBg: { height: 8, backgroundColor: '#e5e7eb', borderRadius: 4, marginTop: 4, marginBottom: 12 },
  scoreBarFill: { height: 8, backgroundColor: '#2563eb', borderRadius: 4 },
  subAreaRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
  subAreaLabel: { width: 140, fontSize: 8, color: '#374151' },
  subAreaBarBg: { flex: 1, height: 6, backgroundColor: '#e5e7eb', borderRadius: 3 },
  subAreaBarFill: { height: 6, backgroundColor: '#2563eb', borderRadius: 3 },
  subAreaScore: { width: 28, fontSize: 8, color: '#6b7280', textAlign: 'right' },

  strengthRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  strengthCheck: { fontSize: 10, color: '#16a34a' },
  strengthTitle: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#111827', marginBottom: 2 },
  strengthDesc: { fontSize: 8, color: '#4b5563', lineHeight: 1.5 },

  gapTitle: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#111827', marginBottom: 6 },
  badgeRow: { flexDirection: 'row', gap: 6, marginBottom: 6 },
  badge: { borderRadius: 20, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText: { fontSize: 7, fontFamily: 'Helvetica-Bold' },
  gapGrid: { flexDirection: 'row', gap: 10 },
  gapCell: { flex: 1 },
  gapCellLabel: { fontSize: 7, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  gapCellValue: { fontSize: 8, color: '#4b5563', lineHeight: 1.5 },

  stepTitle: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#111827', marginBottom: 4 },
  stepDesc: { fontSize: 8, color: '#4b5563', lineHeight: 1.5, marginBottom: 6 },
  stepBadgeRow: { flexDirection: 'row', gap: 6 },
  timeframeBadge: { borderRadius: 20, paddingHorizontal: 6, paddingVertical: 2, backgroundColor: '#f3f4f6' },
  timeframeText: { fontSize: 7, color: '#374151', fontFamily: 'Helvetica-Bold' },

  answerRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  answerNum: { width: 14, fontSize: 8, color: '#9ca3af', marginTop: 1 },
  answerQ: { flex: 1, fontSize: 8, color: '#374151', lineHeight: 1.5 },
  answerA: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#111827', marginTop: 2 },
  levelBadge: { borderRadius: 20, paddingHorizontal: 5, paddingVertical: 2, alignSelf: 'flex-start', marginTop: 1 },
  levelText: { fontSize: 7, fontFamily: 'Helvetica-Bold' },

  contextLabel: { fontSize: 7, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 },
  contextValue: { fontSize: 9, color: '#374151', lineHeight: 1.5 },

  footer: { position: 'absolute', bottom: 20, left: 36, right: 36, flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontSize: 7, color: '#9ca3af' },
})

// ── Shared sub-components ─────────────────────────────────────────────────────

function Footer({ title }: { title: string }) {
  return (
    <View style={s.footer} fixed>
      <Text style={s.footerText}>{title}</Text>
      <Text style={s.footerText} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
    </View>
  )
}

function ScoreSection({ report }: { report: ReportPublic }) {
  const breakdown = (report.pillar_breakdown ?? {}) as Record<string, number>
  const subAreas = Object.entries(breakdown)
  const hasRadar = subAreas.length >= 3
  return (
    <View style={s.card} wrap={false}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 }}>
        <View>
          <Text style={{ fontSize: 28, fontFamily: 'Helvetica-Bold', color: '#1e3a5f' }}>
            {report.pillar_score.toFixed(1)}
          </Text>
          <Text style={{ fontSize: 8, color: '#6b7280' }}>out of 4.0</Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={s.scoreBarBg}>
            <View style={[s.scoreBarFill, { width: `${((report.pillar_score - 1) / 3) * 100}%` as unknown as number }]} />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 7, color: '#9ca3af' }}>1.0 Initial</Text>
            <Text style={{ fontSize: 7, color: '#9ca3af' }}>4.0 Optimized</Text>
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
  report: ReportPublic
}

export function ProspectReportPdf({ report }: Props) {
  const ml = report.maturity_label
  const footerTitle = `${report.company_name} — ${report.pillar_name} Maturity Report`

  const hasContext = !!(
    report.infrastructure_location ||
    report.tech_stack_description ||
    report.current_tools ||
    report.key_challenges_input ||
    report.additional_notes
  )

  return (
    <Document title={footerTitle}>

      {/* Page 1: Header + Exec Summary + Score */}
      <Page size="A4" style={s.page}>
        <View style={s.headerCard} wrap={false}>
          <Text style={s.headerPillar}>{report.pillar_name}</Text>
          <Text style={s.headerCompany}>{report.company_name}</Text>
          <View style={s.headerScoreRow}>
            <Text style={s.headerScore}>{report.pillar_score.toFixed(1)}</Text>
            <Text style={s.headerScoreOf}>/ 4.0</Text>
            {ml ? (
              <View style={[s.maturityBadge, { backgroundColor: MATURITY_BG[ml] ?? '#f3f4f6', marginLeft: 8 }]}>
                <Text style={[s.maturityText, { color: MATURITY_FG[ml] ?? '#374151' }]}>{ml}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {(report.prospect_name || report.prospect_role) ? (
          <View style={s.metaRow} wrap={false}>
            {report.prospect_name ? (
              <View style={s.metaCell}>
                <Text style={s.metaLabel}>Prepared for</Text>
                <Text style={s.metaValue}>{report.prospect_name}</Text>
              </View>
            ) : null}
            {report.prospect_role ? (
              <View style={s.metaCell}>
                <Text style={s.metaLabel}>Role</Text>
                <Text style={s.metaValue}>{report.prospect_role}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        <Text style={s.sectionTitle}>Executive Summary</Text>
        <View style={s.card} wrap={false}>
          <Text style={{ fontSize: 9, color: '#374151', lineHeight: 1.6 }}>{report.executive_summary}</Text>
        </View>

        <Text style={s.sectionTitle}>Maturity Score</Text>
        <ScoreSection report={report} />

        <Footer title={footerTitle} />
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

          <Footer title={footerTitle} />
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
          <Footer title={footerTitle} />
        </Page>
      )}

      {/* Page 4: Questions & Answers */}
      {(report.answers?.length ?? 0) > 0 && (
        <Page size="A4" style={s.page}>
          <Text style={s.sectionTitle}>Questions & Answers</Text>
          {report.answers.map((row, i) => (
            <View key={i} style={[s.card, { marginBottom: 5 }]} wrap={false}>
              <View style={s.answerRow}>
                <Text style={s.answerNum}>{i + 1}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.answerQ}>{row.question_text}</Text>
                  <Text style={s.answerA}>{row.selected_option_text}</Text>
                </View>
                <View style={[s.levelBadge, { backgroundColor: LEVEL_BG[row.maturity_level] ?? '#f3f4f6' }]}>
                  <Text style={[s.levelText, { color: LEVEL_FG[row.maturity_level] ?? '#374151' }]}>
                    L{row.maturity_level}
                  </Text>
                </View>
              </View>
            </View>
          ))}
          <Footer title={footerTitle} />
        </Page>
      )}

      {/* Page 5: Research Summary */}
      {report.research_data && (
        <Page size="A4" style={s.page}>
          <Text style={s.sectionTitle}>Research Summary</Text>

          <View style={s.card} wrap={false}>
            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={s.metaLabel}>Industry</Text>
                <Text style={s.metaValue}>{report.research_data.industry || '—'}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.metaLabel}>Company Size</Text>
                <Text style={s.metaValue}>{report.research_data.company_size || '—'}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.metaLabel}>Data Confidence</Text>
                <Text style={s.metaValue}>{report.research_data.data_confidence || '—'}</Text>
              </View>
            </View>

            {report.research_data.products_summary ? (
              <View style={{ marginBottom: 8 }}>
                <Text style={s.metaLabel}>Products / Summary</Text>
                <Text style={s.contextValue}>{report.research_data.products_summary}</Text>
              </View>
            ) : null}

            {report.research_data.target_customers && report.research_data.target_customers !== 'unknown' ? (
              <View style={{ marginBottom: 8 }}>
                <Text style={s.metaLabel}>Target Customers</Text>
                <Text style={s.contextValue}>{report.research_data.target_customers}</Text>
              </View>
            ) : null}
          </View>

          {(report.research_data.cloud_providers?.length ?? 0) > 0 && (
            <View style={s.card} wrap={false}>
              <Text style={s.metaLabel}>Cloud Providers</Text>
              <Text style={[s.contextValue, { marginTop: 3 }]}>
                {report.research_data.cloud_providers.join(', ')}
              </Text>
            </View>
          )}

          {(report.research_data.key_challenges?.length ?? 0) > 0 && (
            <View style={s.card} wrap={false}>
              <Text style={s.metaLabel}>Key Challenges</Text>
              {report.research_data.key_challenges.map((c, i) => (
                <Text key={i} style={[s.contextValue, { marginTop: 2 }]}>• {c}</Text>
              ))}
            </View>
          )}

          {(report.research_data.business_outcomes?.length ?? 0) > 0 && (
            <View style={s.card} wrap={false}>
              <Text style={s.metaLabel}>Business Outcomes</Text>
              {report.research_data.business_outcomes.map((o, i) => (
                <Text key={i} style={[s.contextValue, { marginTop: 2 }]}>• {o}</Text>
              ))}
            </View>
          )}

          {report.research_data.news_insights && (
            <View style={s.card} wrap={false}>
              <Text style={s.metaLabel}>News & Context</Text>
              <Text style={[s.contextValue, { marginTop: 3 }]}>{report.research_data.news_insights}</Text>
            </View>
          )}

          <Footer title={footerTitle} />
        </Page>
      )}

      {/* Page 6: Registration Context */}
      {hasContext && (
        <Page size="A4" style={s.page}>
          <Text style={s.sectionTitle}>Registration Context</Text>

          {report.infrastructure_location && (
            <View style={s.card} wrap={false}>
              <Text style={s.contextLabel}>Infrastructure & Deployment</Text>
              <Text style={s.contextValue}>{report.infrastructure_location}</Text>
            </View>
          )}

          {report.tech_stack_description && (
            <View style={s.card} wrap={false}>
              <Text style={s.contextLabel}>Tech Stack</Text>
              <Text style={s.contextValue}>{report.tech_stack_description}</Text>
            </View>
          )}

          {report.current_tools && (
            <View style={s.card} wrap={false}>
              <Text style={s.contextLabel}>Current Tools</Text>
              <Text style={s.contextValue}>{report.current_tools}</Text>
            </View>
          )}

          {report.key_challenges_input && (
            <View style={s.card} wrap={false}>
              <Text style={s.contextLabel}>Key Challenges (Self-reported)</Text>
              <Text style={s.contextValue}>{report.key_challenges_input}</Text>
            </View>
          )}

          {report.additional_notes && (
            <View style={s.card} wrap={false}>
              <Text style={s.contextLabel}>Additional Notes</Text>
              <Text style={s.contextValue}>{report.additional_notes}</Text>
            </View>
          )}

          <Footer title={footerTitle} />
        </Page>
      )}

    </Document>
  )
}
