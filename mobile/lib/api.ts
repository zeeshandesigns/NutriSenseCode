import axios from 'axios'
import * as ImageManipulator from 'expo-image-manipulator'

const BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:5000'

export interface FoodPrediction { label: string; confidence: number }
export interface Nutrition { calories: number; protein: number; carbs: number; fat: number; note?: string }
export interface ScanResult {
  top_prediction: FoodPrediction
  top_3: FoodPrediction[]
  low_confidence: boolean
  nutrition: Nutrition
  insight: string
  gradcam_sample_url?: string
  processing_time_ms: number
}

export async function predictImage(uri: string, userGoal: string): Promise<ScanResult> {
  const compressed = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 800 } }],
    { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG },
  )
  const form = new FormData()
  form.append('image', { uri: compressed.uri, name: 'photo.jpg', type: 'image/jpeg' } as any)
  form.append('user_goal', userGoal)

  const { data } = await axios.post<ScanResult>(`${BASE}/predict`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 20000,
  })
  return data
}

export function displayLabel(label: string): string {
  return label.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

export async function lookupLabel(
  label: string,
  userGoal: string,
): Promise<{ nutrition: Nutrition; insight: string }> {
  const { data } = await axios.get<{ label: string; nutrition: Nutrition; insight: string }>(
    `${BASE}/lookup`,
    { params: { label, user_goal: userGoal }, timeout: 15000 },
  )
  return { nutrition: data.nutrition, insight: data.insight }
}
