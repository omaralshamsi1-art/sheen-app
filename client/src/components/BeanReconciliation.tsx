import { Fragment, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../lib/api'

interface BeanRow {
  id: string
  name: string
  unit: string
  purchased: number
  used: number
  remaining: number
  cups_sold: number
  by_drink: Array<{ name: string; cups: number }>
}

const STORAGE_KEY = 'bean_actual_on_shelf'

function loadActuals(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
  } catch {
    return {}
  }
}

export default function BeanReconciliation() {
  const [actuals, setActuals] = useState<Record<string, number>>(loadActuals)
  const [expanded, setExpanded] = useState<string | null>(null)

  const { data: beans = [], isLoading } = useQuery<BeanRow[]>({
    queryKey: ['ingredients', 'bean-reconciliation'],
    queryFn: async () => {
      const { data } = await api.get('/api/ingredients/bean-reconciliation')
      return data
    },
    staleTime: 60_000,
  })

  const updateActual = (id: string, val: string) => {
    const next = { ...actuals }
    if (val === '') delete next[id]
    else next[id] = Number(val)
    setActuals(next)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }

  if (isLoading) return null
  if (beans.length === 0) return null

  return (
    <div className="bg-sheen-white rounded-xl shadow-sm p-5">
      <h2 className="font-display text-lg text-sheen-black mb-1">Bean Reconciliation</h2>
      <p className="text-xs text-sheen-muted mb-4">
        Enter what you physically counted on the shelf. Variance = actual − calculated remaining.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm font-body">
          <thead>
            <tr className="text-left text-xs text-sheen-muted uppercase border-b border-sheen-cream">
              <th className="pb-2 pr-3">Bean</th>
              <th className="pb-2 pr-3 text-right">Purchased</th>
              <th className="pb-2 pr-3 text-right">Cups sold</th>
              <th className="pb-2 pr-3 text-right">Used</th>
              <th className="pb-2 pr-3 text-right">Calc. remaining</th>
              <th className="pb-2 pr-3 text-right">Actual on shelf</th>
              <th className="pb-2 text-right">Variance</th>
            </tr>
          </thead>
          <tbody>
            {beans.map((b) => {
              const actual = actuals[b.id]
              const variance =
                actual === undefined ? null : Math.round((actual - b.remaining) * 100) / 100
              const isOpen = expanded === b.id
              return (
                <Fragment key={b.id}>
                  <tr className="border-b border-sheen-muted/10">
                    <td className="py-2 pr-3 text-sheen-black font-medium">
                      <button
                        onClick={() => setExpanded(isOpen ? null : b.id)}
                        className="hover:underline text-left"
                      >
                        {isOpen ? '▾' : '▸'} {b.name}
                      </button>
                    </td>
                    <td className="py-2 pr-3 text-right text-sheen-black">
                      {b.purchased.toFixed(1)} {b.unit}
                    </td>
                    <td className="py-2 pr-3 text-right text-sheen-black">{b.cups_sold}</td>
                    <td className="py-2 pr-3 text-right text-sheen-black">
                      {b.used.toFixed(1)} {b.unit}
                    </td>
                    <td
                      className={`py-2 pr-3 text-right font-semibold ${
                        b.remaining <= 0 ? 'text-red-600' : 'text-green-600'
                      }`}
                    >
                      {b.remaining.toFixed(1)} {b.unit}
                    </td>
                    <td className="py-2 pr-3 text-right">
                      <input
                        type="number"
                        step="0.1"
                        value={actual ?? ''}
                        onChange={(e) => updateActual(b.id, e.target.value)}
                        placeholder="—"
                        className="w-24 px-2 py-1 text-right border border-sheen-cream rounded focus:outline-none focus:border-sheen-black"
                      />
                    </td>
                    <td
                      className={`py-2 text-right font-semibold ${
                        variance === null
                          ? 'text-sheen-muted'
                          : Math.abs(variance) < 50
                          ? 'text-green-600'
                          : variance < 0
                          ? 'text-red-600'
                          : 'text-orange-600'
                      }`}
                    >
                      {variance === null
                        ? '—'
                        : `${variance > 0 ? '+' : ''}${variance.toFixed(1)} ${b.unit}`}
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="bg-sheen-cream/30">
                      <td colSpan={7} className="py-3 px-4">
                        {b.by_drink.length === 0 ? (
                          <span className="text-xs text-sheen-muted">No sales recorded.</span>
                        ) : (
                          <div>
                            <div className="text-xs text-sheen-muted uppercase mb-2">
                              Cups by drink
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {b.by_drink.map((d) => (
                                <span
                                  key={d.name}
                                  className="px-2.5 py-1 rounded-full text-xs bg-sheen-white border border-sheen-cream"
                                >
                                  {d.name}: <strong>{d.cups}</strong>
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
