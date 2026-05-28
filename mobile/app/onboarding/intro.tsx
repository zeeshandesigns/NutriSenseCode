import { useRouter } from 'expo-router'
import { StyleSheet, View } from 'react-native'
import { Button, Text } from 'react-native-paper'
import { supabase } from '../../lib/supabase'

const STEPS = [
  { icon: '📸', title: 'Snap your food', desc: 'Point the camera at any South Asian dish' },
  { icon: '🧠', title: 'AI identifies it', desc: 'Our CNN recognises 100 Pakistani & South Asian dishes' },
  { icon: '📋', title: 'Understand it', desc: 'Get nutrition facts and a plain-language insight instantly' },
]

export default function IntroScreen() {
  const router = useRouter()

  async function start() {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) await supabase.from('profiles').update({ onboarding_complete: true }).eq('id', user.id)
    router.replace('/(tabs)/scan')
  }

  return (
    <View style={styles.container}>
      <Text variant="headlineSmall" style={styles.heading}>How it works</Text>
      {STEPS.map((s, i) => (
        <View key={i} style={styles.step}>
          <Text style={styles.icon}>{s.icon}</Text>
          <View style={{ flex: 1 }}>
            <Text variant="titleMedium">{s.title}</Text>
            <Text variant="bodySmall" style={{ opacity: 0.65 }}>{s.desc}</Text>
          </View>
        </View>
      ))}
      <Button mode="contained" onPress={start} style={styles.btn}>
        Scan Your First Meal
      </Button>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center', gap: 16 },
  heading:   { textAlign: 'center', marginBottom: 4 },
  step:      { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 14,
               backgroundColor: '#F0FAF6', borderRadius: 12 },
  icon:      { fontSize: 30 },
  btn:       { marginTop: 8 },
})
