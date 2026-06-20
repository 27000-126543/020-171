import { useState, useMemo, useEffect } from 'react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, Legend,
  ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { stores, weeklyTrendData, weeklyIssueData, DIMENSION_WEEKLY_DATA, WEEK_LABELS } from '@/data/mockData'
import {
  SCENARIO_LABELS, TAG_LABELS, TAG_CATEGORY,
  WEAKNESS_DIMENSION_LABELS, TRAINING_STATUS_LABELS, TRAINING_STATUS_COLORS,
  type ScenarioType, type TagType, type WeaknessDimension, type TrainingStatus,
} from '@/types'
import { useStore } from '@/store/useStore'
import { useLocation } from 'react-router-dom'
import {
  GitCompareArrows, TrendingUp, AlertTriangle, Award,
  ChevronRight, ChevronLeft, Target, Stethoscope,
  BarChart3, User, Clock, Store, Sparkles,
  Plus, CheckCircle2, CalendarDays, Pencil, Trash2, Save, X, ListTodo,
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
  const location = useLocation()
  const locState = (location.state as { drillDownStoreId?: string } | null) ?? {}

  const [selectedIds, setSelectedIds] = useState<string[]>(INITIAL_SELECTED)
  const [trendTab, setTrendTab] = useState<'satisfaction' | 'issues'>('satisfaction')
  const [drillDownStoreId, setDrillDownStoreId] = useState<string | null>(locState.drillDownStoreId ?? null)
  const [selectedDimension, setSelectedDimension] = useState<WeaknessDimension | 'all'>('all')
  const [selectedRecordingIds, setSelectedRecordingIds] = useState<Set<string>>(new Set())
  const [editingTrainingId, setEditingTrainingId] = useState<string | null>(null)
  const [editOwner, setEditOwner] = useState('')
  const [editPlanDate, setEditPlanDate] = useState('')
  const [editStatus, setEditStatus] = useState<TrainingStatus>('pending')
  const [editNote, setEditNote] = useState('')
  const [quickOwner, setQuickOwner] = useState('')

  const storeRecordings = useStore((s) => s.recordings)
  const storeAnnotations = useStore((s) => s.annotations)
  const trainingItems = useStore((s) => s.trainingItems)
  const addTrainingItem = useStore((s) => s.addTrainingItem)
  const updateTrainingItem = useStore((s) => s.updateTrainingItem)
  const removeTrainingItem = useStore((s) => s.removeTrainingItem)

  useEffect(() => {
    if (drillDownStoreId) {
      setSelectedRecordingIds(new Set())
      setEditingTrainingId(null)
    }
  }, [drillDownStoreId])

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
          const weeklyData = DIMENSION_WEEKLY_DATA[storeId]?.[dim]
          if (weeklyData) {
            scores[storeId][dim] = weeklyData[weeklyData.length - 1]
          } else {
            scores[storeId][dim] = 3.0
          }
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
      annotationCreatedAt: string
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
        annotationCreatedAt: a.createdAt,
      }

      storeCases[rec.storeId].push(caseItem)
    })

    selectedIds.forEach((id) => {
      const sorted = [...storeCases[id]].sort(
        (a, b) => new Date(b.annotationCreatedAt).getTime() - new Date(a.annotationCreatedAt).getTime()
      )
      const positive = sorted.filter((c) => c.isPositive)
      const negative = sorted.filter((c) => !c.isPositive)
      const picked: typeof cases = []

      if (negative.length > 0) picked.push(negative[0])
      if (positive.length > 0) picked.push(positive[0])
      if (picked.length === 0 && sorted.length > 0) picked.push(sorted[0])

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

  const drillDownDimensionTrend = useMemo(() => {
    if (!drillDownStoreId) return []
    const storeDimData = DIMENSION_WEEKLY_DATA[drillDownStoreId]
    if (!storeDimData) return []

    if (selectedDimension === 'all') {
      return WEEK_LABELS.map((week, idx) => {
        const entry: Record<string, string | number> = { week }
        DIMENSION_KEYS.forEach((dim) => {
          entry[WEAKNESS_DIMENSION_LABELS[dim]] = storeDimData[dim]?.[idx] ?? 3.0
        })
        return entry
      })
    } else {
      const scores = storeDimData[selectedDimension] ?? []
      return WEEK_LABELS.map((week, idx) => ({
        week,
        [WEAKNESS_DIMENSION_LABELS[selectedDimension]]: scores[idx] ?? 3.0,
      }))
    }
  }, [drillDownStoreId, selectedDimension])

  const drillDownRecordings = useMemo(() => {
    if (!drillDownStoreId) return []
    const dimTags = selectedDimension === 'all' ? [] : DIMENSION_TAGS[selectedDimension]

    const annotatedRecs = storeRecordings
      .filter((r) => r.storeId === drillDownStoreId && r.isAnnotated)
      .filter((r) => {
        if (dimTags.length === 0) return true
        const recAnnotations = storeAnnotations.filter((a) => a.recordingId === r.id)
        return recAnnotations.some((a) => a.tags.some((t) => dimTags.includes(t as TagType)))
      })
      .sort((a, b) => {
        const aLatestAnn = storeAnnotations
          .filter((ann) => ann.recordingId === a.id)
          .sort((x, y) => new Date(y.createdAt).getTime() - new Date(x.createdAt).getTime())[0]
        const bLatestAnn = storeAnnotations
          .filter((ann) => ann.recordingId === b.id)
          .sort((x, y) => new Date(y.createdAt).getTime() - new Date(x.createdAt).getTime())[0]
        const aTime = aLatestAnn ? new Date(aLatestAnn.createdAt).getTime() : 0
        const bTime = bLatestAnn ? new Date(bLatestAnn.createdAt).getTime() : 0
        return bTime - aTime
      })
      .slice(0, 8)

    if (annotatedRecs.length >= 8) return annotatedRecs

    const otherRecs = storeRecordings
      .filter((r) => r.storeId === drillDownStoreId && !r.isAnnotated)
      .filter((r) => !annotatedRecs.some((ar) => ar.id === r.id))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 8 - annotatedRecs.length)

    return [...annotatedRecs, ...otherRecs]
  }, [drillDownStoreId, selectedDimension, storeRecordings, storeAnnotations])

  const storeTrainingItems = useMemo(() => {
    if (!drillDownStoreId) return []
    return trainingItems
      .filter((t) => t.storeId === drillDownStoreId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [trainingItems, drillDownStoreId])

  const selectedStores = useMemo(
    () => stores.filter((s) => selectedIds.includes(s.id)),
    [selectedIds]
  )

  const drillDownStore = useMemo(
    () => stores.find((s) => s.id === drillDownStoreId) ?? null,
    [drillDownStoreId]
  )

  const getRecordingLatestAnnotation = (recordingId: string) => {
    const anns = storeAnnotations
      .filter((a) => a.recordingId === recordingId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    return anns[0] ?? null
  }

  const toggleRecordingSelection = (recordingId: string) => {
    setSelectedRecordingIds((prev) => {
      const next = new Set(prev)
      if (next.has(recordingId)) next.delete(recordingId)
      else next.add(recordingId)
      return next
    })
  }

  const addSelectedToTraining = () => {
    if (selectedRecordingIds.size === 0 || !drillDownStoreId) return
    const defaultOwner = quickOwner.trim() || '待分配'
    const defaultDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const dim: WeaknessDimension = selectedDimension === 'all' ? 'followup_guidance' : selectedDimension

    Array.from(selectedRecordingIds).forEach((recId) => {
      if (trainingItems.some((t) => t.recordingId === recId)) return
      addTrainingItem({
        storeId: drillDownStoreId,
        recordingId: recId,
        dimension: dim,
        owner: defaultOwner,
        planDate: defaultDate,
        status: 'pending',
        note: '',
      })
    })
    setSelectedRecordingIds(new Set())
  }

  const startEdit = (itemId: string) => {
    const item = trainingItems.find((t) => t.id === itemId)
    if (!item) return
    setEditingTrainingId(itemId)
    setEditOwner(item.owner)
    setEditPlanDate(item.planDate)
    setEditStatus(item.status)
    setEditNote(item.note)
  }

  const saveEdit = () => {
    if (!editingTrainingId) return
    updateTrainingItem(editingTrainingId, {
      owner: editOwner.trim() || '待分配',
      planDate: editPlanDate,
      status: editStatus,
      note: editNote,
    })
    setEditingTrainingId(null)
  }

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold text-slate-800">门店对比</h1>
          <p className="text-sm text-slate-400 mt-1">
            {drillDownStore ? `${drillDownStore.name} · 培训诊断与动作跟进` : '多门店质检数据横向对比与培训诊断'}
          </p>
        </div>
        {drillDownStore && (
          <button
            onClick={() => { setDrillDownStoreId(null); setSelectedDimension('all') }}
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
                const pendingTraining = trainingItems.filter(t => t.storeId === store.id && t.status !== 'completed').length
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
                        <span className="text-xs text-slate-400">待培训</span>
                        <span className={`text-sm font-semibold ${pendingTraining > 0 ? 'text-orange-600' : 'text-slate-400'}`}>
                          {pendingTraining}条
                        </span>
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
              <span className="text-xs text-slate-400">（最新标注优先，仅展示医生编码）</span>
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
                    onClick={() => { setDrillDownStoreId(alert.storeId); setSelectedDimension(alert.dimension ?? 'all') }}
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
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Store className="w-10 h-10 text-primary" />
                <div>
                  <h2 className="font-serif text-xl font-bold text-slate-800">{drillDownStore?.name}</h2>
                  <p className="text-sm text-slate-500 mt-0.5">
                    区域：{drillDownStore?.region} · 健康分：{drillDownStore?.healthScore}分
                    {storeTrainingItems.length > 0 && ` · 培训中：${storeTrainingItems.filter(t => t.status === 'in_progress').length}条 · 待开始：${storeTrainingItems.filter(t => t.status === 'pending').length}条`}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center gap-3 mb-5">
              <Target className="w-5 h-5 text-primary" />
              <h3 className="font-serif text-lg font-semibold text-slate-700">薄弱项维度诊断</h3>
              <span className="text-xs text-slate-400">（点击维度可查看趋势和相关案例）</span>
            </div>
            <div className="flex flex-wrap gap-2 mb-5">
              <button
                onClick={() => setSelectedDimension('all')}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  selectedDimension === 'all'
                    ? 'bg-primary text-white shadow-sm'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                全部维度
              </button>
              {DIMENSION_KEYS.map((dim) => {
                const score = dimensionScores[drillDownStoreId]?.[dim] ?? 0
                const isWeak = score < 3.2
                const isActive = selectedDimension === dim
                return (
                  <button
                    key={dim}
                    onClick={() => setSelectedDimension(dim)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${
                      isActive
                        ? isWeak
                          ? 'bg-orange-500 text-white shadow-sm'
                          : 'bg-emerald-500 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    {WEAKNESS_DIMENSION_LABELS[dim]}
                    <span className={`text-xs ${isActive ? 'text-white/90' : 'text-slate-400'}`}>
                      {score.toFixed(1)}
                    </span>
                    {isWeak && !isActive && (
                      <span className="w-2 h-2 rounded-full bg-orange-400" />
                    )}
                  </button>
                )
              })}
            </div>
            <div className="space-y-4">
              {(selectedDimension === 'all' ? DIMENSION_KEYS : [selectedDimension]).map((dim) => {
                const score = dimensionScores[drillDownStoreId]?.[dim] ?? 0
                const isWeak = score < 3.2
                return (
                  <div key={dim} className="flex items-center gap-4">
                    <span className="text-sm text-slate-600 w-28 shrink-0">
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
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <TrendingUp className="w-5 h-5 text-primary" />
                <h3 className="font-serif text-lg font-semibold text-slate-700">
                  {selectedDimension === 'all' ? '各维度周趋势' : `${WEAKNESS_DIMENSION_LABELS[selectedDimension]} · 周趋势`}
                </h3>
              </div>
              <span className="text-xs text-slate-400">
                {selectedDimension === 'all' ? '点击上方维度可单独查看' : '基于历史标注数据统计'}
              </span>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={drillDownDimensionTrend} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="week" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
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
                {selectedDimension === 'all' && <Legend />}
                {(selectedDimension === 'all' ? DIMENSION_KEYS : [selectedDimension]).map((dim, idx) => {
                  const colors = ['#0D9488', '#F97316', '#3B82F6', '#8B5CF6', '#EC4899']
                  const color = selectedDimension === 'all' ? colors[idx] : STORE_COLORS[drillDownStoreId] ?? '#0D9488'
                  return (
                    <Line
                      key={dim}
                      type="monotone"
                      dataKey={WEAKNESS_DIMENSION_LABELS[dim]}
                      stroke={color}
                      strokeWidth={selectedDimension === 'all' ? 2 : 3}
                      dot={{ r: 4, fill: color }}
                      activeDot={{ r: 6 }}
                    />
                  )
                })}
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <ListTodo className="w-5 h-5 text-primary" />
                <h3 className="font-serif text-lg font-semibold text-slate-700">培训动作清单</h3>
                <span className="text-xs text-slate-400">共{storeTrainingItems.length}条</span>
              </div>
            </div>

            {storeTrainingItems.length === 0 ? (
              <div className="py-8 text-center text-sm text-slate-400">
                还没有培训安排，可在下方案例中勾选录音加入培训清单
              </div>
            ) : (
              <div className="space-y-2">
                {storeTrainingItems.map((item) => {
                  const rec = storeRecordings.find((r) => r.id === item.recordingId)
                  const isEditing = editingTrainingId === item.id
                  return (
                    <div
                      key={item.id}
                      className="border border-slate-100 rounded-lg p-4 hover:bg-slate-50/50 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <span
                              className="inline-block px-2 py-0.5 rounded-full text-[11px] font-medium text-white"
                              style={{ backgroundColor: rec ? SCENARIO_COLORS[rec.scenario] : '#94a3b8' }}
                            >
                              {rec ? SCENARIO_LABELS[rec.scenario] : '场景'}
                            </span>
                            <span className="text-xs text-slate-500">
                              {WEAKNESS_DIMENSION_LABELS[item.dimension]}
                            </span>
                            <span className="text-xs text-slate-400">·</span>
                            <span className="text-xs text-slate-500">{rec?.doctorCode ?? '—'}</span>
                            <span className="text-xs text-slate-400">·</span>
                            <span className="text-xs text-slate-400">{rec?.date ?? ''}</span>
                          </div>
                          {rec && (
                            <p className="text-xs text-slate-500 mb-2 line-clamp-1">
                              {rec.summary.patientConcern}
                            </p>
                          )}

                          {isEditing ? (
                            <div className="grid grid-cols-4 gap-2 mt-3 pt-3 border-t border-slate-100">
                              <div>
                                <label className="text-[10px] text-slate-400 mb-1 block">负责人</label>
                                <input
                                  type="text"
                                  value={editOwner}
                                  onChange={(e) => setEditOwner(e.target.value)}
                                  className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] text-slate-400 mb-1 block">计划日期</label>
                                <input
                                  type="date"
                                  value={editPlanDate}
                                  onChange={(e) => setEditPlanDate(e.target.value)}
                                  className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] text-slate-400 mb-1 block">状态</label>
                                <select
                                  value={editStatus}
                                  onChange={(e) => setEditStatus(e.target.value as TrainingStatus)}
                                  className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                                >
                                  {(['pending', 'in_progress', 'completed'] as TrainingStatus[]).map((s) => (
                                    <option key={s} value={s}>{TRAINING_STATUS_LABELS[s]}</option>
                                  ))}
                                </select>
                              </div>
                              <div className="flex items-end gap-1">
                                <button
                                  onClick={saveEdit}
                                  className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-primary text-white rounded text-xs font-medium hover:bg-primary-dark transition-colors"
                                >
                                  <Save className="w-3 h-3" />
                                  保存
                                </button>
                                <button
                                  onClick={() => setEditingTrainingId(null)}
                                  className="px-2 py-1.5 bg-slate-100 text-slate-500 rounded text-xs hover:bg-slate-200 transition-colors"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-3 text-xs">
                              <div className="flex items-center gap-1">
                                <User className="w-3 h-3 text-slate-300" />
                                <span className="text-slate-600">{item.owner}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <CalendarDays className="w-3 h-3 text-slate-300" />
                                <span className="text-slate-600">{item.planDate}</span>
                              </div>
                              <span
                                className="inline-block px-2 py-0.5 rounded text-[11px] font-medium text-white"
                                style={{ backgroundColor: TRAINING_STATUS_COLORS[item.status] }}
                              >
                                {TRAINING_STATUS_LABELS[item.status]}
                              </span>
                              {item.note && (
                                <span className="text-slate-400 ml-2">备注：{item.note}</span>
                              )}
                              <div className="ml-auto flex items-center gap-1">
                                <button
                                  onClick={() => startEdit(item.id)}
                                  className="p-1.5 text-slate-400 hover:text-primary hover:bg-slate-100 rounded transition-colors"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => removeTrainingItem(item.id)}
                                  className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <Stethoscope className="w-5 h-5 text-primary" />
                <h3 className="font-serif text-lg font-semibold text-slate-700">
                  {selectedDimension === 'all' ? '代表接诊记录' : `${WEAKNESS_DIMENSION_LABELS[selectedDimension]} · 相关案例`}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                {selectedRecordingIds.size > 0 && (
                  <>
                    <input
                      type="text"
                      value={quickOwner}
                      onChange={(e) => setQuickOwner(e.target.value)}
                      placeholder="默认负责人（可选）"
                      className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary w-32"
                    />
                    <button
                      onClick={addSelectedToTraining}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-accent text-white rounded-lg text-xs font-medium hover:bg-accent/90 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      加入培训清单（{selectedRecordingIds.size}）
                    </button>
                  </>
                )}
                <span className="text-xs text-slate-400">
                  {selectedDimension === 'all'
                    ? `共 ${storeRecordings.filter(r => r.storeId === drillDownStoreId).length} 条，最新标注优先`
                    : `筛选到 ${drillDownRecordings.length} 条相关记录`
                  }
                </span>
              </div>
            </div>
            <div className="space-y-3">
              {drillDownRecordings.map((rec) => {
                const latestAnn = getRecordingLatestAnnotation(rec.id)
                const hasNegative = latestAnn?.tags.some(t => TAG_CATEGORY[t as TagType] === 'negative') ?? false
                const tagsToShow = latestAnn?.tags ?? []
                const isSelected = selectedRecordingIds.has(rec.id)
                const inTraining = trainingItems.some((t) => t.recordingId === rec.id)
                return (
                  <div
                    key={rec.id}
                    className={`rounded-lg border p-4 transition-all hover:shadow-sm ${
                      isSelected
                        ? 'border-accent bg-accent/5'
                        : hasNegative ? 'border-red-100 bg-red-50/30' : 'border-slate-100'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="shrink-0 pt-0.5">
                        {inTraining ? (
                          <div className="w-5 h-5 rounded bg-emerald-100 flex items-center justify-center" title="已在培训清单">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          </div>
                        ) : (
                          <button
                            onClick={() => toggleRecordingSelection(rec.id)}
                            className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                              isSelected
                                ? 'bg-accent border-accent text-white'
                                : 'border-slate-300 hover:border-accent'
                            }`}
                          >
                            {isSelected && <CheckCircle2 className="w-3 h-3" />}
                          </button>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
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
                          {rec.isAnnotated && latestAnn && (
                            <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                              <Sparkles className="w-2.5 h-2.5" />
                              已标注
                            </span>
                          )}
                          {inTraining && (
                            <span className="text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                              <ListTodo className="w-2.5 h-2.5" />
                              培训中
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-3 gap-3 text-xs mb-3">
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
                        {tagsToShow.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {tagsToShow.slice(0, 6).map((tag) => (
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
                        )}
                        {latestAnn?.suggestion && (
                          <div className="mt-2 pt-2 border-t border-slate-100">
                            <p className="text-xs text-slate-500">
                              <span className="text-amber-600 font-medium">改进建议：</span>
                              {latestAnn.suggestion}
                            </p>
                          </div>
                        )}
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
