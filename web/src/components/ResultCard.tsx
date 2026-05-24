import { Flame, Beef, Wheat, Droplets, Sparkles, AlertTriangle, Eye } from 'lucide-react'
import { displayLabel } from '../lib/api'
import type { ScanResult } from '../lib/api'

interface Props { result: ScanResult; imageUrl?: string | null }

const CELLS = [
  { key: 'calories' as const, label: 'Calories', unit: 'kcal', icon: Flame,    tone: 'text-orange-600 bg-orange-50' },
  { key: 'protein'  as const, label: 'Protein',  unit: 'g',    icon: Beef,     tone: 'text-rose-600 bg-rose-50' },
  { key: 'carbs'    as const, label: 'Carbs',    unit: 'g',    icon: Wheat,    tone: 'text-amber-600 bg-amber-50' },
  { key: 'fat'      as const, label: 'Fat',      unit: 'g',    icon: Droplets, tone: 'text-sky-600 bg-sky-50' },
]

export default function ResultCard({ result, imageUrl }: Props) {
  const label = displayLabel(result.top_prediction.label)
  const pct = Math.round(result.top_prediction.confidence * 100)
  const barColor = pct >= 70 ? 'bg-brand-500' : pct >= 50 ? 'bg-amber-400' : 'bg-rose-400'
  const matchTone =
    pct >= 70 ? 'bg-brand-100 text-brand-800 ring-brand-200' :
    pct >= 50 ? 'bg-amber-100 text-amber-800 ring-amber-200' :
                'bg-rose-100 text-rose-800 ring-rose-200'
  const hasNutrition = result.nutrition && typeof result.nutrition.calories === 'number'

  return (
    <div className="bg-white rounded-2xl border border-gray-200/80 shadow-soft overflow-hidden">
      {/* Bento: image left, stats right on md+; stacked on mobile */}
      <div className="grid md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        {/* ── Image pane ────────────────────────────────────────────── */}
        {imageUrl ? (
          <div className="relative bg-gray-100 md:border-r md:border-gray-100">
            <img
              src={imageUrl}
              alt={label}
              className="w-full h-56 md:h-full md:max-h-[420px] object-cover"
            />
          </div>
        ) : (
          <div className="hidden md:flex items-center justify-center bg-gray-50 text-gray-300 text-xs">
            no image
          </div>
        )}

        {/* ── Content pane ──────────────────────────────────────────── */}
        <div className="p-5 md:p-6 flex flex-col gap-4 min-w-0">
          {/* Title + match badge */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-2xl md:text-[1.65rem] font-bold text-gray-900 leading-tight tracking-tight break-words">
                {label}
              </h2>
              <div className="flex items-center gap-2 mt-2">
                <div className="flex-1 max-w-[140px] h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
                </div>
                <span className="tabular text-xs text-gray-500 font-medium">{pct}% confident</span>
              </div>
            </div>
            <span className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold ring-1 ${matchTone}`}>
              <span className="tabular">{pct}%</span> match
            </span>
          </div>

          {/* Low confidence */}
          {result.low_confidence && (
            <div className="bg-amber-50 border border-amber-200/70 rounded-xl px-3 py-2.5 text-sm text-amber-800 flex items-start gap-2">
              <AlertTriangle size={15} className="shrink-0 mt-0.5" />
              <span className="leading-snug">
                <span className="font-semibold">Low confidence.</span>{' '}
                Could also be: {result.top_3.slice(1).map(t => displayLabel(t.label)).join(', ')}
              </span>
            </div>
          )}

          {/* Nutrition 2×2 — more compact than a 1×4 row, fits the right column */}
          {hasNutrition ? (
            <div className="grid grid-cols-2 gap-2.5">
              {CELLS.map(({ key, label, unit, icon: Icon, tone }) => (
                <div
                  key={key}
                  className="rounded-xl border border-gray-100 px-3 py-2.5 flex items-center gap-3 hover:border-gray-200 transition-colors"
                >
                  <div className={`shrink-0 h-9 w-9 rounded-lg flex items-center justify-center ${tone}`}>
                    <Icon size={16} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">{label}</p>
                    <p className="tabular text-lg font-bold text-gray-900 leading-tight">
                      {result.nutrition[key]}
                      <span className="text-[11px] font-medium text-gray-400 ml-0.5">{unit}</span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl bg-gray-50 px-3 py-3 text-sm text-gray-500 text-center">
              Nutrition data not available for this dish.
            </div>
          )}
        </div>
      </div>

      {/* ── AI Insight (full width, subtle brand background) ────────── */}
      {result.insight && (
        <div className="border-t border-gray-100 bg-gradient-to-br from-brand-50/80 to-white p-5">
          <h3 className="flex items-center gap-1.5 font-semibold text-brand-800 mb-1.5 text-[11px] uppercase tracking-wider">
            <Sparkles size={13} /> AI Insight
          </h3>
          <p className="text-sm text-gray-800 leading-relaxed">{result.insight}</p>
        </div>
      )}

      {/* ── Grad-CAM ──────────────────────────────────────────────── */}
      {result.gradcam_sample_url && (
        <div className="border-t border-gray-100 p-5">
          <h3 className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-semibold text-gray-500 mb-3">
            <Eye size={13} /> Model focus area · Grad-CAM
          </h3>
          <img
            src={result.gradcam_sample_url}
            alt="Grad-CAM heatmap"
            className="rounded-lg w-full max-h-56 object-cover border border-gray-100"
          />
        </div>
      )}
    </div>
  )
}
