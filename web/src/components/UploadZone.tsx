import { useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, Loader2, Camera } from 'lucide-react'

interface Props { onFile: (f: File) => void; loading: boolean }

export default function UploadZone({ onFile, loading }: Props) {
  const onDrop = useCallback((files: File[]) => { if (files[0]) onFile(files[0]) }, [onFile])
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { 'image/*': [] }, maxFiles: 1, disabled: loading,
  })

  return (
    <div
      {...getRootProps()}
      className={`relative rounded-2xl border-2 border-dashed bg-white transition-colors min-h-[260px] flex flex-col items-center justify-center px-8 py-10 text-center cursor-pointer ${
        loading
          ? 'opacity-60 cursor-not-allowed border-[#E2E8F0]'
          : isDragActive
            ? 'border-brand-500 bg-brand-50/40'
            : 'border-brand-700/20 hover:bg-brand-700/5 hover:border-brand-700/40'
      }`}
    >
      <input {...getInputProps()} />

      {loading ? (
        <>
          <Loader2 className="h-10 w-10 text-brand-700 mb-3 animate-spin" strokeWidth={2.25} />
          <p className="text-base font-semibold text-[#1E293B]">Analysing your meal…</p>
          <p className="text-xs text-[#64748B] mt-1">Running EfficientNetB0 + generating insight</p>
        </>
      ) : (
        <>
          <div className="h-14 w-14 rounded-full bg-brand-700/10 flex items-center justify-center mb-4">
            <Upload className="h-6 w-6 text-brand-700" strokeWidth={2.25} />
          </div>
          <p className="text-base font-semibold text-[#1E293B]">
            {isDragActive ? 'Drop the photo here' : 'Drop a meal photo or click to upload'}
          </p>
          <p className="text-xs text-[#64748B] mt-1">JPG or PNG · up to 5 MB</p>
          <div className="mt-5 inline-flex items-center gap-1.5 text-[11px] font-medium text-brand-700 bg-brand-50 px-3 py-1.5 rounded-full">
            <Camera size={12} /> 270 dishes recognised
          </div>
        </>
      )}
    </div>
  )
}
