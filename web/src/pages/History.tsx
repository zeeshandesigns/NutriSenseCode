import { useEffect, useState } from 'react'
import { Search, ChevronDown, Sparkles, Utensils } from 'lucide-react'
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
      {/* Heading */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-500 mb-1">History</p>
        <h1 className="text-3xl font-extrabold tracking-tight text-brand-700">Your scans</h1>
        <p className="text-sm text-[#475569] mt-1">All your past meals, grouped by day.</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-soft p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">Total scans</p>
          <p className="tabular text-2xl font-bold text-[#1E293B] mt-1">{filtered.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-soft p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">Total calories</p>
          <p className="tabular text-2xl font-bold text-[#1E293B] mt-1">
            {totalCalories.toLocaleString()}
            <span className="text-sm font-medium text-[#94A3B8] ml-1">kcal</span>
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8] h-4 w-4" />
        <input
          type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by food name…"
          className="w-full pl-10 pr-3 py-2.5 bg-white border border-[#E2E8F0] rounded-xl text-sm placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
        />
      </div>

      {loading ? (
        <p className="text-[#94A3B8] text-center py-10">Loading…</p>
      ) : !filtered.length ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-[#E2E8F0] shadow-soft">
          <Utensils className="h-10 w-10 text-[#CBD5E1] mx-auto mb-3" />
          <p className="text-[#475569] font-medium">
            {search ? 'No scans match your search.' : 'No scans yet'}
          </p>
          {!search && <p className="text-xs text-[#94A3B8] mt-1">Snap your next meal to get started.</p>}
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).map(([date, items]) => (
            <div key={date}>
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B] mb-3 sticky top-14 bg-canvas py-2 z-10 backdrop-blur" style={{ backgroundColor: '#f8faf9' }}>
                {date}
              </h3>
              <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-soft overflow-hidden divide-y divide-[#E2E8F0]">
                {items.map(scan => {
                  const isExpanded = expandedId === scan.id
                  return (
                    <div key={scan.id}>
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : scan.id)}
                        className="w-full px-4 py-3.5 text-left hover:bg-brand-700/5 transition-colors"
                      >
                        <div className="flex items-center gap-3.5">
                          {/* 40x40 circular thumb */}
                          {scan.image_url ? (
                            <img
                              src={scan.image_url}
                              alt=""
                              className="w-10 h-10 rounded-full object-cover shrink-0 ring-1 ring-[#E2E8F0]"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-brand-50 flex items-center justify-center shrink-0 ring-1 ring-brand-100">
                              <Utensils size={16} className="text-brand-500" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-[#1E293B] truncate">{displayLabel(scan.food_label)}</p>
                            <p className="text-xs text-[#94A3B8] tabular">
                              {new Date(scan.created_at).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' })}
                              {' · '}{Math.round(scan.confidence * 100)}% confident
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="tabular font-bold text-[#1E293B]">
                              {scan.nutrition?.calories ?? '—'}
                              <span className="text-xs font-medium text-[#94A3B8] ml-0.5">kcal</span>
                            </p>
                          </div>
                          <ChevronDown className={`h-4 w-4 text-[#94A3B8] shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="px-4 pb-4 pt-0 bg-[#F8FAF9]/60 space-y-3">
                          {scan.nutrition && typeof scan.nutrition.calories === 'number' && (
                            <div className="grid grid-cols-4 divide-x divide-[#E2E8F0] bg-white rounded-lg border border-[#E2E8F0] mt-3">
                              {[
                                { k: 'calories', v: scan.nutrition.calories, u: 'kcal', l: 'Calories' },
                                { k: 'protein',  v: scan.nutrition.protein,  u: 'g',    l: 'Protein' },
                                { k: 'carbs',    v: scan.nutrition.carbs,    u: 'g',    l: 'Carbs' },
                                { k: 'fat',      v: scan.nutrition.fat,      u: 'g',    l: 'Fat' },
                              ].map(c => (
                                <div key={c.k} className="px-3 py-3 text-center">
                                  <p className="tabular text-base font-bold text-[#1E293B] leading-none">
                                    {c.v}<span className="text-[10px] font-medium text-[#94A3B8] ml-0.5">{c.u}</span>
                                  </p>
                                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[#64748B] mt-1.5">{c.l}</p>
                                </div>
                              ))}
                            </div>
                          )}
                          {scan.insight && (
                            <div className="bg-brand-700/[0.03] border border-brand-100 p-3 rounded-lg text-sm text-[#475569] flex gap-2">
                              <Sparkles className="h-4 w-4 text-brand-500 shrink-0 mt-0.5" />
                              <span className="leading-relaxed">{scan.insight}</span>
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
