import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useState } from 'react'
import { Dimensions, ScrollView, StyleSheet, View } from 'react-native'
import { Button, Card, Text } from 'react-native-paper'
import { BarChart } from 'react-native-chart-kit'
import { supabase } from '../../../lib/supabase'

const W = Dimensions.get('window').width

export default function InsightsScreen() {
  const router = useRouter()
  const [scans, setScans] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useFocusEffect(useCallback(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const week = new Date(Date.now() - 7 * 86400000).toISOString()
      const { data } = await supabase
        .from('scans').select('*').eq('user_id', user.id)
        .gte('created_at', week).order('created_at')
      setScans(data ?? [])
      setLoading(false)
    }
    load()
  }, []))

  if (!loading && scans.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyIcon}>🍽️</Text>
        <Text variant="titleMedium">No scans this week</Text>
        <Text variant="bodySmall" style={{ opacity: 0.6, textAlign: 'center', marginTop: 4 }}>
          Scan your meals to start seeing patterns
        </Text>
        <Button mode="contained" onPress={() => router.push('/(tabs)/scan')} style={{ marginTop: 16 }}>
          Scan Now
        </Button>
      </View>
    )
  }

  const freq = scans.reduce<Record<string, number>>((acc, s) => {
    acc[s.food_label] = (acc[s.food_label] ?? 0) + 1; return acc
  }, {})
  const top5 = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 5)
  const avgCal = scans.length
    ? Math.round(scans.reduce((s, x) => s + (x.nutrition?.calories ?? 0), 0) / scans.length) : 0

  const showChart = scans.length >= 3

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Card style={styles.card}>
        <Card.Title title="This Week" />
        <Card.Content>
          <Text variant="displaySmall">{scans.length}</Text>
          <Text variant="bodySmall" style={{ opacity: 0.6 }}>meals scanned</Text>
          <Text variant="titleLarge" style={{ marginTop: 8 }}>{avgCal} kcal</Text>
          <Text variant="bodySmall" style={{ opacity: 0.6 }}>average per meal</Text>
        </Card.Content>
      </Card>

      {!showChart && scans.length > 0 && (
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="bodySmall" style={{ opacity: 0.6, textAlign: 'center' }}>
              Scan {3 - scans.length} more meal{3 - scans.length !== 1 ? 's' : ''} to see weekly patterns
            </Text>
          </Card.Content>
        </Card>
      )}

      {showChart && top5.length > 0 && (
        <Card style={styles.card}>
          <Card.Title title="Most Scanned" />
          <Card.Content>
            <BarChart
              data={{
                labels: top5.map(([l]) => l.replace(/_/g, ' ').slice(0, 9)),
                datasets: [{ data: top5.map(([, n]) => n) }],
              }}
              width={W - 64} height={160} yAxisLabel="" yAxisSuffix="x"
              chartConfig={{
                backgroundGradientFrom: '#fff', backgroundGradientTo: '#fff',
                color: () => '#0A362A', labelColor: () => '#475569',
              }}
              style={{ borderRadius: 8 }}
            />
          </Card.Content>
        </Card>
      )}

      <Button mode="contained-tonal" onPress={() => router.push('/chatbot')} style={styles.chatBtn}>
        Ask about your diet
      </Button>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  card:      {},
  chatBtn:   { marginTop: 4 },
  empty:     { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8 },
  emptyIcon: { fontSize: 48 },
})
