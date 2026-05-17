import { useEffect, useState } from 'react'
import { Search, ChevronDown, ChevronUp, Sparkles } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { displayLabel } from '../lib/api'

interface Scan {
  id: string
  food_label: string
  confidence: number
  nutrition: any
  insight: string | null
  image_url: string | null
  created_at: string
}

export default function History() {
  const { user } = useAuth()
  const [scans, setScans] = useState<Scan[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    async function load() {
      const { data } = await supabase.from('scans').select('*')
        .eq('user_id', user!.id).order('created_at', { ascending: false }).limit(200)
      setScans(data ?? [])
      setLoading(false)
    }
    load()
  }, [user])

  const filtered = scans.filter(s =>
    s.food_label.toLowerCase().includes(search.toLowerCase())
  )
  const totalCalories = filtered.reduce((sum, s) => sum + (s.nutrition?.calories ?? 0), 0)

  // Group by date
  const grouped: Record<string, Scan[]> = {}
  for (const s of filtered) {
    const d = new Date(s.created_at).toLocaleDateString('en-PK', {
      weekday: 'long', day: 'numeric', month: 'long',
    })
    if (!grouped[d]) grouped[d] = []
    grouped[d].push(s)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Scan History</h1>
        <p className="text-sm text-gray-500">All your past food scans, grouped by day</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl shadow-sm border p-4 text-center">
          <p className="text-2xl font-bold text-brand-700">{filtered.length}</p>
          <p className="text-xs text-gray-500">Total scans</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4 text-center">
          <p className="text-2xl font-bold text-brand-700">{totalCalories.toLocaleString()}</p>
          <p className="text-xs text-gray-500">Total calories</p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
        <input
          type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by food name…"
          className="w-full pl-10 pr-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>

      {loading ? (
        <p className="text-gray-400 text-center py-10">Loading…</p>
      ) : !filtered.length ? (
        <p className="text-gray-400 text-center py-10 bg-white rounded-xl border">
          {search ? 'No scans match your search.' : 'No scans yet — try scanning your next meal!'}
        </p>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([date, items]) => (
            <div key={date}>
              <h3 className="text-sm font-semibold text-gray-700 mb-3 sticky top-14 bg-gray-50 py-2 z-10">
                {date}
              </h3>
              <div className="space-y-2">
                {items.map(scan => {
                  const isExpanded = expandedId === scan.id
                  return (
                    <div key={scan.id} className="bg-white rounded-xl shadow-sm border overflow-hidden">
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : scan.id)}
                        className="w-full p-4 text-left hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-3">
                          {scan.image_url && (
                            <img src={scan.image_url} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-800 truncate">{displayLabel(scan.food_label)}</p>
                            <p className="text-xs text-gray-400">
                              {new Date(scan.created_at).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-brand-700">{scan.nutrition?.calories ?? '—'} kcal</p>
                            <p className="text-xs text-gray-400">{Math.round(scan.confidence * 100)}% confident</p>
                          </div>
                          {isExpanded ? <ChevronUp className="h-4 w-4 text-gray-400 shrink-0" /> : <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />}
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="px-4 pb-4 pt-0 border-t border-gray-100 space-y-3">
                          {scan.nutrition && typeof scan.nutrition.calories === 'number' && (
                            <div className="grid grid-cols-4 gap-2 text-center text-xs pt-3">
                              <div className="bg-brand-50 rounded p-2"><p className="font-semibold text-brand-700">{scan.nutrition.calories}</p><p className="text-gray-500">kcal</p></div>
                              <div className="bg-brand-50 rounded p-2"><p className="font-semibold text-brand-700">{scan.nutrition.protein}g</p><p className="text-gray-500">protein</p></div>
                              <div className="bg-brand-50 rounded p-2"><p className="font-semibold text-brand-700">{scan.nutrition.carbs}g</p><p className="text-gray-500">carbs</p></div>
                              <div className="bg-brand-50 rounded p-2"><p className="font-semibold text-brand-700">{scan.nutrition.fat}g</p><p className="text-gray-500">fat</p></div>
                            </div>
                          )}
                          {scan.insight && (
                            <div className="bg-brand-50 p-3 rounded-lg text-sm text-gray-700 flex gap-2">
                              <Sparkles className="h-4 w-4 text-brand-700 shrink-0 mt-0.5" />
                              <span className="italic">{scan.insight}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
