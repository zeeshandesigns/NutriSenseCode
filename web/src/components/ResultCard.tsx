import { Sparkles, AlertTriangle, Eye, Image as ImageIcon } from 'lucide-react'
import { displayLabel } from '../lib/api'
import type { ScanResult } from '../lib/api'

interface Props {
  result: ScanResult
  imageUrl?: string | null
  /** Called when the user picks an alternative from the top-3 picker. */
  onPickAlternative?: (label: string, confidence: number) => void
}

const CELLS = [
  { key: 'calories' as const, label: 'Calories', unit: 'kcal' },
  { key: 'protein'  as const, label: 'Protein',  unit: 'g' },
  { key: 'carbs'    as const, label: 'Carbs',    unit: 'g' },
  { key: 'fat'      as const, label: 'Fat',      unit: 'g' },
]

export default function ResultCard({ result, imageUrl, onPickAlternative }: Props) {
  const label = displayLabel(result.top_prediction.label)
  const pct = Math.round(result.top_prediction.confidence * 100)
  const barColor = pct >= 70 ? 'bg-brand-500' : pct >= 50 ? 'bg-amber-400' : 'bg-rose-400'
  const matchTone =
    pct >= 70 ? 'bg-brand-50 text-brand-700 ring-brand-200' :
    pct >= 50 ? 'bg-amber-50 text-amber-800 ring-amber-200' :
                'bg-rose-50  text-rose-800  ring-rose-200'
  const hasNutrition = result.nutrition && typeof result.nutrition.calories === 'number'

  // < 20% confidence → almost certainly not food the model knows. Render
  // a dedicated "not food" state instead of misleading nutrition data.
  const probablyNotFood = pct < 20

  return (
    <article className="bg-white rounded-xl border border-[#E2E8F0] shadow-soft overflow-hidden">
      {/* ── Image ─────────────────────────────────────────────────── */}
      {imageUrl ? (
        <div className="bg-[#F8FAF9] border-b border-[#E2E8F0]">
          <img
            src={imageUrl}
            alt={label}
            className="w-full max-h-72 object-cover"
          />
        </div>
      ) : null}

      {/* ── Not-food state (early return-ish) ─────────────────────── */}
      {probablyNotFood ? (
        <div className="px-6 py-8 text-center">
          <ImageIcon className="h-10 w-10 text-[#94A3B8] mx-auto mb-3" />
          <h2 className="text-xl font-bold text-[#1E293B] mb-1.5">
            Hmm, this doesn't look like food we recognise
          </h2>
          <p className="text-sm text-[#475569] max-w-md mx-auto leading-relaxed">
            Our model is trained on 270 South Asian &amp; Western dishes. The closest
            match was{' '}
            <span className="font-medium text-[#1E293B]">{label}</span>{' '}
            at only{' '}
            <span className="tabular font-medium text-[#1E293B]">{pct}%</span> —
            too low to trust. Try a clearer photo of a single plated dish.
          </p>
        </div>
      ) : (
        <>
          {/* ── Header: title + match badge ─────────────────────── */}
          <header className="px-6 pt-5 pb-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-3xl font-extrabold text-brand-700 tracking-tight leading-tight break-words">
                  {label}
                </h2>
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex-1 max-w-[160px] h-1.5 bg-[#E2E8F0] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${barColor}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="tabular text-xs text-[#64748B] font-medium">
                    {pct}% confident
                  </span>
                </div>
              </div>
              <span className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold ring-1 ${matchTone}`}>
                <span className="tabular">{pct}%</span> match
              </span>
            </div>
          </header>

          {/* ── Top-3 picker (low confidence) ─────────────────── */}
          {result.low_confidence && (
            <div className="mx-6 mb-4 bg-amber-50/70 border border-amber-200/70 rounded-xl p-3.5">
              <div className="flex items-start gap-2 mb-2.5">
                <AlertTriangle size={15} className="text-amber-700 shrink-0 mt-0.5" />
                <p className="text-sm text-amber-800 leading-snug">
                  <span className="font-semibold">Not sure about this one.</span>{' '}
                  {onPickAlternative
                    ? 'Pick the right answer below — we use this to improve the model.'
                    : `Could also be: ${result.top_3.slice(1).map(t => displayLabel(t.label)).join(', ')}`}
                </p>
              </div>
              {onPickAlternative && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {result.top_3.map((alt, i) => (
                    <button
                      key={alt.label}
                      onClick={() => onPickAlternative(alt.label, alt.confidence)}
                      className={`text-left px-3 py-2 rounded-lg border transition-colors lift ${
                        i === 0
                          ? 'border-amber-300 bg-white hover:bg-amber-50'
                          : 'border-[#E2E8F0] bg-white hover:bg-brand-50 hover:border-brand-200'
                      }`}
                    >
                      <p className="text-sm font-semibold text-[#1E293B] truncate">{displayLabel(alt.label)}</p>
                      <p className="tabular text-xs text-[#64748B]">{Math.round(alt.confidence * 100)}%</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Whoop-style macro grid: 4 cols + vertical dividers ── */}
          {hasNutrition ? (
            <div className="grid grid-cols-4 divide-x divide-[#E2E8F0] border-t border-[#E2E8F0]">
              {CELLS.map(({ key, label, unit }) => (
                <div key={key} className="px-4 py-5 text-center">
                  <p className="tabular text-2xl font-bold text-[#1E293B] leading-none">
                    {result.nutrition[key]}
                    <span className="text-sm font-medium text-[#94A3B8] ml-0.5">{unit}</span>
                  </p>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B] mt-2">
                    {label}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="border-t border-[#E2E8F0] px-6 py-5 text-sm text-[#64748B] text-center">
              Nutrition data not available for this dish.
            </div>
          )}

          {/* ── AI Insight ──────────────────────────────────────── */}
          {result.insight && (
            <div className="border-t border-[#E2E8F0] bg-brand-700/[0.03] px-6 py-5">
              <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-brand-700 mb-2">
                <Sparkles size={13} className="text-brand-500" /> AI Insight
              </h3>
              <p className="text-sm leading-relaxed text-[#475569]">{result.insight}</p>
            </div>
          )}

          {/* ── Grad-CAM ─────────────────────────────────────── */}
          {result.gradcam_sample_url && (
            <div className="border-t border-[#E2E8F0] px-6 py-5">
              <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#64748B] mb-3">
                <Eye size={13} /> Model focus area · Grad-CAM
              </h3>
              <img
                src={result.gradcam_sample_url}
                alt="Grad-CAM heatmap"
                className="rounded-lg w-full max-h-56 object-cover border border-[#E2E8F0]"
              />
            </div>
          )}
        </>
      )}
    </article>
  )
}
