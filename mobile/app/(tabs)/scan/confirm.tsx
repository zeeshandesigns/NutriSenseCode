import { useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { Image, StyleSheet, View } from 'react-native'
import { ActivityIndicator, Button, Card, Text } from 'react-native-paper'
import { displayLabel, FoodPrediction, lookupLabel, ScanResult } from '../../../lib/api'
import { supabase } from '../../../lib/supabase'

export default function ConfirmScreen() {
  const { uri, result: resultJson } = useLocalSearchParams<{ uri: string; result: string }>()
  const router = useRouter()
  const result: ScanResult = JSON.parse(resultJson)
  const [loading, setLoading] = useState(false)

  async function select(choice: FoodPrediction) {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: profile } = await supabase
        .from('profiles').select('goal').eq('id', user?.id ?? '').maybeSingle()
      const goal = (profile?.goal as string) ?? 'curious'

      // Fetch fresh nutrition + insight for the user's chosen label
      const fresh = await lookupLabel(choice.label, goal)
      const confirmed: ScanResult = {
        ...result,
        top_prediction: choice,
        low_confidence: false,
        nutrition: fresh.nutrition,
        insight: fresh.insight,
      }
      router.replace({
        pathname: '/(tabs)/scan/result',
        params: { uri, result: JSON.stringify(confirmed) },
      })
    } catch (_) {
      // Network failure — fall back to the original nutrition/insight so the
      // user at least sees their chosen label, even if the data is stale.
      const confirmed: ScanResult = { ...result, top_prediction: choice, low_confidence: false }
      router.replace({
        pathname: '/(tabs)/scan/result',
        params: { uri, result: JSON.stringify(confirmed) },
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={styles.container}>
      {uri ? <Image source={{ uri }} style={styles.image} resizeMode="cover" /> : null}
      <Text variant="titleMedium" style={styles.heading}>We're not sure — which one is it?</Text>
      {result.top_3.map(choice => (
        <Card key={choice.label} style={styles.card} onPress={() => !loading && select(choice)}>
          <Card.Title
            title={displayLabel(choice.label)}
            subtitle={`${Math.round(choice.confidence * 100)}% confidence`}
          />
        </Card>
      ))}
      {loading && (
        <View style={styles.overlay}>
          <ActivityIndicator size="large" />
          <Text style={{ marginTop: 8, opacity: 0.7 }}>Looking up nutrition…</Text>
        </View>
      )}
      <Button mode="text" onPress={() => router.back()} disabled={loading}>
        None of these — go back
      </Button>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 10 },
  image:     { width: '100%', height: 180, borderRadius: 12 },
  heading:   { textAlign: 'center' },
  card:      {},
  overlay:   {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.85)',
    justifyContent: 'center', alignItems: 'center',
  },
})
