import { useEffect, useState } from 'react'
import { Loader2, RotateCcw } from 'lucide-react'
import { predictFile } from '../lib/api'
import type { ScanResult } from '../lib/api'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import UploadZone from '../components/UploadZone'
import ResultCard from '../components/ResultCard'

export default function Today() {
  const { user } = useAuth()
  const [result, setResult] = useState<ScanResult | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [todayCount, setTodayCount] = useState(0)
  const [goal, setGoal] = useState('curious')

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

  useEffect(() => {
    return () => { if (previewUrl) URL.revokeObjectURL(previewUrl) }
  }, [previewUrl])

  async function handleFile(file: File) {
    setError(''); setLoading(true); setResult(null)

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
        await supabase.from('scans').insert({
          user_id: user.id, food_label: data.top_prediction.label,
          confidence: data.top_prediction.confidence, top_3: data.top_3,
          nutrition: data.nutrition, insight: data.insight, image_url,
        })
      }
    } catch (e: any) {
      setError(e?.response?.data?.error ?? 'Could not reach the server. Is it running?')
    } finally {
      setLoading(false)
    }
  }

  function resetScan() {
    setResult(null)
    setError('')
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Scan Food</h1>
          <p className="text-sm text-gray-500">Upload a South Asian dish for instant nutritional insight</p>
        </div>
        {todayCount > 0 && (
          <span className="text-sm text-gray-500 bg-brand-50 px-3 py-1 rounded-full">
            {todayCount} scan{todayCount !== 1 ? 's' : ''} today
          </span>
        )}
      </div>

      {/* Loading state — preview the photo with a spinner overlay */}
      {loading && previewUrl ? (
        <div className="relative w-full max-h-80 overflow-hidden rounded-2xl border bg-black">
          <img src={previewUrl} alt="Analysing…" className="w-full max-h-80 object-cover opacity-60" />
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <Loader2 className="h-10 w-10 text-white animate-spin" />
            <p className="text-sm text-white font-medium">Analysing your food…</p>
          </div>
        </div>
      ) : !result ? (
        <UploadZone onFile={handleFile} loading={loading} />
      ) : null}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
          {error}
        </div>
      )}

      {result && !loading && (
        <>
          <ResultCard result={result} imageUrl={previewUrl} />
          <button
            onClick={resetScan}
            className="w-full bg-brand-50 text-brand-700 border border-brand-200 hover:bg-brand-100 py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-colors"
          >
            <RotateCcw className="h-4 w-4" />
            Scan another dish
          </button>
        </>
      )}
    </div>
  )
}
