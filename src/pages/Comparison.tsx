import { useState, useMemo } from 'react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, Legend,
  ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { stores, recordings, annotations, weeklyTrendData, weeklyIssueData } from '@/data/mockData'
import { SCENARIO_LABELS, TAG_LABELS, TAG_CATEGORY, type ScenarioType, type TagType } from '@/types'
import { useStore } from '@/store/useStore'
import { GitCompareArrows, TrendingUp, AlertTriangle, Award, ChevronDown } from 'lucide-react'

const STORE_COLORS: Record<string, string> = {
  s1: '#0D9488',
  s2: '#F97316',
  s3: '#8B5CF6',
  s4: '#EF4444',
  s5: '#3B82F6',
  s6: '#EC4899',
}

const SCENARIO_COLORS: Record<ScenarioType, string> = {
  implant: '#0D9488',
  orthodontic: '#F97316',
  pediatric: '#8B5CF6',
  cleaning: '#3B82F6',
}

const SCENARIO_KEYS: ScenarioType[] = ['implant', 'orthodontic', 'pediatric', 'cleaning']

const INITIAL_SELECTED = ['s1', 's4']

export default function Comparison() {
  const [selectedIds, setSelectedIds] = useState<string[]>(INITIAL_SELECTED)
  const [trendTab, setTrendTab] = useState<'satisfaction' | 'issues'>('satisfaction')

  const storeRecordings = useStore((s) => s.recordings)
  const storeAnnotations = useStore((s) => s.annotations)

  const toggleStore = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        if (prev.length <= 2) return prev
        return prev.filter((s) => s !== id)
      }
      if (prev.length >= 5) return prev
      return [...prev, id]
    })
  }

  const filteredTrendData = useMemo(() => {
    const source = trendTab === 'satisfaction' ? weeklyTrendData : weeklyIssueData
    return source.map((entry) => {
      const filtered: Record<string, string | number> = { week: entry.week }
      selectedIds.forEach((id) => {
        filtered[id] = entry[id as keyof typeof entry] as number
      })
      return filtered
    })
  }, [selectedIds, trendTab])

  const scenarioComparisonData = useMemo(() => {
    return SCENARIO_KEYS.map((scenario) => {
      const entry: Record<string, string | number> = { scenario: SCENARIO_LABELS[scenario] }
      selectedIds.forEach((storeId) => {
        const recs = storeRecordings.filter((r) => r.storeId === storeId && r.scenario === scenario)
        if (recs.length > 0) {
          const avg = recs.reduce((sum, r) => sum + r.satisfactionScore, 0) / recs.length
          entry[storeId] = Math.round(avg * 10) / 10
        } else {
          entry[storeId] = 0
        }
      })
      return entry
    })
  }, [selectedIds, storeRecordings])

  const typicalCases = useMemo(() => {
    const recordingMap = new Map(storeRecordings.map((r) => [r.id, r]))
    const cases: {
      storeId: string
      storeName: string
      scenario: ScenarioType
      scenarioLabel: string
      tags: TagType[]
      suggestion: string
      doctorCode: string
      date: string
      isPositive: boolean
    }[] = []

    const storeCases: Record<string, typeof cases> = {}
    selectedIds.forEach((id) => { storeCases[id] = [] })

    storeAnnotations.forEach((a) => {
      const rec = recordingMap.get(a.recordingId)
      if (!rec || !selectedIds.includes(rec.storeId)) return

      const hasPositive = a.tags.some((t) => TAG_CATEGORY[t as TagType] === 'positive')
      const hasNegative = a.tags.some((t) => TAG_CATEGORY[t as TagType] === 'negative')

      const caseItem = {
        storeId: rec.storeId,
        storeName: rec.storeName,
        scenario: rec.scenario,
        scenarioLabel: SCENARIO_LABELS[rec.scenario],
        tags: a.tags,
        suggestion: a.suggestion,
        doctorCode: rec.doctorCode,
        date: rec.date,
        isPositive: hasPositive && !hasNegative,
      }

      storeCases[rec.storeId].push(caseItem)
    })

    selectedIds.forEach((id) => {
      const positive = storeCases[id].filter((c) => c.isPositive)
      const negative = storeCases[id].filter((c) => !c.isPositive)
      const picked: typeof cases = []

      if (positive.length > 0) picked.push(positive[0])
      if (negative.length > 0) picked.push(negative[0])
      if (picked.length === 0 && storeCases[id].length > 0) picked.push(storeCases[id][0])

      cases.push(...picked.slice(0, 2))
    })

    return cases
  }, [selectedIds, storeRecordings, storeAnnotations])

  const trainingAlerts = useMemo(() => {
    const alerts: { storeId: string; storeName: string; message: string }[] = []

    selectedIds.forEach((storeId) => {
      const store = stores.find((s) => s.id === storeId)
      if (!store) return

      SCENARIO_KEYS.forEach((scenario) => {
        const recs = storeRecordings.filter((r) => r.storeId === storeId && r.scenario === scenario)
        if (recs.length === 0) return
        const avg = recs.reduce((sum, r) => sum + r.satisfactionScore, 0) / recs.length
        if (avg < 3.5) {
          alerts.push({
            storeId,
            storeName: store.name,
            message: `${store.name}在${SCENARIO_LABELS[scenario]}场景需要加强培训，平均满意度仅${avg.toFixed(1)}`,
          })
        }
      })
    })

    const recordingMap = new Map(storeRecordings.map((r) => [r.id, r]))
    selectedIds.forEach((storeId) => {
      const store = stores.find((s) => s.id === storeId)
      if (!store) return

      const weekIssueCounts: Record<string, number> = {}
      storeAnnotations.forEach((a) => {
        const rec = recordingMap.get(a.recordingId)
        if (!rec || rec.storeId !== storeId) return
        const negTags = a.tags.filter((t) => TAG_CATEGORY[t as TagType] === 'negative')
        if (negTags.length === 0) return
        const weekKey = rec.date
        weekIssueCounts[weekKey] = (weekIssueCounts[weekKey] || 0) + negTags.length
      })

      Object.entries(weekIssueCounts).forEach(([date, count]) => {
        if (count > 5) {
          alerts.push({
            storeId,
            storeName: store.name,
            message: `${store.name}在${date}当周问题标签数达${count}个，超过5个阈值，需关注`,
          })
        }
      })
    })

    return alerts
  }, [selectedIds, storeRecordings, storeAnnotations])

  const selectedStores = useMemo(
    () => stores.filter((s) => selectedIds.includes(s.id)),
    [selectedIds]
  )

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="font-serif text-2xl font-bold text-slate-800">门店对比</h1>
        <p className="text-sm text-slate-400 mt-1">多门店质检数据横向对比与趋势分析</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-5 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <GitCompareArrows className="w-5 h-5 text-primary" />
          <h2 className="font-serif text-lg font-semibold text-slate-700">选择对比门店</h2>
          <span className="text-xs text-slate-400 ml-1">（2-5家）</span>
        </div>
        <div className="flex flex-wrap gap-3">
          {stores.map((store) => {
            const isSelected = selectedIds.includes(store.id)
            const color = STORE_COLORS[store.id]
            return (
              <button
                key={store.id}
                onClick={() => toggleStore(store.id)}
                className="relative px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-200 border-2"
                style={{
                  borderColor: isSelected ? color : '#e2e8f0',
                  backgroundColor: isSelected ? color : 'transparent',
                  color: isSelected ? '#ffffff' : '#64748b',
                }}
              >
                {store.name}
                {!isSelected && selectedIds.length >= 5 && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-slate-300" />
                )}
              </button>
            )
          })}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <TrendingUp className="w-5 h-5 text-primary" />
            <h2 className="font-serif text-lg font-semibold text-slate-700">趋势对比</h2>
          </div>
          <div className="flex bg-slate-100 rounded-lg p-1">
            <button
              onClick={() => setTrendTab('satisfaction')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                trendTab === 'satisfaction'
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              满意度趋势
            </button>
            <button
              onClick={() => setTrendTab('issues')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                trendTab === 'issues'
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              问题数趋势
            </button>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={filteredTrendData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="week" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis
              tick={{ fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              domain={trendTab === 'satisfaction' ? [2, 5] : [0, 'auto']}
            />
            <Tooltip
              contentStyle={{
                borderRadius: '8px',
                border: 'none',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              }}
            />
            <Legend />
            {selectedIds.map((id) => {
              const store = stores.find((s) => s.id === id)
              return (
                <Line
                  key={id}
                  type="monotone"
                  dataKey={id}
                  name={store?.name ?? id}
                  stroke={STORE_COLORS[id]}
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: STORE_COLORS[id] }}
                  activeDot={{ r: 6 }}
                />
              )
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <div className="flex items-center gap-3 mb-5">
          <Award className="w-5 h-5 text-primary" />
          <h2 className="font-serif text-lg font-semibold text-slate-700">场景维度对比</h2>
        </div>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={scenarioComparisonData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="scenario" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis
              tick={{ fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              domain={[0, 5]}
            />
            <Tooltip
              contentStyle={{
                borderRadius: '8px',
                border: 'none',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              }}
            />
            <Legend />
            {selectedIds.map((id) => {
              const store = stores.find((s) => s.id === id)
              return (
                <Bar
                  key={id}
                  dataKey={id}
                  name={store?.name ?? id}
                  fill={STORE_COLORS[id]}
                  radius={[4, 4, 0, 0]}
                  barSize={Math.min(32, 120 / selectedIds.length)}
                />
              )
            })}
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <div className="flex items-center gap-3 mb-5">
          <Award className="w-5 h-5 text-primary" />
          <h2 className="font-serif text-lg font-semibold text-slate-700">典型案例</h2>
        </div>
        {typicalCases.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-sm">暂无案例数据</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {typicalCases.map((c, idx) => {
              const borderColor = c.isPositive ? '#10b981' : '#ef4444'
              return (
                <div
                  key={idx}
                  className="rounded-lg border border-slate-100 overflow-hidden"
                  style={{ borderLeftWidth: 4, borderLeftColor: borderColor }}
                >
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-block px-2 py-0.5 rounded-full text-xs font-medium text-white"
                          style={{ backgroundColor: SCENARIO_COLORS[c.scenario] }}
                        >
                          {c.scenarioLabel}
                        </span>
                        <span className="text-xs text-slate-400">{c.storeName}</span>
                      </div>
                      <span className="text-xs text-slate-400">{c.date}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {c.tags.map((tag) => (
                        <span
                          key={tag}
                          className={`inline-block px-2 py-0.5 rounded text-xs ${
                            TAG_CATEGORY[tag as TagType] === 'positive'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-red-50 text-red-600'
                          }`}
                        >
                          {TAG_LABELS[tag as TagType]}
                        </span>
                      ))}
                    </div>
                    <p className="text-sm text-slate-600 mb-2 leading-relaxed">{c.suggestion}</p>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-slate-400">医生编码：</span>
                      <span className="text-xs font-mono font-medium text-slate-500">{c.doctorCode}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {trainingAlerts.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center gap-3 mb-5">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            <h2 className="font-serif text-lg font-semibold text-slate-700">培训预警</h2>
          </div>
          <div className="space-y-3">
            {trainingAlerts.map((alert, idx) => (
              <div
                key={idx}
                className="rounded-lg border-l-4 border-l-amber-500 bg-gradient-to-r from-amber-50 to-orange-50 p-4 flex items-start gap-3"
              >
                <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                <p className="text-sm text-amber-800 leading-relaxed">{alert.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
