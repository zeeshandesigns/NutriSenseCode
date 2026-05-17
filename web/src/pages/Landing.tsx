import { Link } from 'react-router-dom'
import { Camera, Brain, ClipboardList, UtensilsCrossed, ChevronRight } from 'lucide-react'

const STEPS = [
  { icon: Camera,        title: 'Snap',       desc: 'Point your camera at any South Asian dish' },
  { icon: Brain,         title: 'Identify',   desc: 'EfficientNetB0 CNN classifies from 100 food classes' },
  { icon: ClipboardList, title: 'Understand', desc: 'Get nutrition facts and a plain-language insight instantly' },
]

const ABLATION = [
  { model: 'EfficientNetB0 (ours)', params: '5.3M', top1: '~80%', top3: '~93%', highlight: true },
  { model: 'MobileNetV2',           params: '3.4M', top1: '~74%', top3: '~89%', highlight: false },
  { model: 'ResNet50',              params: '25.6M',top1: '~76%', top3: '~90%', highlight: false },
]

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50 to-white">
      <nav className="flex items-center justify-between px-8 py-4 border-b bg-white/70 backdrop-blur">
        <div className="flex items-center gap-2">
          <UtensilsCrossed className="h-5 w-5 text-brand-700" />
          <span className="font-bold text-brand-700 text-xl tracking-tight">NutriSense AI</span>
        </div>
        <Link to="/login" className="inline-flex items-center gap-1 bg-brand-700 text-white px-4 py-2 rounded-lg text-sm hover:bg-brand-800 transition-colors">
          Get Started <ChevronRight size={16} />
        </Link>
      </nav>

      <section className="max-w-3xl mx-auto px-8 py-20 text-center">
        <UtensilsCrossed className="h-16 w-16 text-brand-700 mx-auto mb-4" />
        <h1 className="text-5xl font-bold text-gray-900 mb-4 leading-tight">
          Know your desi food — <span className="text-brand-700">instantly</span>
        </h1>
        <p className="text-lg text-gray-500 mb-8 max-w-xl mx-auto">
          NutriSense AI recognises Pakistani and South Asian dishes from a single photo.
          No manual entry. No guessing. Point, snap, understand.
        </p>
        <Link to="/login" className="inline-flex items-center gap-2 bg-brand-700 text-white px-8 py-3 rounded-lg text-base font-semibold hover:bg-brand-800 transition-colors">
          Try It Free <ChevronRight size={18} />
        </Link>
      </section>

      <section className="bg-white py-16 border-y">
        <div className="max-w-3xl mx-auto px-8">
          <h2 className="text-2xl font-bold text-center mb-10">How it works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {STEPS.map(s => (
              <div key={s.title} className="text-center">
                <div className="bg-brand-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                  <s.icon className="h-8 w-8 text-brand-700" />
                </div>
                <h3 className="font-semibold mb-1">{s.title}</h3>
                <p className="text-sm text-gray-500">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-8 py-16">
        <h2 className="text-2xl font-bold mb-2">The Model</h2>
        <p className="text-gray-500 mb-6 text-sm">
          Fine-tuned EfficientNetB0 trained on a curated dataset of ~100 food classes including ~35 South Asian dishes
          absent from standard benchmarks. Ablation study confirmed it outperforms lighter and heavier alternatives.
        </p>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-brand-50 text-left">
              <th className="p-2 border">Model</th>
              <th className="p-2 border">Params</th>
              <th className="p-2 border">Top-1</th>
              <th className="p-2 border">Top-3</th>
            </tr>
          </thead>
          <tbody>
            {ABLATION.map(r => (
              <tr key={r.model} className={r.highlight ? 'bg-brand-50 font-semibold' : ''}>
                <td className="p-2 border">{r.model}</td>
                <td className="p-2 border">{r.params}</td>
                <td className="p-2 border">{r.top1}</td>
                <td className="p-2 border">{r.top3}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-xs text-gray-400 mt-3">Approximate values from held-out validation set.</p>
      </section>

      <footer className="border-t py-8 text-center text-sm text-gray-400">
        NutriSense AI — Final Year Project &copy; {new Date().getFullYear()}
      </footer>
    </div>
  )
}
