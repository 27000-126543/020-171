import { useState, useMemo } from 'react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, Legend,
  ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { stores, weeklyTrendData, weeklyIssueData } from '@/data/mockData'
import {
  SCENARIO_LABELS, TAG_LABELS, TAG_CATEGORY,
  WEAKNESS_DIMENSION_LABELS,
  type ScenarioType, type TagType, type WeaknessDimension,
} from '@/types'
import { useStore } from '@/store/useStore'
import {
  GitCompareArrows, TrendingUp, AlertTriangle, Award,
  ChevronRight, ChevronLeft, Target, Stethoscope,
  BarChart3, User, Clock, Store,
} from 'lucide-react'

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

const DIMENSION_TAGS: Record<WeaknessDimension, TagType[]> = {
  child_comfort: ['child_comfort', 'empathy_good'],
  high_price_explanation: ['price_unclear', 'value_demonstrated', 'overpromise'],
  followup_guidance: ['followup_missing', 'urgency_appropriate'],
  risk_disclosure: ['risk_informed', 'consent_unclear'],
  value_delivery: ['value_demonstrated', 'referral_missed', 'empathy_good'],
}

const DIMENSION_KEYS: WeaknessDimension[] = [
  'child_comfort', 'high_price_explanation', 'followup_guidance', 'risk_disclosure', 'value_delivery',
]

const INITIAL_SELECTED = ['s1', 's4']

export default function Comparison() {
  const [selectedIds, setSelectedIds] = useState<string[]>(INITIAL_SELECTED)
  const [trendTab, setTrendTab] = useState<'satisfaction' | 'issues'>('satisfaction')
  const [drillDownStoreId, setDrillDownStoreId] = useState<string | null>(null)

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

  const dimensionScores = useMemo(() => {
    const scores: Record<string, Record<WeaknessDimension, number>> = {}
    selectedIds.forEach((storeId) => {
      scores[storeId] = {} as Record<WeaknessDimension, number>
      DIMENSION_KEYS.forEach((dim) => {
        const dimTags = DIMENSION_TAGS[dim]
        const relatedAnnotations: { tags: TagType[] }[] = []
        storeAnnotations.forEach((a) => {
          const rec = storeRecordings.find((r) => r.id === a.recordingId)
          if (rec && rec.storeId === storeId && a.tags.some((t) => dimTags.includes(t))) {
            relatedAnnotations.push(a)
          }
        })
        if (relatedAnnotations.length === 0) {
          scores[storeId][dim] = 3.0
          return
        }
        const positiveCount = relatedAnnotations.filter((a) =>
          a.tags.some((t) => TAG_CATEGORY[t] === 'positive' && dimTags.includes(t))
        ).length
        const negativeCount = relatedAnnotations.filter((a) =>
          a.tags.some((t) => TAG_CATEGORY[t] === 'negative' && dimTags.includes(t))
        ).length
        const total = positiveCount + negativeCount || 1
        const score = 2 + (positiveCount / total) * 3
        scores[storeId][dim] = Math.round(score * 10) / 10
      })
    })
    return scores
  }, [selectedIds, storeRecordings, storeAnnotations])

  const dimensionChartData = useMemo(() => {
    return DIMENSION_KEYS.map((dim) => {
      const entry: Record<string, string | number> = { dimension: WEAKNESS_DIMENSION_LABELS[dim] }
      selectedIds.forEach((storeId) => {
        entry[storeId] = dimensionScores[storeId]?.[dim] ?? 0
      })
      return entry
    })
  }, [selectedIds, dimensionScores])

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
      summary: { patientConcern: string; doctorResponse: string; conversionResult: string }
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
        summary: rec.summary,
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
    const alerts: { storeId: string; storeName: string; message: string; dimension?: WeaknessDimension }[] = []

    selectedIds.forEach((storeId) => {
      const store = stores.find((s) => s.id === storeId)
      if (!store) return

      DIMENSION_KEYS.forEach((dim) => {
        const score = dimensionScores[storeId]?.[dim]
        if (score !== undefined && score < 3.2) {
          alerts.push({
            storeId,
            storeName: store.name,
            dimension: dim,
            message: `${store.name}在「${WEAKNESS_DIMENSION_LABELS[dim]}」维度得分偏低（${score.toFixed(1)}分），建议针对性培训`,
          })
        }
      })
    })

    return alerts
  }, [selectedIds, dimensionScores])

  const drillDownRecordings = useMemo(() => {
    if (!drillDownStoreId) return []
    const store = stores.find((s) => s.id === drillDownStoreId)
    if (!store) return []
    return storeRecordings
      .filter((r) => r.storeId === drillDownStoreId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 8)
  }, [drillDownStoreId, storeRecordings])

  const drillDownDimensionTrend = useMemo(() => {
    if (!drillDownStoreId) return []
    const weeks = weeklyTrendData.map((d) => d.week)
    return DIMENSION_KEYS.map((dim) => {
      const baseScore = dimensionScores[drillDownStoreId]?.[dim] ?? 3.0
      return {
        dimension: WEAKNESS_DIMENSION_LABELS[dim],
        ...Object.fromEntries(
          weeks.map((week, i) => [week, Math.max(1, Math.min(5, baseScore + (Math.random() - 0.5) * 0.8 - 0.3 + i * 0.1))])
        ),
      }
    })
  }, [drillDownStoreId, dimensionScores])

  const selectedStores = useMemo(
    () => stores.filter((s) => selectedIds.includes(s.id)),
    [selectedIds]
  )

  const drillDownStore = useMemo(
    () => stores.find((s) => s.id === drillDownStoreId) ?? null,
    [drillDownStoreId]
  )

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold text-slate-800">门店对比</h1>
          <p className="text-sm text-slate-400 mt-1">多门店质检数据横向对比与培训诊断</p>
        </div>
        {drillDownStore && (
          <button
            onClick={() => setDrillDownStoreId(null)}
            className="flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            返回对比视图
          </button>
        )}
      </div>

      {!drillDownStoreId ? (
        <>
          <div className="bg-white rounded-xl shadow-sm p-5 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <GitCompareArrows className="w-5 h-5 text-primary" />
              <h2 className="font-serif text-lg font-semibold text-slate-700">选择对比门店</h2>
              <span className="text-xs text-slate-400 ml-1">（2-5家，点击门店卡片可钻取详情）</span>
            </div>
            <div className="flex flex-wrap gap-3">
              {stores.map((store) => {
                const isSelected = selectedIds.includes(store.id)
                const color = STORE_COLORS[store.id]
                return (
                  <div key={store.id} className="relative group">
                    <button
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
                    {isSelected && (
                      <button
                        onClick={() => setDrillDownStoreId(store.id)}
                        className="absolute -bottom-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 px-2 py-0.5 bg-slate-800 text-white text-[10px] rounded whitespace-nowrap"
                      >
                        查看详情
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
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

          <div className="grid grid-cols-2 gap-6 mb-6">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center gap-3 mb-5">
                <Award className="w-5 h-5 text-primary" />
                <h2 className="font-serif text-lg font-semibold text-slate-700">场景维度对比</h2>
              </div>
              <ResponsiveContainer width="100%" height={280}>
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

            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center gap-3 mb-5">
                <Target className="w-5 h-5 text-primary" />
                <h2 className="font-serif text-lg font-semibold text-slate-700">薄弱项维度对比</h2>
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={dimensionChartData} layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis type="number" domain={[0, 5]} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis
                    type="category"
                    dataKey="dimension"
                    width={90}
                    tick={{ fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
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
                        radius={[0, 4, 4, 0]}
                        barSize={Math.min(28, 100 / selectedIds.length)}
                      />
                    )
                  })}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
            <div className="flex items-center gap-3 mb-5">
              <BarChart3 className="w-5 h-5 text-primary" />
              <h2 className="font-serif text-lg font-semibold text-slate-700">门店整体表现</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {selectedStores.map((store) => {
                const color = STORE_COLORS[store.id]
                const avgSatisfaction = storeRecordings.filter(r => r.storeId === store.id).reduce((s, r) => s + r.satisfactionScore, 0) /
                  Math.max(1, storeRecordings.filter(r => r.storeId === store.id).length)
                const issueCount = storeAnnotations.filter(a => {
                  const r = storeRecordings.find(rec => rec.id === a.recordingId)
                  return r && r.storeId === store.id && a.tags.some(t => TAG_CATEGORY[t as TagType] === 'negative')
                }).length
                return (
                  <div
                    key={store.id}
                    onClick={() => setDrillDownStoreId(store.id)}
                    className="rounded-xl p-4 cursor-pointer transition-all hover:shadow-md border-2 border-transparent hover:border-slate-200"
                    style={{ backgroundColor: `${color}08` }}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-slate-700">{store.name}</span>
                      <ChevronRight className="w-4 h-4 text-slate-300" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-end justify-between">
                        <span className="text-xs text-slate-400">满意度</span>
                        <span className="text-lg font-bold" style={{ color }}>{avgSatisfaction.toFixed(1)}</span>
                      </div>
                      <div className="flex items-end justify-between">
                        <span className="text-xs text-slate-400">问题标签数</span>
                        <span className="text-sm font-semibold text-slate-600">{issueCount}</span>
                      </div>
                      <div className="flex items-end justify-between">
                        <span className="text-xs text-slate-400">健康分</span>
                        <span className="text-sm font-semibold text-slate-600">{store.healthScore}分</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
            <div className="flex items-center gap-3 mb-5">
              <Award className="w-5 h-5 text-primary" />
              <h2 className="font-serif text-lg font-semibold text-slate-700">典型案例</h2>
              <span className="text-xs text-slate-400">（仅展示医生编码，不公开排名）</span>
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
                        <div className="flex items-center gap-3 text-xs text-slate-400">
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            医生：{c.doctorCode}
                          </span>
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
                <span className="text-xs text-slate-400">（点击门店可查看详细分析）</span>
              </div>
              <div className="space-y-3">
                {trainingAlerts.map((alert, idx) => (
                  <div
                    key={idx}
                    onClick={() => setDrillDownStoreId(alert.storeId)}
                    className="rounded-lg border-l-4 border-l-amber-500 bg-gradient-to-r from-amber-50 to-orange-50 p-4 flex items-start gap-3 cursor-pointer hover:shadow-sm transition-shadow"
                  >
                    <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm text-amber-800 leading-relaxed">{alert.message}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-primary-50 to-teal-50 rounded-xl p-6 border border-primary/20">
            <div className="flex items-center gap-4">
              <Store className="w-10 h-10 text-primary" />
              <div>
                <h2 className="font-serif text-xl font-bold text-slate-800">{drillDownStore?.name}</h2>
                <p className="text-sm text-slate-500 mt-0.5">
                  区域：{drillDownStore?.region} · 健康分：{drillDownStore?.healthScore}分
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center gap-3 mb-5">
              <Target className="w-5 h-5 text-primary" />
              <h3 className="font-serif text-lg font-semibold text-slate-700">薄弱项维度得分</h3>
            </div>
            <div className="space-y-4">
              {DIMENSION_KEYS.map((dim) => {
                const score = dimensionScores[drillDownStoreId]?.[dim] ?? 0
                const isWeak = score < 3.2
                return (
                  <div key={dim} className="flex items-center gap-4">
                    <span className="text-sm text-slate-600 w-24 shrink-0">
                      {WEAKNESS_DIMENSION_LABELS[dim]}
                    </span>
                    <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${(score / 5) * 100}%`,
                          backgroundColor: isWeak ? '#F97316' : '#0D9488',
                        }}
                      />
                    </div>
                    <span className={`text-sm font-bold w-12 text-right ${isWeak ? 'text-orange-600' : 'text-teal-600'}`}>
                      {score.toFixed(1)}
                    </span>
                    {isWeak && (
                      <span className="text-xs text-orange-500 bg-orange-50 px-2 py-0.5 rounded">
                        需培训
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center gap-3 mb-5">
              <TrendingUp className="w-5 h-5 text-primary" />
              <h3 className="font-serif text-lg font-semibold text-slate-700">薄弱项趋势</h3>
            </div>
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={drillDownDimensionTrend} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="dimension" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  domain={[2, 5]}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: '8px',
                    border: 'none',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  }}
                />
                <Legend />
                {weeklyTrendData.map((_, i) => {
                  const colors = ['#0D9488', '#F97316', '#8B5CF6', '#3B82F6', '#EC4899', '#10B981']
                  return (
                    <Line
                      key={`week-${i}`}
                      type="monotone"
                      dataKey={`W${i + 1}`}
                      stroke={colors[i % colors.length]}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  )
                })}
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center gap-3 mb-5">
              <Stethoscope className="w-5 h-5 text-primary" />
              <h3 className="font-serif text-lg font-semibold text-slate-700">代表接诊记录</h3>
              <span className="text-xs text-slate-400">（共 {storeRecordings.filter(r => r.storeId === drillDownStoreId).length} 条，展示最近8条）</span>
            </div>
            <div className="space-y-3">
              {drillDownRecordings.map((rec) => {
                const hasNegative = storeAnnotations.some(a =>
                  a.recordingId === rec.id && a.tags.some(t => TAG_CATEGORY[t as TagType] === 'negative')
                )
                const hasPositive = storeAnnotations.some(a =>
                  a.recordingId === rec.id && a.tags.some(t => TAG_CATEGORY[t as TagType] === 'positive')
                )
                return (
                  <div
                    key={rec.id}
                    className={`rounded-lg border p-4 transition-all hover:shadow-sm ${
                      hasNegative ? 'border-red-100 bg-red-50/30' : 'border-slate-100'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span
                            className="inline-block px-2 py-0.5 rounded-full text-xs font-medium text-white"
                            style={{ backgroundColor: SCENARIO_COLORS[rec.scenario] }}
                          >
                            {SCENARIO_LABELS[rec.scenario]}
                          </span>
                          <span className="text-xs text-slate-500">{rec.doctorCode}</span>
                          <span className="text-xs text-slate-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {Math.floor(rec.duration / 60)}分{rec.duration % 60}秒
                          </span>
                          <span className="text-xs text-slate-400">{rec.date}</span>
                          <span className={`text-xs font-medium ${
                            rec.satisfactionScore >= 4 ? 'text-emerald-600' :
                            rec.satisfactionScore >= 3 ? 'text-amber-600' : 'text-red-600'
                          }`}>
                            {rec.satisfactionScore.toFixed(1)}分
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-3 text-xs">
                          <div className="bg-slate-50 rounded p-2">
                            <span className="text-orange-600 font-medium">患者顾虑：</span>
                            <span className="text-slate-500 ml-1">{rec.summary.patientConcern}</span>
                          </div>
                          <div className="bg-teal-50 rounded p-2">
                            <span className="text-teal-600 font-medium">医生回应：</span>
                            <span className="text-slate-500 ml-1">{rec.summary.doctorResponse}</span>
                          </div>
                          <div className="bg-blue-50 rounded p-2">
                            <span className="text-blue-600 font-medium">转化结果：</span>
                            <span className="text-slate-500 ml-1">{rec.summary.conversionResult}</span>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1.5 mt-3">
                          {storeAnnotations.filter(a => a.recordingId === rec.id).flatMap(a => a.tags).slice(0, 5).map((tag) => (
                            <span
                              key={tag}
                              className={`inline-block px-2 py-0.5 rounded text-[11px] ${
                                TAG_CATEGORY[tag as TagType] === 'positive'
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : 'bg-red-50 text-red-600'
                              }`}
                            >
                              {TAG_LABELS[tag as TagType]}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
