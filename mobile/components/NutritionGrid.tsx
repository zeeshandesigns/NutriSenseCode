import { StyleSheet, View } from 'react-native'
import { Text } from 'react-native-paper'
import { Nutrition } from '../lib/api'

interface Props { nutrition: Nutrition | null }

const CELLS = [
  { key: 'calories' as const, label: 'Calories', unit: 'kcal' },
  { key: 'protein'  as const, label: 'Protein',  unit: 'g' },
  { key: 'carbs'    as const, label: 'Carbs',    unit: 'g' },
  { key: 'fat'      as const, label: 'Fat',       unit: 'g' },
]

export default function NutritionGrid({ nutrition }: Props) {
  if (!nutrition || typeof nutrition.calories !== 'number') {
    return (
      <View style={styles.unavailable}>
        <Text variant="bodySmall" style={{ opacity: 0.5 }}>Nutrition data not available for this dish</Text>
      </View>
    )
  }
  return (
    <View style={styles.grid}>
      {CELLS.map(({ key, label, unit }) => (
        <View key={key} style={styles.cell}>
          <Text variant="titleMedium">{nutrition[key]}<Text variant="labelSmall">{unit}</Text></Text>
          <Text variant="labelSmall" style={{ opacity: 0.6 }}>{label}</Text>
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  grid:        { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cell:        { flex: 1, minWidth: '45%', backgroundColor: '#F0FAF6', borderRadius: 8, padding: 12, alignItems: 'center' },
  unavailable: { padding: 12, backgroundColor: '#f9fafb', borderRadius: 8, alignItems: 'center' },
})
