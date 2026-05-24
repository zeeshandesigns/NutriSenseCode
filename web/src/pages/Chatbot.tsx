import axios from 'axios'
import { useEffect, useRef, useState } from 'react'
import { Send, Sparkles } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

interface Message { role: 'user' | 'assistant'; text: string }

const SUGGESTED = [
  'Is karahi good for muscle gain?',
  'How much protein is in biryani?',
  'What are lighter desi breakfast options?',
  'Is nihari heavy for dinner?',
]

const OPENROUTER_URL   = 'https://openrouter.ai/api/v1/chat/completions'
const OPENROUTER_MODEL = 'qwen/qwen-2.5-72b-instruct'

export default function Chatbot() {
  const { user } = useAuth()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [profile, setProfile] = useState<any>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const apiKey = import.meta.env.VITE_OPENROUTER_KEY

  useEffect(() => {
    if (user) supabase.from('profiles').select('*').eq('id', user.id).single()
      .then(({ data }) => setProfile(data))
  }, [user])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function send(text: string) {
    if (!text.trim() || loading) return

    const updated: Message[] = [...messages, { role: 'user', text }]
    setMessages(updated)
    setInput('')
    setLoading(true)

    // Re-fetch profile each send so goal/restrictions edits in Profile
    // take effect immediately (no page-reload needed)
    let livePrompt = profile
    if (user) {
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (data) {
        livePrompt = data
        setProfile(data)
      }
    }
    const goal = livePrompt?.goal ?? 'curious'
    const restrictions = livePrompt?.restrictions?.join(', ') || 'none'
    const systemPrompt = (
      `You are a friendly South Asian food and nutrition assistant. ` +
      `User's goal: ${goal.replace('_', ' ')}. Restrictions: ${restrictions}. ` +
      `Answer in 2-4 sentences. Focus on Pakistani/desi food. Never be judgmental.`
    )

    try {
      const { data } = await axios.post(
        OPENROUTER_URL,
        {
          model: OPENROUTER_MODEL,
          messages: [
            { role: 'system', content: systemPrompt },
            ...updated.map(m => ({ role: m.role, content: m.text })),
          ],
          max_tokens: 200,
          temperature: 0.7,
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://nutrisense.vercel.app',
            'X-Title': 'NutriSense AI',
          },
          timeout: 15000,
        },
      )
      const reply = data.choices[0].message.content
      setMessages(prev => [...prev, { role: 'assistant', text: reply }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', text: 'Sorry, I could not reach the AI right now.' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-[75vh] bg-white rounded-2xl border shadow-sm overflow-hidden">
      <div className="bg-brand-700 text-white p-4 flex items-center gap-2">
        <Sparkles className="h-5 w-5" />
        <div>
          <h1 className="font-semibold">Ask NutriSense AI</h1>
          <p className="text-xs text-brand-100">Your personal South Asian food assistant</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {!messages.length && (
          <div className="text-center py-6">
            <Sparkles className="h-10 w-10 text-brand-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500 mb-4">Ask me anything about South Asian food and nutrition</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {SUGGESTED.map(q => (
                <button key={q} onClick={() => send(q)}
                  className="bg-gray-100 hover:bg-brand-50 hover:text-brand-700 text-gray-700 px-3 py-1.5 rounded-full text-xs transition-colors">
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
              m.role === 'user'
                ? 'bg-brand-700 text-white rounded-br-sm'
                : 'bg-gray-100 text-gray-800 rounded-bl-sm'
            }`}>
              {m.text}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-4 py-2 text-sm text-gray-400">Thinking…</div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={e => { e.preventDefault(); send(input) }} className="border-t p-3 flex gap-2">
        <input
          value={input} onChange={e => setInput(e.target.value)}
          placeholder="Ask about your food…"
          className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          disabled={loading}
        />
        <button type="submit" disabled={loading || !input.trim()}
          className="bg-brand-700 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50 hover:bg-brand-800 flex items-center gap-1 transition-colors">
          <Send size={16} />
          <span className="hidden sm:inline">Send</span>
        </button>
      </form>
    </div>
  )
}
