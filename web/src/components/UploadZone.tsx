import { useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, Loader2 } from 'lucide-react'

interface Props { onFile: (f: File) => void; loading: boolean }

export default function UploadZone({ onFile, loading }: Props) {
  const onDrop = useCallback((files: File[]) => { if (files[0]) onFile(files[0]) }, [onFile])
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { 'image/*': [] }, maxFiles: 1, disabled: loading,
  })

  return (
    <div {...getRootProps()} className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-colors bg-white ${
      loading ? 'opacity-60 cursor-not-allowed border-gray-300'
      : isDragActive ? 'border-brand-500 bg-brand-50'
      : 'border-gray-300 hover:border-brand-400 hover:bg-brand-50/30'
    }`}>
      <input {...getInputProps()} />
      {loading ? (
        <Loader2 className="h-12 w-12 text-brand-600 mx-auto mb-3 animate-spin" />
      ) : (
        <Upload className="h-12 w-12 text-brand-500 mx-auto mb-3" />
      )}
      <p className="text-base font-semibold text-gray-700">
        {loading ? 'Analysing your food…'
          : isDragActive ? 'Drop the photo here'
          : 'Drag a food photo here, or click to select'}
      </p>
      <p className="text-xs text-gray-400 mt-1">JPG or PNG · max 5MB</p>
    </div>
  )
}
