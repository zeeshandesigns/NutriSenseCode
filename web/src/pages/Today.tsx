import { useEffect, useState } from 'react'
import { Camera, Sparkles } from 'lucide-react'
import { predictFile } from '../lib/api'
import type { ScanResult } from '../lib/api'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import UploadZone from '../components/UploadZone'
import ResultCard from '../components/ResultCard'

export default function Today() {
  const { user } = useAuth()
  const [result, setResult] = useState<ScanResult | null>(null)
  const [scanId, setScanId] = useState<string | null>(null)  // for user-correction updates
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [todayCount, setTodayCount] = useState(0)
  const [goal, setGoal] = useState('curious')
  const [correctionToast, setCorrectionToast] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    async function load() {
      const { data: p } = await supabase.from('profiles').select('goal').eq('id', user!.id).single()
      if (p) setGoal(p.goal)
      const today = new Date(); today.setHours(0, 0, 0, 0)
      const { count } = await supabase.from('scans')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user!.id).gte('created_at', today.toISOString())
      setTodayCount(count ?? 0)
    }
    load()
  }, [user, result])

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl) }, [previewUrl])

  async function handleFile(file: File) {
    setError(''); setLoading(true); setResult(null); setScanId(null); setCorrectionToast(null)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(URL.createObjectURL(file))

    try {
      const data = await predictFile(file, goal)
      setResult(data)
      if (user) {
        let image_url: string | null = null
        try {
          const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
          const fileName = `${user.id}/${Date.now()}.${ext}`
          const { error: upErr } = await supabase.storage
            .from('scan-images').upload(fileName, file, { contentType: file.type })
          if (!upErr) {
            image_url = supabase.storage.from('scan-images').getPublicUrl(fileName).data.publicUrl
          }
        } catch (_) { /* non-fatal */ }
        const { data: row } = await supabase.from('scans').insert({
          user_id: user.id, food_label: data.top_prediction.label,
          confidence: data.top_prediction.confidence, top_3: data.top_3,
          nutrition: data.nutrition, insight: data.insight, image_url,
        }).select('id').single()
        if (row) setScanId(row.id)
      }
    } catch (e: any) {
      setError(e?.response?.data?.error ?? 'Could not reach the server. Is it running?')
    } finally {
      setLoading(false)
    }
  }

  // When user clicks an alt in the low-confidence picker — log the
  // correction so the training pipeline can use these as gold labels
  // for future retraining.
  async function handlePickAlternative(label: string, confidence: number) {
    if (!result || !scanId || !user) return
    // Reorder top_3 so picked item is first
    const picked = result.top_3.find(t => t.label === label) ?? { label, confidence }
    const reordered = [picked, ...result.top_3.filter(t => t.label !== label)]
    setResult({ ...result, top_prediction: picked, top_3: reordered, low_confidence: false })

    await supabase.from('scans').update({
      food_label: label,
      confidence,
      top_3: reordered,
      user_corrected: true,
      original_top1: result.top_prediction.label,
    }).eq('id', scanId)

    setCorrectionToast(`Thanks — we'll use "${label}" to improve the model.`)
    setTimeout(() => setCorrectionToast(null), 4000)
  }

  // ── Render ──────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* ── Split-layout hero: text hook left, upload zone right ── */}
      <section className="grid md:grid-cols-[1fr_minmax(0,1.1fr)] gap-6 md:gap-8 items-stretch">
        <div className="flex flex-col justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-500 mb-2">
              <Sparkles size={11} className="inline -mt-0.5 mr-1" /> NutriSense AI
            </p>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-brand-700 leading-tight">
              Know what's on your plate.
            </h1>
            <p className="text-sm leading-relaxed text-[#475569] mt-3 max-w-md">
              Upload a photo of any Pakistani, South Asian, or Western dish.
              Our CNN identifies it from 270 classes and shows nutrition + a
              personalised insight in under 2 seconds.
            </p>
          </div>
          {todayCount > 0 && (
            <div className="inline-flex items-center self-start gap-2 text-xs text-brand-700 bg-brand-50 border border-brand-100 px-3 py-1.5 rounded-full">
              <Camera size={13} />
              <span className="tabular font-semibold">{todayCount}</span> scan{todayCount !== 1 ? 's' : ''} today
            </div>
          )}
        </div>

        <UploadZone onFile={handleFile} loading={loading} />
      </section>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 rounded-xl text-sm">
          {error}
        </div>
      )}

      {correctionToast && (
        <div className="bg-brand-50 border border-brand-200 text-brand-800 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
          <Sparkles size={14} className="text-brand-500" /> {correctionToast}
        </div>
      )}

      {result && (
        <ResultCard
          result={result}
          imageUrl={previewUrl}
          onPickAlternative={handlePickAlternative}
        />
      )}
    </div>
  )
}
