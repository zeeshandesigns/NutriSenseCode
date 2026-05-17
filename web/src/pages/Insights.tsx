import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { TrendingUp, BarChart3, PieChart as PieChartIcon, Sparkles } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import WeeklyTrendChart from '../components/WeeklyTrendChart'
import MacroChart from '../components/MacroChart'

export default function Insights() {
  const { user } = useAuth()
  const [scans, setScans] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    async function load() {
      const week = new Date(Date.now() - 7 * 86400000).toISOString()
      const { data } = await supabase.from('scans').select('*')
        .eq('user_id', user!.id).gte('created_at', week).order('created_at')
      setScans(data ?? [])
      setLoading(false)
    }
    load()
  }, [user])

  if (loading) return <p className="text-gray-400 text-center py-10">Loading…</p>

  if (!scans.length) return (
    <div className="text-center py-20 bg-white rounded-2xl border shadow-sm">
      <div className="text-5xl mb-4">🍽️</div>
      <h2 className="text-xl font-semibold mb-2">No data yet</h2>
      <p className="text-gray-400 mb-6">Scan your meals to start seeing weekly patterns</p>
      <Link to="/dashboard" className="bg-brand-700 text-white px-4 py-2 rounded-lg text-sm hover:bg-brand-800 transition-colors">
        Scan Now
      </Link>
    </div>
  )

  const freq = scans.reduce<Record<string, number>>((a, s) => {
    a[s.food_label] = (a[s.food_label] ?? 0) + 1; return a
  }, {})
  const top5 = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 5)
  const avg = {
    calories: Math.round(scans.reduce((s, x) => s + (x.nutrition?.calories ?? 0), 0) / scans.length),
    protein:  Math.round(scans.reduce((s, x) => s + (x.nutrition?.protein  ?? 0), 0) / scans.length),
    carbs:    Math.round(scans.reduce((s, x) => s + (x.nutrition?.carbs    ?? 0), 0) / scans.length),
    fat:      Math.round(scans.reduce((s, x) => s + (x.nutrition?.fat      ?? 0), 0) / scans.length),
  }

  const STATS = [
    { label: 'Scans this week', value: scans.length, suffix: '' },
    { label: 'Avg calories',     value: avg.calories,  suffix: '' },
    { label: 'Avg protein',      value: avg.protein,   suffix: 'g' },
    { label: 'Avg carbs',        value: avg.carbs,     suffix: 'g' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Weekly Insights</h1>
        <p className="text-sm text-gray-500">Your nutrition patterns over the last 7 days</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {STATS.map(({ label, value, suffix }) => (
          <div key={label} className="bg-white rounded-xl border shadow-sm p-4 text-center">
            <p className="text-2xl font-bold text-brand-700">{value}{suffix}</p>
            <p className="text-xs text-gray-500 mt-1">{label}</p>
          </div>
        ))}
      </div>

      {scans.length < 3 ? (
        <div className="bg-white rounded-xl border shadow-sm p-6 text-center">
          <p className="text-sm text-gray-500">
            Scan {3 - scans.length} more meal{3 - scans.length !== 1 ? 's' : ''} to unlock charts
          </p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl border shadow-sm p-4">
            <h2 className="flex items-center gap-2 font-semibold text-gray-800 mb-3 text-sm">
              <TrendingUp className="h-4 w-4 text-brand-700" />
              Daily calorie average
            </h2>
            <WeeklyTrendChart scans={scans} />
          </div>

          <div className="bg-white rounded-xl border shadow-sm p-4">
            <h2 className="flex items-center gap-2 font-semibold text-gray-800 mb-3 text-sm">
              <PieChartIcon className="h-4 w-4 text-brand-700" />
              Macro split (kcal)
            </h2>
            <MacroChart nutrition={avg} />
          </div>
        </>
      )}

      <div className="bg-white rounded-xl border shadow-sm p-4">
        <h2 className="flex items-center gap-2 font-semibold text-gray-800 mb-3 text-sm">
          <BarChart3 className="h-4 w-4 text-brand-700" />
          Most scanned this week
        </h2>
        {top5.length ? (
          <div className="space-y-2">
            {top5.map(([label, count], idx) => (
              <div key={label} className="flex items-center gap-3">
                <div className="w-7 h-7 bg-brand-100 rounded-full flex items-center justify-center text-brand-700 font-bold text-xs shrink-0">
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="capitalize truncate">{label.replace(/_/g, ' ')}</span>
                    <span className="text-gray-400">{count}×</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-brand-500" style={{ width: `${(count / scans.length) * 100}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400">No scans yet</p>
        )}
      </div>

      <Link to="/chatbot" className="block w-full text-center bg-brand-50 text-brand-700 border border-brand-200 hover:bg-brand-100 px-4 py-3 rounded-xl text-sm transition-colors">
        <Sparkles className="inline h-4 w-4 mr-1.5" />
        Ask AI about your diet
      </Link>
    </div>
  )
}
