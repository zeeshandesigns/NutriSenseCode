import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { Button, Card, Chip, Divider, HelperText, Text, useTheme } from 'react-native-paper'
import { supabase } from '../../../lib/supabase'

interface Profile {
  goal: 'weight_loss' | 'muscle_gain' | 'curious'
  restrictions: string[]
}

const GOALS = [
  { key: 'weight_loss' as const, icon: '⚖️',  label: 'Lose Weight',  desc: 'Track calories and make mindful choices' },
  { key: 'muscle_gain' as const, icon: '💪',  label: 'Build Muscle', desc: 'Focus on protein-rich South Asian dishes' },
  { key: 'curious'     as const, icon: '🍽️', label: 'Just Curious', desc: 'Understand what you eat, no pressure' },
]

const RESTRICTIONS = [
  { key: 'halal',       label: 'Halal' },
  { key: 'vegetarian',  label: 'Vegetarian' },
  { key: 'gluten_free', label: 'Gluten-Free' },
  { key: 'dairy_free',  label: 'Dairy-Free' },
]

export default function ProfileScreen() {
  const router = useRouter()
  const { colors } = useTheme()
  const [email, setEmail] = useState('')
  const [profile, setProfile] = useState<Profile | null>(null)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState(0)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setEmail(user.email ?? '')
      const { data } = await supabase.from('profiles').select('goal, restrictions').eq('id', user.id).maybeSingle()
      setProfile(data ?? { goal: 'curious', restrictions: [] })
    }
    load()
  }, [])

  function pickGoal(goal: Profile['goal']) {
    if (profile) setProfile({ ...profile, goal })
  }

  function toggleRestriction(key: string) {
    if (!profile) return
    const has = profile.restrictions.includes(key)
    setProfile({
      ...profile,
      restrictions: has ? profile.restrictions.filter(r => r !== key) : [...profile.restrictions, key],
    })
  }

  async function save() {
    if (!profile) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('profiles')
        .update({ goal: profile.goal, restrictions: profile.restrictions })
        .eq('id', user.id)
    }
    setSaving(false)
    setSavedAt(Date.now())
  }

  if (!profile) return null

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Card>
        <Card.Content>
          <Text variant="labelSmall" style={{ opacity: 0.5 }}>Signed in as</Text>
          <Text variant="bodyMedium">{email}</Text>
        </Card.Content>
      </Card>

      <Card>
        <Card.Title title="Your goal" />
        <Card.Content style={{ gap: 8 }}>
          {GOALS.map(g => {
            const selected = profile.goal === g.key
            return (
              <Card key={g.key} mode={selected ? 'elevated' : 'outlined'}
                style={[styles.goalCard, selected && { borderColor: colors.primary, borderWidth: 2 }]}
                onPress={() => pickGoal(g.key)}>
                <Card.Title
                  title={`${g.icon}  ${g.label}`}
                  subtitle={g.desc}
                  titleVariant="titleSmall"
                  subtitleVariant="bodySmall"
                />
              </Card>
            )
          })}
        </Card.Content>
      </Card>

      <Card>
        <Card.Title title="Dietary restrictions" />
        <Card.Content>
          <View style={styles.chips}>
            {RESTRICTIONS.map(r => (
              <Chip
                key={r.key}
                selected={profile.restrictions.includes(r.key)}
                onPress={() => toggleRestriction(r.key)}
                showSelectedCheck
              >
                {r.label}
              </Chip>
            ))}
          </View>
        </Card.Content>
      </Card>

      <View>
        <Button mode="contained" onPress={save} loading={saving} disabled={saving}>
          Save Changes
        </Button>
        <HelperText type="info" visible={Date.now() - savedAt < 2500} style={styles.savedText}>
          ✓ Saved
        </HelperText>
      </View>

      <Divider style={styles.divider} />

      <Button mode="contained-tonal" onPress={() => router.push('/(tabs)/profile/model')}>
        About the Model
      </Button>

      <Button mode="outlined" onPress={() => supabase.auth.signOut()}>
        Sign Out
      </Button>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  goalCard:  {},
  chips:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  divider:   { marginVertical: 8 },
  savedText: { textAlign: 'center' },
})
