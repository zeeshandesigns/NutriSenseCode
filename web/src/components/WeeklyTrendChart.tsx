import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

interface Props { scans: any[] }

export default function WeeklyTrendChart({ scans }: Props) {
  const byDay: Record<string, number[]> = {}
  for (const s of scans) {
    const day = new Date(s.created_at).toLocaleDateString('en-PK', { weekday: 'short', day: 'numeric' })
    if (!byDay[day]) byDay[day] = []
    byDay[day].push(s.nutrition?.calories ?? 0)
  }
  const data = Object.entries(byDay).map(([day, cals]) => ({
    day,
    avgCal: Math.round(cals.reduce((a, b) => a + b, 0) / cals.length),
  }))

  return (
    <div className="bg-white rounded-xl border p-4">
      <h3 className="font-semibold mb-3 text-sm">Daily Calorie Average</h3>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="day" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip />
          <Line type="monotone" dataKey="avgCal" stroke="#0A362A" strokeWidth={2.5} dot={{ r: 4, fill: '#10B981' }} activeDot={{ r: 6, fill: '#0A362A' }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
