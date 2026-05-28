import { Image, StyleSheet, TouchableOpacity, View } from 'react-native'
import { Text } from 'react-native-paper'
import { displayLabel } from '../lib/api'

interface Scan { id: string; food_label: string; nutrition: any; image_url: string | null; created_at: string }
interface Props { scan: Scan; onPress: () => void }

export default function HistoryItem({ scan, onPress }: Props) {
  const time = new Date(scan.created_at).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' })
  const cal = scan.nutrition?.calories

  return (
    <TouchableOpacity onPress={onPress} style={styles.row}>
      {scan.image_url
        ? <Image source={{ uri: scan.image_url }} style={styles.thumb} />
        : <View style={[styles.thumb, styles.placeholder]}><Text style={{ fontSize: 20 }}>🍽️</Text></View>
      }
      <View style={styles.info}>
        <Text variant="bodyMedium" numberOfLines={1}>{displayLabel(scan.food_label)}</Text>
        {cal != null && <Text variant="bodySmall" style={{ opacity: 0.6 }}>{cal} kcal</Text>}
      </View>
      <Text variant="bodySmall" style={styles.time}>{time}</Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  row:         { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10,
                 borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e5e7eb' },
  thumb:       { width: 48, height: 48, borderRadius: 8 },
  placeholder: { backgroundColor: '#F0FAF6', justifyContent: 'center', alignItems: 'center' },
  info:        { flex: 1 },
  time:        { opacity: 0.4 },
})
