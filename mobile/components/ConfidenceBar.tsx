import { StyleSheet, View } from 'react-native'
import { Text } from 'react-native-paper'

interface Props { confidence: number }

export default function ConfidenceBar({ confidence }: Props) {
  const pct = Math.round(confidence * 100)
  const color = pct >= 70 ? '#10B981' : pct >= 50 ? '#F59E0B' : '#EF4444'
  return (
    <View style={styles.container}>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
      <Text variant="labelSmall" style={[styles.label, { color }]}>{pct}% confident</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { gap: 3 },
  track:     { height: 6, backgroundColor: '#e5e7eb', borderRadius: 3, overflow: 'hidden' },
  fill:      { height: '100%', borderRadius: 3 },
  label:     { alignSelf: 'flex-end' },
})
