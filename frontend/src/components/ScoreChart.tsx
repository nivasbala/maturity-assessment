import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  RadialBarChart, RadialBar, ResponsiveContainer,
} from 'recharts'

export interface ScoreChartData {
  pillar_breakdown: Record<string, unknown>
  pillar_score: number
  maturity_label: string
}

export function ScoreChart({ report }: { report: ScoreChartData }) {
  const breakdown = (report.pillar_breakdown ?? {}) as Record<string, number>
  const subAreas = Object.entries(breakdown)

  if (subAreas.length >= 3) {
    const data = subAreas.map(([name, value]) => ({ subject: name, score: value, fullMark: 4 }))
    return (
      <ResponsiveContainer width="100%" height={260}>
        <RadarChart cx="50%" cy="50%" outerRadius="75%" data={data}>
          <PolarGrid stroke="#e5e7eb" />
          <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12, fill: '#6b7280' }} />
          <PolarRadiusAxis domain={[0, 4]} tick={{ fontSize: 10, fill: '#9ca3af', fontFamily: '"JetBrains Mono", monospace' }} />
          <Radar name="Score" dataKey="score" stroke="#2563eb" fill="#2563eb" fillOpacity={0.25} />
        </RadarChart>
      </ResponsiveContainer>
    )
  }

  const pct = ((report.pillar_score - 1) / 3) * 100
  const data = [{ name: report.maturity_label, value: pct, fill: '#2563eb' }]
  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={220}>
        <RadialBarChart
          cx="50%" cy="65%"
          innerRadius="60%" outerRadius="90%"
          startAngle={180} endAngle={0}
          data={data}
          barSize={20}
        >
          <RadialBar dataKey="value" cornerRadius={6} background={{ fill: '#e5e7eb' }} />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-end pb-4 pointer-events-none">
        <span className="font-mono tabular-nums text-4xl font-bold text-[#1B2B4B] dark:text-gray-100">
          {report.pillar_score.toFixed(1)}
        </span>
        <span className="text-sm text-gray-400 dark:text-gray-500">out of 4.0</span>
      </div>
    </div>
  )
}
