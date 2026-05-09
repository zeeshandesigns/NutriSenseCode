import { useEffect, useState } from 'react'
import { predictFile } from '../lib/api'
import type { ScanResult } from '../lib/api'
import { supabase } from '../lib/supabase'
import UploadZone from '../components/UploadZone'
import ResultCard from '../components/ResultCard'

export default function Today() {
  const [result, setResult] = useState<ScanResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [todayCount, setTodayCount] = useState(0)
  const [goal, setGoal] = useState('curious')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: p } = await supabase.from('profiles').select('goal').eq('id', user.id).single()
      if (p) setGoal(p.goal)
      const today = new Date(); today.setHours(0, 0, 0, 0)
      const { count } = await supabase.from('scans')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id).gte('created_at', today.toISOString())
      setTodayCount(count ?? 0)
    }
    load()
  }, [result])

  async function handleFile(file: File) {
    setError(''); setLoading(true); setResult(null)
    try {
      const data = await predictFile(file, goal)
      setResult(data)
      const { data: { user } } = await supabase.auth.getUser()
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Scan Food</h1>
        {todayCount > 0 && <span className="text-sm text-gray-400">{todayCount} scan{todayCount !== 1 ? 's' : ''} today</span>}
      </div>
      <UploadZone onFile={handleFile} loading={loading} />
      {error && <p className="text-red-500 text-sm">{error}</p>}
      {result && <ResultCard result={result} />}
    </div>
  )
}
