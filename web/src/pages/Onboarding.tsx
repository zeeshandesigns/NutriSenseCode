import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Camera, Brain, ClipboardList, Check, ChevronRight, ChevronLeft, UtensilsCrossed } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

type Goal = 'weight_loss' | 'muscle_gain' | 'curious'

const GOALS: { key: Goal; icon: string; label: string; desc: string }[] = [
  { key: 'weight_loss', icon: '⚖️',  label: 'Lose Weight',  desc: 'Track calories and make mindful food choices' },
  { key: 'muscle_gain', icon: '💪',  label: 'Build Muscle', desc: 'Focus on protein-rich South Asian dishes' },
  { key: 'curious',     icon: '🍽️', label: 'Just Curious', desc: 'Understand what you eat, no pressure' },
]

const RESTRICTIONS = [
  { key: 'halal',       label: 'Halal' },
  { key: 'vegetarian',  label: 'Vegetarian' },
  { key: 'gluten_free', label: 'Gluten-Free' },
  { key: 'dairy_free',  label: 'Dairy-Free' },
]

const STEPS = [
  { icon: Camera,        title: 'Snap your food',  desc: 'Point the camera at any South Asian dish' },
  { icon: Brain,         title: 'AI identifies it', desc: 'Our CNN recognises 100+ Pakistani & South Asian dishes' },
  { icon: ClipboardList, title: 'Understand it',    desc: 'Get nutrition facts and a plain-language insight instantly' },
]

export default function Onboarding() {
  const navigate = useNavigate()
  const { user, refreshProfile } = useAuth()
  const [step, setStep] = useState<0 | 1 | 2>(0)
  const [goal, setGoal] = useState<Goal>('curious')
  const [restrictions, setRestrictions] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  function toggleRestriction(key: string) {
    setRestrictions(prev => prev.includes(key) ? prev.filter(r => r !== key) : [...prev, key])
  }

  async function pickGoal(g: Goal) {
    setGoal(g)
    if (!user) { setStep(1); return }
    await supabase.from('profiles').update({ goal: g }).eq('id', user.id)
    setStep(1)
  }

  async function saveRestrictionsAndContinue() {
    if (user) {
      await supabase.from('profiles').update({ restrictions }).eq('id', user.id)
    }
    setStep(2)
  }

  async function finish() {
    if (!user) return
    setSaving(true)
    await supabase.from('profiles').update({ onboarding_complete: true }).eq('id', user.id)
    await refreshProfile()
    setSaving(false)
    navigate('/dashboard')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 to-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-lg">
        <div className="flex items-center gap-2 mb-2">
          <UtensilsCrossed className="h-6 w-6 text-brand-700" />
          <span className="font-bold text-brand-700">NutriSense AI</span>
        </div>

        {/* progress bar */}
        <div className="flex gap-1.5 mb-6 mt-3">
          {[0, 1, 2].map(i => (
            <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= step ? 'bg-brand-600' : 'bg-gray-200'}`} />
          ))}
        </div>

        {step === 0 && (
          <>
            <h1 className="text-2xl font-bold mb-1">What's your goal?</h1>
            <p className="text-sm text-gray-500 mb-6">We'll personalise your food insights</p>
            <div className="space-y-3">
              {GOALS.map(g => (
                <button
                  key={g.key} onClick={() => pickGoal(g.key)}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-colors ${
                    goal === g.key ? 'border-brand-600 bg-brand-50' : 'border-gray-200 hover:border-brand-300'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-3xl shrink-0">{g.icon}</span>
                    <div className="flex-1">
                      <div className="font-medium text-gray-800">{g.label}</div>
                      <div className="text-xs text-gray-500">{g.desc}</div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-gray-400 shrink-0 self-center" />
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <h1 className="text-2xl font-bold mb-1">Any dietary restrictions?</h1>
            <p className="text-sm text-gray-500 mb-6">Select all that apply — or skip for now</p>
            <div className="flex flex-wrap gap-2 mb-8">
              {RESTRICTIONS.map(r => {
                const selected = restrictions.includes(r.key)
                return (
                  <button
                    key={r.key} onClick={() => toggleRestriction(r.key)}
                    className={`px-4 py-2 rounded-full text-sm border transition-colors ${
                      selected
                        ? 'bg-brand-700 text-white border-brand-700'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-brand-400'
                    }`}
                  >
                    {selected && <Check className="inline h-3 w-3 mr-1 -mt-0.5" />}
                    {r.label}
                  </button>
                )
              })}
            </div>
            <div className="flex justify-between gap-3">
              <button onClick={() => setStep(0)}
                className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors">
                <ChevronLeft className="h-4 w-4" /> Back
              </button>
              <button onClick={saveRestrictionsAndContinue}
                className="flex items-center gap-1 bg-brand-700 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-brand-800 transition-colors">
                Continue <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <button onClick={saveRestrictionsAndContinue}
              className="block mx-auto mt-3 text-xs text-gray-400 hover:text-gray-600 transition-colors">
              Skip for now
            </button>
          </>
        )}

        {step === 2 && (
          <>
            <h1 className="text-2xl font-bold mb-1">How it works</h1>
            <p className="text-sm text-gray-500 mb-6">Three steps from photo to understanding</p>
            <div className="space-y-3 mb-8">
              {STEPS.map((s, i) => (
                <div key={i} className="flex items-center gap-3 bg-brand-50 rounded-xl p-3">
                  <s.icon className="h-8 w-8 text-brand-700 shrink-0" />
                  <div className="flex-1">
                    <div className="font-medium text-gray-800">{s.title}</div>
                    <div className="text-xs text-gray-500">{s.desc}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-between gap-3">
              <button onClick={() => setStep(1)}
                className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors">
                <ChevronLeft className="h-4 w-4" /> Back
              </button>
              <button onClick={finish} disabled={saving}
                className="flex items-center gap-1 bg-brand-700 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-brand-800 disabled:opacity-50 transition-colors">
                {saving ? 'Saving…' : <>Scan Your First Meal <ChevronRight className="h-4 w-4" /></>}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
