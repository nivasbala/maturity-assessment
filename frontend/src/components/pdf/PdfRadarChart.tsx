import { Svg, G, Polygon, Line, Circle, Text as SvgText } from '@react-pdf/renderer'

const CX = 110
const CY = 115
const MAX_R = 72
const LABEL_R = MAX_R + 20
const GRID_LEVELS = [1, 2, 3, 4]
const WIDTH = 220
const HEIGHT = 230

function radarAngles(n: number): number[] {
  return Array.from({ length: n }, (_, i) => -Math.PI / 2 + (i * 2 * Math.PI) / n)
}

function gridPoints(angles: number[], level: number): string {
  const r = (level / 4) * MAX_R
  return angles.map(a => `${CX + r * Math.cos(a)},${CY + r * Math.sin(a)}`).join(' ')
}

function clampedCoords(angles: number[], values: number[]): { x: number; y: number }[] {
  return angles.map((a, i) => {
    const r = (Math.max(1, Math.min(4, values[i])) / 4) * MAX_R
    return { x: CX + r * Math.cos(a), y: CY + r * Math.sin(a) }
  })
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s
}

interface Props {
  subAreas: [string, number][]
}

export function PdfRadarChart({ subAreas }: Props) {
  const n = subAreas.length
  const angles = radarAngles(n)
  const values = subAreas.map(([, v]) => v)
  const coords = clampedCoords(angles, values)
  const dataPointsStr = coords.map(({ x, y }) => `${x},${y}`).join(' ')

  return (
    <Svg width={WIDTH} height={HEIGHT}>
      {/* Grid polygons */}
      <G>
        {GRID_LEVELS.map(level => (
          <Polygon
            key={level}
            points={gridPoints(angles, level)}
            fill={level === 4 ? '#f0f9ff' : 'none'}
            stroke="#e5e7eb"
            strokeWidth={0.75}
          />
        ))}
      </G>

      {/* Axis lines from center to each vertex */}
      <G>
        {angles.map((a, i) => (
          <Line
            key={i}
            x1={CX}
            y1={CY}
            x2={CX + MAX_R * Math.cos(a)}
            y2={CY + MAX_R * Math.sin(a)}
            stroke="#e5e7eb"
            strokeWidth={0.75}
          />
        ))}
      </G>

      {/* Data polygon */}
      <Polygon
        points={dataPointsStr}
        fill="#2563eb"
        fillOpacity={0.25}
        stroke="#2563eb"
        strokeWidth={1.5}
      />

      {/* Data points */}
      <G>
        {coords.map(({ x, y }, i) => (
          <Circle key={i} cx={x} cy={y} r={3} fill="#2563eb" />
        ))}
      </G>

      {/* Axis labels */}
      <G>
        {angles.map((a, i) => {
          const lx = CX + LABEL_R * Math.cos(a)
          const ly = CY + LABEL_R * Math.sin(a)
          const label = truncate(subAreas[i][0], 18)
          return (
            <SvgText
              key={i}
              x={lx}
              y={ly + 3}
              fontSize={6.5}
              fill="#374151"
              textAnchor="middle"
            >
              {label}
            </SvgText>
          )
        })}
      </G>

      {/* Grid level labels (1–4) on the top axis */}
      <G>
        {GRID_LEVELS.map(level => {
          const r = (level / 4) * MAX_R
          return (
            <SvgText
              key={level}
              x={CX + 3}
              y={CY - r + 2}
              fontSize={5.5}
              fill="#9ca3af"
            >
              {level}
            </SvgText>
          )
        })}
      </G>
    </Svg>
  )
}
