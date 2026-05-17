import { Flame, Beef, Wheat, Droplets, Activity, AlertTriangle } from 'lucide-react'
import { displayLabel } from '../lib/api'
import type { ScanResult } from '../lib/api'

interface Props { result: ScanResult; imageUrl?: string | null }

const CELLS = [
  { key: 'calories' as const, label: 'Calories', unit: 'kcal', icon: Flame,    bg: 'bg-orange-50' },
  { key: 'protein'  as const, label: 'Protein',  unit: 'g',    icon: Beef,     bg: 'bg-red-50' },
  { key: 'carbs'    as const, label: 'Carbs',    unit: 'g',    icon: Wheat,    bg: 'bg-blue-50' },
  { key: 'fat'      as const, label: 'Fat',      unit: 'g',    icon: Droplets, bg: 'bg-yellow-50' },
]

export default function ResultCard({ result, imageUrl }: Props) {
  const label = displayLabel(result.top_prediction.label)
  const pct = Math.round(result.top_prediction.confidence * 100)
  const barColor = pct >= 70 ? 'bg-green-500' : pct >= 50 ? 'bg-amber-400' : 'bg-red-400'
  const hasNutrition = result.nutrition && typeof result.nutrition.calories === 'number'

  return (
    <div className="bg-white rounded-2xl border shadow-sm p-6 space-y-4">
      {imageUrl && (
        <img src={imageUrl} alt={label} className="rounded-xl w-full max-h-72 object-cover" />
      )}

      <div className="flex justify-between items-start gap-4">
        <h2 className="text-2xl font-bold text-gray-900">{label}</h2>
        <span className="shrink-0 px-3 py-1 bg-brand-100 text-brand-700 rounded-full text-sm font-medium">
          {pct}% match
        </span>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
        </div>
        <span className="text-xs text-gray-500">{pct}% confident</span>
      </div>

      {result.low_confidence && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-700 flex items-start gap-2">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <span>
            Low confidence — alternatives: {result.top_3.slice(1).map(t => displayLabel(t.label)).join(', ')}
          </span>
        </div>
      )}

      {hasNutrition ? (
        <div className="grid grid-cols-4 gap-3">
          {CELLS.map(({ key, label, unit, icon: Icon, bg }) => (
            <div key={key} className={`${bg} rounded-xl p-3 text-center`}>
              <Icon className="h-4 w-4 text-gray-600 mx-auto mb-1" />
              <p className="text-xl font-bold text-gray-800">
                {result.nutrition[key]}<span className="text-xs font-normal text-gray-500">{unit}</span>
              </p>
              <p className="text-xs text-gray-500">{label}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-400">Nutrition data not available for this dish</p>
      )}

      {result.insight && (
        <div className="bg-brand-50 p-4 rounded-lg border-l-4 border-brand-500">
          <h3 className="flex items-center gap-2 font-semibold text-brand-800 mb-1 text-sm">
            <Activity size={16} /> AI Insight
          </h3>
          <p className="text-sm text-gray-700 leading-relaxed">{result.insight}</p>
        </div>
      )}

      {result.gradcam_sample_url && (
        <div className="border-t pt-4">
          <p className="text-xs text-gray-500 mb-2">Model focus area (Grad-CAM)</p>
          <img src={result.gradcam_sample_url} alt="Grad-CAM" className="rounded-lg w-full max-h-48 object-cover" />
        </div>
      )}
    </div>
  )
}
