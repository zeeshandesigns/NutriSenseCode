import { Image, Share, StyleSheet, View } from 'react-native'
import { Button, Card, Divider, Text } from 'react-native-paper'
import { displayLabel, ScanResult } from '../lib/api'
import ConfidenceBar from './ConfidenceBar'
import NutritionGrid from './NutritionGrid'

interface Props { result: ScanResult; imageUri: string; readOnly?: boolean }

export default function ResultCard({ result, imageUri, readOnly }: Props) {
  const label = displayLabel(result.top_prediction.label)
  const pct = Math.round(result.top_prediction.confidence * 100)

  // < 20 % confidence → almost certainly not a dish we know. Render a
  // dedicated state so the user isn't shown misleading nutrition data.
  const probablyNotFood = pct < 20

  async function share() {
    await Share.share({
      message: `I ate ${label} — ${result.nutrition?.calories ?? '?'} kcal. Tracked with NutriSense AI.`,
    })
  }

  if (probablyNotFood) {
    return (
      <Card style={styles.card}>
        {imageUri ? <Image source={{ uri: imageUri }} style={styles.image} resizeMode="cover" /> : null}
        <Card.Content style={styles.content}>
          <Text variant="titleMedium" style={{ color: '#1E293B' }}>
            Hmm, this doesn't look like food we recognise
          </Text>
          <Text variant="bodySmall" style={{ color: '#475569', lineHeight: 19 }}>
            Our model is trained on 270 South Asian and Western dishes. The closest match was{' '}
            <Text style={{ fontWeight: '600' }}>{label}</Text> at only{' '}
            <Text style={{ fontWeight: '600' }}>{pct}%</Text> — too low to trust.
            Try a clearer photo of a single plated dish.
          </Text>
        </Card.Content>
      </Card>
    )
  }

  return (
    <Card style={styles.card}>
      {imageUri ? <Image source={{ uri: imageUri }} style={styles.image} resizeMode="cover" /> : null}
      <Card.Content style={styles.content}>
        <Text variant="headlineSmall" style={{ color: '#0A362A', fontWeight: '700' }}>{label}</Text>
        <ConfidenceBar confidence={result.top_prediction.confidence} />

        <Divider style={styles.divider} />
        <NutritionGrid nutrition={result.nutrition} />

        {result.insight ? (
          <>
            <Divider style={styles.divider} />
            <Text variant="bodyMedium" style={styles.insight}>{result.insight}</Text>
          </>
        ) : null}

        {result.gradcam_sample_url ? (
          <>
            <Divider style={styles.divider} />
            <Text variant="labelSmall" style={{ opacity: 0.55, marginBottom: 4 }}>Model focus area · Grad-CAM</Text>
            <Image source={{ uri: result.gradcam_sample_url }} style={styles.gradcam} resizeMode="cover" />
          </>
        ) : null}
      </Card.Content>

      {!readOnly && (
        <Card.Actions>
          <Button onPress={share}>Share</Button>
        </Card.Actions>
      )}
    </Card>
  )
}

const styles = StyleSheet.create({
  card:    { overflow: 'hidden' },
  image:   { width: '100%', height: 200 },
  content: { paddingTop: 12, gap: 8 },
  divider: { marginVertical: 6 },
  insight: { lineHeight: 22, color: '#475569' },
  gradcam: { width: '100%', height: 180, borderRadius: 8 },
})
