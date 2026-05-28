import axios from 'axios'
import { useEffect, useRef, useState } from 'react'
import { FlatList, KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native'
import { IconButton, Text, TextInput } from 'react-native-paper'
import { supabase } from '../lib/supabase'

interface Message { role: 'user' | 'assistant'; text: string }

const SUGGESTED = [
  'Is karahi good for muscle gain?',
  'How much protein is in biryani?',
  'What are lighter desi breakfast options?',
  'Is nihari heavy for dinner?',
]

const OPENROUTER_URL   = 'https://openrouter.ai/api/v1/chat/completions'
const OPENROUTER_MODEL = 'qwen/qwen-2.5-72b-instruct'

export default function ChatbotScreen() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [profile, setProfile] = useState<any>(null)
  const listRef = useRef<FlatList>(null)
  const apiKey = process.env.EXPO_PUBLIC_OPENROUTER_KEY

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) supabase.from('profiles').select('*').eq('id', user.id).single()
        .then(({ data }) => setProfile(data))
    })
  }, [])

  async function send(text: string) {
    if (!text.trim() || loading) return

    const newMessages: Message[] = [...messages, { role: 'user', text }]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    const goal = profile?.goal ?? 'curious'
    const restrictions = profile?.restrictions?.join(', ') || 'none'
    const systemPrompt = (
      `You are a friendly South Asian food and nutrition assistant. ` +
      `User's goal: ${goal.replace('_', ' ')}. Dietary restrictions: ${restrictions}. ` +
      `Answer in 2-4 sentences. Focus on Pakistani/desi food. Never be judgmental about food choices.`
    )

    try {
      const { data } = await axios.post(
        OPENROUTER_URL,
        {
          model: OPENROUTER_MODEL,
          messages: [
            { role: 'system', content: systemPrompt },
            ...newMessages.map(m => ({ role: m.role, content: m.text })),
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
      setMessages(prev => [...prev, { role: 'assistant', text: 'Sorry, I could not reach the AI right now. Try again.' }])
    } finally {
      setLoading(false)
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100)
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(_, i) => String(i)}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text variant="bodyMedium" style={{ opacity: 0.5, marginBottom: 12 }}>
              Ask me anything about South Asian food
            </Text>
            {SUGGESTED.map(q => (
              <Text key={q} onPress={() => send(q)} style={styles.suggestion}>{q}</Text>
            ))}
          </View>
        }
        renderItem={({ item }) => (
          <View style={[styles.bubble, item.role === 'user' ? styles.userBubble : styles.aiBubble]}>
            <Text variant="bodyMedium">{item.text}</Text>
          </View>
        )}
      />
      {loading && (
        <View style={[styles.bubble, styles.aiBubble, { margin: 12 }]}>
          <Text variant="bodySmall" style={{ opacity: 0.5 }}>Thinking…</Text>
        </View>
      )}
      <View style={styles.inputRow}>
        <TextInput
          value={input} onChangeText={setInput}
          placeholder="Ask about your food…" style={styles.input}
          onSubmitEditing={() => send(input)} returnKeyType="send"
        />
        <IconButton icon="send" onPress={() => send(input)} disabled={loading || !input.trim()} />
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container:   { flex: 1 },
  list:        { padding: 16, flexGrow: 1 },
  empty:       { alignItems: 'center', marginTop: 32 },
  suggestion:  { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8,
                 paddingHorizontal: 12, paddingVertical: 8, marginBottom: 8,
                 fontSize: 13, color: '#374151', textAlign: 'center' },
  bubble:      { maxWidth: '80%', padding: 12, borderRadius: 12, marginBottom: 8 },
  userBubble:  { alignSelf: 'flex-end', backgroundColor: '#D1FAE5' },
  aiBubble:    { alignSelf: 'flex-start', backgroundColor: '#f3f4f6' },
  inputRow:    { flexDirection: 'row', alignItems: 'center', padding: 8,
                 borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#e5e7eb' },
  input:       { flex: 1, height: 44 },
})
