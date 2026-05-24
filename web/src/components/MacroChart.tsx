import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'

interface Props { nutrition: { calories: number; protein: number; carbs: number; fat: number } }

// Brand-aligned palette (deep forest → vibrant mint → soft mint)
const COLORS = ['#0A362A', '#10B981', '#86D2AE']

export default function MacroChart({ nutrition }: Props) {
  const data = [
    { name: 'Protein', value: nutrition.protein * 4 },
    { name: 'Carbs',   value: nutrition.carbs   * 4 },
    { name: 'Fat',     value: nutrition.fat      * 9 },
  ]
  return (
    <div className="bg-white rounded-xl border p-4">
      <h3 className="font-semibold mb-3 text-sm">Average Macro Split (kcal)</h3>
      <ResponsiveContainer width="100%" height={180}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" outerRadius={70} dataKey="value" label>
            {data.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
          </Pie>
          <Tooltip formatter={(v) => [`${v} kcal`]} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
