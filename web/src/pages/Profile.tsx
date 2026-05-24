import { useEffect, useState } from 'react'
import { User, Brain, AlertCircle, Check, Mail } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

interface Profile {
  goal: 'weight_loss' | 'muscle_gain' | 'curious'
  restrictions: string[]
}

const GOALS = [
  { key: 'weight_loss', icon: '⚖️',  label: 'Lose Weight',  desc: 'Track calories and make mindful choices' },
  { key: 'muscle_gain', icon: '💪',  label: 'Build Muscle', desc: 'Focus on protein-rich South Asian dishes' },
  { key: 'curious',     icon: '🍽️', label: 'Just Curious', desc: 'Understand what you eat, no pressure' },
] as const

const RESTRICTIONS = [
  { key: 'halal',       label: 'Halal' },
  { key: 'vegetarian',  label: 'Vegetarian' },
  { key: 'gluten_free', label: 'Gluten-Free' },
  { key: 'dairy_free',  label: 'Dairy-Free' },
]

// Full production training: top-1 82.65%, top-3 93.65% on held-out 20% val (270 classes)
// Ablation below: all three models trained for 4 epochs on the same split.
const ABLATION = [
  { model: 'EfficientNetB0 (ours)', params: '4.4M',  top1: '71.29%', top3: '87.49%', highlight: true },
  { model: 'MobileNetV2',           params: '2.6M',  top1: '56.04%', top3: '76.99%', highlight: false },
  { model: 'ResNet50',              params: '24.1M', top1: '33.10%', top3: '53.06%', highlight: false },
]

const LIMITATIONS = [
  'Portion size estimation is not supported',
  'Mixed-dish scenes classify the dominant food only',
  'Pakistani dish accuracy is lower than Food-101 classes due to smaller per-class training data',
  'Not intended for medical or clinical use',
  'Nutritional values are approximate standard-serving figures',
]

export default function ProfilePage() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!user) return
    supabase.from('profiles').select('*').eq('id', user.id).single()
      .then(({ data }) => setProfile(data))
  }, [user])

  async function save() {
    if (!profile || !user) return
    setSaving(true)
    await supabase.from('profiles').update({ goal: profile.goal, restrictions: profile.restrictions }).eq('id', user.id)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  function setGoal(goal: Profile['goal']) {
    if (profile) setProfile({ ...profile, goal })
  }

  function toggleRestriction(key: string) {
    if (!profile) return
    const has = profile.restrictions.includes(key)
    setProfile({
      ...profile,
      restrictions: has ? profile.restrictions.filter(r => r !== key) : [...profile.restrictions, key],
    })
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Profile</h1>
        <p className="text-sm text-gray-500">Manage your preferences and learn about the model</p>
      </div>

      {/* Account */}
      <div className="bg-white rounded-xl border shadow-sm p-5">
        <h2 className="flex items-center gap-2 font-semibold text-gray-800 mb-3">
          <User className="h-4 w-4 text-brand-700" /> Account
        </h2>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Mail className="h-4 w-4 text-gray-400" />
          {user?.email}
        </div>
      </div>

      {/* Goal */}
      <div className="bg-white rounded-xl border shadow-sm p-5">
        <h2 className="font-semibold text-gray-800 mb-3">Your Goal</h2>
        <div className="space-y-2">
          {GOALS.map(opt => {
            const selected = profile?.goal === opt.key
            return (
              <button
                key={opt.key} onClick={() => setGoal(opt.key)}
                className={`w-full text-left p-3 rounded-lg border-2 transition-colors ${
                  selected ? 'border-brand-600 bg-brand-50' : 'border-gray-200 hover:border-brand-300'
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl shrink-0">{opt.icon}</span>
                  <div className="flex-1">
                    <div className="font-medium text-gray-800">{opt.label}</div>
                    <div className="text-xs text-gray-500">{opt.desc}</div>
                  </div>
                  {selected && <Check className="h-5 w-5 text-brand-600 shrink-0" />}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Restrictions */}
      <div className="bg-white rounded-xl border shadow-sm p-5">
        <h2 className="font-semibold text-gray-800 mb-3">Dietary Restrictions</h2>
        <div className="flex flex-wrap gap-2">
          {RESTRICTIONS.map(r => {
            const selected = profile?.restrictions.includes(r.key)
            return (
              <button
                key={r.key} onClick={() => toggleRestriction(r.key)}
                className={`px-4 py-1.5 rounded-full text-sm border transition-colors ${
                  selected ? 'bg-brand-700 text-white border-brand-700' : 'bg-white text-gray-700 border-gray-300 hover:border-brand-400'
                }`}
              >
                {r.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={save} disabled={saving || !profile}
          className="bg-brand-700 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-brand-800 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>

      {/* Toast — slides in from bottom-right when save completes */}
      <div
        className={`fixed bottom-6 right-6 z-50 transition-all duration-300 ${
          saved ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0 pointer-events-none'
        }`}
        aria-live="polite"
      >
        <div className="bg-brand-700 text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 text-sm font-medium">
          <Check className="h-5 w-5" />
          Preferences saved
        </div>
      </div>

      {/* About the Model */}
      <div className="bg-white rounded-xl border shadow-sm p-5">
        <h2 className="flex items-center gap-2 font-semibold text-gray-800 mb-4">
          <Brain className="h-4 w-4 text-brand-700" /> About the Model
        </h2>
        <div className="space-y-4 text-sm text-gray-600">
          <div>
            <h3 className="font-semibold text-gray-700 mb-1">Architecture</h3>
            <p>EfficientNetB0 with ImageNet pretraining and two-phase fine-tuning (5 frozen-backbone + 15 fine-tune epochs). Trained on Modal A10G GPU.</p>
          </div>
          <div>
            <h3 className="font-semibold text-gray-700 mb-1">Dataset</h3>
            <p>~100 food classes (~35 South Asian dishes). Sources: Food-101, Khana 2025, DeshiFoodBD, self-scraped Pakistani dishes.</p>
          </div>
          <div>
            <h3 className="font-semibold text-gray-700 mb-2">Ablation Study</h3>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-brand-50 text-left">
                  <th className="p-2 border">Model</th>
                  <th className="p-2 border">Params</th>
                  <th className="p-2 border">Top-1</th>
                  <th className="p-2 border">Top-3</th>
                </tr>
              </thead>
              <tbody>
                {ABLATION.map(r => (
                  <tr key={r.model} className={r.highlight ? 'font-semibold bg-brand-50' : ''}>
                    <td className="p-2 border">{r.model}</td>
                    <td className="p-2 border">{r.params}</td>
                    <td className="p-2 border">{r.top1}</td>
                    <td className="p-2 border">{r.top3}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <h3 className="font-semibold text-gray-700 mb-1">Grad-CAM</h3>
            <p>Highlights the regions the model attends to. Precomputed during evaluation and served as static URLs.</p>
          </div>
          <div className="bg-yellow-50 rounded-lg p-3 border border-yellow-200">
            <h3 className="font-semibold text-yellow-800 flex items-center gap-1.5 mb-2">
              <AlertCircle className="h-4 w-4" /> Limitations
            </h3>
            <ul className="text-xs text-yellow-700 space-y-1 list-disc list-inside">
              {LIMITATIONS.map((l, i) => <li key={i}>{l}</li>)}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
