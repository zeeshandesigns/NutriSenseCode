import { ScrollView, StyleSheet, View } from 'react-native'
import { Card, List, Text } from 'react-native-paper'

// Full production training: top-1 82.65%, top-3 93.65% on held-out 20% val (270 classes)
// Ablation below: all three models trained for 4 epochs on the same split.
const ABLATION = [
  { model: 'EfficientNetB0 (ours)', params: '4.4M',  top1: '71.29%', top3: '87.49%' },
  { model: 'MobileNetV2',           params: '2.6M',  top1: '56.04%', top3: '76.99%' },
  { model: 'ResNet50',              params: '24.1M', top1: '33.10%', top3: '53.06%' },
]

const LIMITATIONS = [
  'Portion size estimation is not supported',
  'Mixed-dish scenes classify the dominant food only',
  'Pakistani dish accuracy is lower than Food-101 due to smaller per-class training data',
  'Not intended for medical or clinical use',
  'Nutritional values are approximate standard-serving figures',
]

export default function AboutModelScreen() {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Card>
        <Card.Title title="Architecture" />
        <Card.Content>
          <List.Item title="Model" description="EfficientNetB0 — ImageNet pretrained, two-phase fine-tuning" />
          <List.Item title="Classes" description="~100 food classes, ~35 South Asian dishes" />
          <List.Item title="Dataset" description="Food-101 + Khana 2025 (131K images) + DeshiFoodBD + self-scraped" />
          <List.Item title="Training" description="Kaggle P100/T4 GPU — free tier" />
        </Card.Content>
      </Card>

      <Card>
        <Card.Title title="Ablation Study" subtitle="Same dataset, same hyperparameters" />
        <Card.Content>
          {ABLATION.map(r => (
            <View key={r.model} style={styles.row}>
              <Text style={[styles.col, r.model.includes('ours') && styles.bold]}>{r.model}</Text>
              <Text style={styles.col}>{r.params}</Text>
              <Text style={styles.col}>{r.top1}</Text>
              <Text style={styles.col}>{r.top3}</Text>
            </View>
          ))}
        </Card.Content>
      </Card>

      <Card>
        <Card.Title title="Limitations" />
        <Card.Content>
          {LIMITATIONS.map((l, i) => (
            <List.Item key={i} title={l} titleNumberOfLines={3} titleStyle={{ fontSize: 13 }} />
          ))}
        </Card.Content>
      </Card>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  row:       { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  col:       { flex: 1, fontSize: 12 },
  bold:      { fontWeight: '700' },
})
