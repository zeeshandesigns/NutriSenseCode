import { Image, StyleSheet, View } from 'react-native'
import { Button, Text } from 'react-native-paper'

interface Props { onCamera: () => void; onGallery: () => void; imageUri: string | null }

export default function ScanButton({ onCamera, onGallery, imageUri }: Props) {
  return (
    <View style={styles.container}>
      {imageUri
        ? <Image source={{ uri: imageUri }} style={styles.preview} resizeMode="cover" />
        : (
          <View style={styles.placeholder}>
            <Text style={styles.icon}>📸</Text>
            <Text variant="bodySmall" style={{ opacity: 0.5 }}>No photo selected</Text>
          </View>
        )
      }
      <View style={styles.buttons}>
        <Button mode="contained" onPress={onCamera} icon="camera" style={styles.btn}>Camera</Button>
        <Button mode="outlined" onPress={onGallery} icon="image"  style={styles.btn}>Gallery</Button>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container:   { gap: 12, alignItems: 'center', width: '100%' },
  preview:     { width: '100%', height: 220, borderRadius: 16 },
  placeholder: { width: '100%', height: 220, borderRadius: 16, backgroundColor: '#F0FAF6',
                 justifyContent: 'center', alignItems: 'center', gap: 8 },
  icon:        { fontSize: 48 },
  buttons:     { flexDirection: 'row', gap: 12 },
  btn:         { flex: 1 },
})
