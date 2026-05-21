import { Link } from 'react-router-dom'
import { Camera, Brain, ClipboardList, UtensilsCrossed, ChevronRight } from 'lucide-react'

const STEPS = [
  { icon: Camera,        title: 'Snap',       desc: 'Point your camera at any South Asian dish' },
  { icon: Brain,         title: 'Identify',   desc: 'EfficientNetB0 CNN classifies from 100 food classes' },
  { icon: ClipboardList, title: 'Understand', desc: 'Get nutrition facts and a plain-language insight instantly' },
]

// Production model headline (full two-phase training, held-out 20% val split, 270 classes)
const HEADLINE = { top1: '82.65%', top3: '93.65%' }

// Ablation: all three models trained for the same 4 epochs from ImageNet pretrain
// on the same train/val split — comparable apples-to-apples.
const ABLATION = [
  { model: 'EfficientNetB0 (ours)', params: '4.4M',  top1: '71.29%', top3: '87.49%', highlight: true },
  { model: 'MobileNetV2',           params: '2.6M',  top1: '56.04%', top3: '76.99%', highlight: false },
  { model: 'ResNet50',              params: '24.1M', top1: '33.10%', top3: '53.06%', highlight: false },
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
          Fine-tuned EfficientNetB0 trained on a curated dataset of 270 food classes from Food-101,
          Khana 2025 (Indian), DeshiFoodBD, and self-scraped Pakistani dishes. Two-phase transfer
          learning (5 frozen-backbone + 15 fine-tune epochs).
        </p>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-brand-50 border border-brand-200 rounded-xl p-4 text-center">
            <p className="text-3xl font-bold text-brand-700">{HEADLINE.top1}</p>
            <p className="text-xs text-gray-500 mt-1">Top-1 accuracy (held-out 20% val)</p>
          </div>
          <div className="bg-brand-50 border border-brand-200 rounded-xl p-4 text-center">
            <p className="text-3xl font-bold text-brand-700">{HEADLINE.top3}</p>
            <p className="text-xs text-gray-500 mt-1">Top-3 accuracy</p>
          </div>
        </div>

        <h3 className="font-semibold text-gray-700 mb-2 text-sm">Architecture ablation — all 4 epochs, same split</h3>
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
        <p className="text-xs text-gray-400 mt-3">
          Ablation epochs trimmed to 4 for compute fairness; the headline values above use the full
          two-phase training schedule on the same EfficientNetB0 architecture.
        </p>
      </section>

      <footer className="border-t py-8 text-center text-sm text-gray-400">
        NutriSense AI — Final Year Project &copy; {new Date().getFullYear()}
      </footer>
    </div>
  )
}
