import { useMemo, useState, Fragment } from 'react'
import { useNavigate } from 'react-router-dom'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis } from 'recharts'
import { stores, scriptEntries } from '@/data/mockData'
import { SCENARIO_LABELS, TAG_LABELS, TAG_CATEGORY, type ScenarioType, type TagType } from '@/types'
import { useStore } from '@/store/useStore'
import {
  ClipboardList, AlertTriangle, FileAudio, BookPlus, ChevronRight, GitCompareArrows,
  ClipboardCheck, ListTodo, UserX, Clock as ClockIcon, AlertCircle, FileText,
} from 'lucide-react'

type TodoType = 'pending_annotation' | 'unassigned' | 'near_deadline' | 'overdue'

const SCENARIO_COLORS: Record<ScenarioType, string> = {
  implant: '#0D9488',
  orthodontic: '#F97316',
  pediatric: '#8B5CF6',
  cleaning: '#3B82F6',
}

const TODO_META: Record<TodoType, { label: string; icon: any; badge: string; dot: string }> = {
  pending_annotation: {
    label: '待标注录音',
    icon: FileAudio,
    badge: 'bg-violet-500',
    dot: 'bg-violet-400',
  },
  unassigned: {
    label: '未分配负责人',
    icon: UserX,
    badge: 'bg-slate-500',
    dot: 'bg-slate-400',
  },
  near_deadline: {
    label: '3天内到期',
    icon: ClockIcon,
    badge: 'bg-amber-500',
    dot: 'bg-amber-400',
  },
  overdue: {
    label: '逾期未跟进',
    icon: AlertCircle,
    badge: 'bg-red-500',
    dot: 'bg-red-400',
  },
}

export default function Dashboard() {
  const navigate = useNavigate()
  const storeRecordings = useStore((s) => s.recordings)
  const storeAnnotations = useStore((s) => s.annotations)
  const trainingItems = useStore((s) => s.trainingItems)
  const setCurrentRecording = useStore((s) => s.setCurrentRecording)

  const weeklyInspectionTotal = useMemo(() => storeRecordings.length, [storeRecordings])

  const top5IssueTags = useMemo(() => {
    const tagCounts: Record<string, number> = {}
    storeAnnotations.forEach((a) => {
      a.tags.forEach((tag) => {
        if (TAG_CATEGORY[tag as TagType] === 'negative') {
          tagCounts[tag] = (tagCounts[tag] || 0) + 1
        }
      })
    })
    return Object.entries(tagCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([tag, count]) => ({ tag: tag as TagType, label: TAG_LABELS[tag as TagType], count }))
  }, [storeAnnotations])

  const pendingRecordingsCount = useMemo(
    () => storeRecordings.filter((r) => !r.isAnnotated).length,
    [storeRecordings]
  )

  const newScriptEntriesCount = useMemo(() => scriptEntries.length, [])

  const scenarioDistribution = useMemo(() => {
    const counts: Record<string, number> = {}
    storeRecordings.forEach((r) => {
      counts[r.scenario] = (counts[r.scenario] || 0) + 1
    })
    return (Object.keys(SCENARIO_LABELS) as ScenarioType[]).map((key) => ({
      name: SCENARIO_LABELS[key],
      value: counts[key] || 0,
      scenario: key,
    }))
  }, [storeRecordings])

  const storeHealthRanking = useMemo(
    () => [...stores].sort((a, b) => b.healthScore - a.healthScore),
    []
  )

  const heatmapData = useMemo(() => {
    const tagTypes = Object.keys(TAG_LABELS) as TagType[]
    const recordingMap = new Map(storeRecordings.map((r) => [r.id, r]))
    const matrix: Record<string, Record<string, number>> = {}
    stores.forEach((s) => {
      matrix[s.id] = {}
      tagTypes.forEach((t) => {
        matrix[s.id][t] = 0
      })
    })
    storeAnnotations.forEach((a) => {
      const rec = recordingMap.get(a.recordingId)
      if (rec) {
        a.tags.forEach((tag) => {
          if (matrix[rec.storeId]) {
            matrix[rec.storeId][tag] = (matrix[rec.storeId][tag] || 0) + 1
          }
        })
      }
    })
    let maxVal = 0
    Object.values(matrix).forEach((row) => {
      Object.values(row).forEach((v) => {
        if (v > maxVal) maxVal = v
      })
    })
    return { matrix, tagTypes, maxVal }
  }, [storeAnnotations])

  const recentAnnotations = useMemo(() => {
    const recordingMap = new Map(storeRecordings.map((r) => [r.id, r]))
    return [...storeAnnotations]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10)
      .map((a) => {
        const rec = recordingMap.get(a.recordingId)
        return {
          ...a,
          storeId: rec?.storeId,
          scenario: rec?.scenario,
          scenarioLabel: rec ? SCENARIO_LABELS[rec.scenario] : '-',
          storeName: rec?.storeName ?? '-',
          doctorCode: rec?.doctorCode ?? '',
        }
      })
  }, [storeAnnotations])

  const [hoveredCell, setHoveredCell] = useState<{ storeId: string; tag: TagType } | null>(null)

  const operatorTodos = useMemo(() => {
    type Row = {
      type: TodoType
      id: string
      title: string
      meta: string
      primary: string
      action: () => void
    }
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const in3Days = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000)
    const rows: Row[] = []

    const pendingRec = storeRecordings.filter((r) => !r.isAnnotated).slice(0, 5)
    pendingRec.forEach((r) => {
      rows.push({
        type: 'pending_annotation',
        id: `pa_${r.id}`,
        title: `${SCENARIO_LABELS[r.scenario]} · ${r.doctorCode}`,
        meta: `${r.date} · ${Math.floor(r.duration / 60)}分${r.duration % 60}秒`,
        primary: r.storeName ?? '',
        action: () => {
          setCurrentRecording(r.id)
          navigate('/annotation')
        },
      })
    })

    trainingItems
      .filter((t) => t.status !== 'completed' && (t.owner === '待分配' || !t.owner.trim()))
      .slice(0, 5)
      .forEach((t) => {
        const r = storeRecordings.find((x) => x.id === t.recordingId)
        rows.push({
          type: 'unassigned',
          id: `ua_${t.id}`,
          title: `${SCENARIO_LABELS[r?.scenario ?? 'implant']} · ${r?.doctorCode ?? '-'}`,
          meta: `计划：${t.planDate}`,
          primary: r?.storeName ?? '',
          action: () =>
            navigate('/comparison', {
              state: { drillDownStoreId: t.storeId, highlightRecordingId: t.recordingId },
            }),
        })
      })

    trainingItems
      .filter((t) => {
        if (t.status === 'completed') return false
        const d = new Date(t.planDate)
        d.setHours(0, 0, 0, 0)
        return d.getTime() >= today.getTime() && d.getTime() <= in3Days.getTime()
      })
      .slice(0, 5)
      .forEach((t) => {
        const r = storeRecordings.find((x) => x.id === t.recordingId)
        rows.push({
          type: 'near_deadline',
          id: `nd_${t.id}`,
          title: `${t.owner} · ${SCENARIO_LABELS[r?.scenario ?? 'implant']}`,
          meta: `计划：${t.planDate}`,
          primary: r?.storeName ?? '',
          action: () =>
            navigate('/comparison', {
              state: { drillDownStoreId: t.storeId, highlightRecordingId: t.recordingId },
            }),
        })
      })

    trainingItems
      .filter((t) => {
        if (t.status === 'completed') return false
        const d = new Date(t.planDate)
        d.setHours(0, 0, 0, 0)
        return d.getTime() < today.getTime()
      })
      .slice(0, 5)
      .forEach((t) => {
        const r = storeRecordings.find((x) => x.id === t.recordingId)
        rows.push({
          type: 'overdue',
          id: `ov_${t.id}`,
          title: `${t.owner} · ${SCENARIO_LABELS[r?.scenario ?? 'implant']}`,
          meta: `逾期：${t.planDate}`,
          primary: r?.storeName ?? '',
          action: () =>
            navigate('/comparison', {
              state: { drillDownStoreId: t.storeId, highlightRecordingId: t.recordingId },
            }),
        })
      })

    const counts: Record<TodoType, number> = {
      pending_annotation: pendingRec.length,
      unassigned: trainingItems.filter(
        (t) => t.status !== 'completed' && (t.owner === '待分配' || !t.owner.trim())
      ).length,
      near_deadline: trainingItems.filter((t) => {
        if (t.status === 'completed') return false
        const d = new Date(t.planDate)
        d.setHours(0, 0, 0, 0)
        return d.getTime() >= today.getTime() && d.getTime() <= in3Days.getTime()
      }).length,
      overdue: trainingItems.filter((t) => {
        if (t.status === 'completed') return false
        const d = new Date(t.planDate)
        d.setHours(0, 0, 0, 0)
        return d.getTime() < today.getTime()
      }).length,
    }
    return { rows, counts }
  }, [storeRecordings, trainingItems, setCurrentRecording, navigate])

  const overviewCards = [
    {
      title: '本周质检总量',
      value: weeklyInspectionTotal,
      icon: ClipboardList,
      gradient: 'from-teal-500 to-teal-700',
      delay: 'animation-delay-100',
    },
    {
      title: 'Top5 问题标签',
      value: top5IssueTags.length,
      icon: AlertTriangle,
      gradient: 'from-orange-400 to-orange-600',
      delay: 'animation-delay-200',
      sub: top5IssueTags.map((t) => t.label).join('、'),
    },
    {
      title: '待标注录音',
      value: pendingRecordingsCount,
      icon: FileAudio,
      gradient: 'from-violet-500 to-violet-700',
      delay: 'animation-delay-300',
    },
    {
      title: '话术库新增',
      value: newScriptEntriesCount,
      icon: BookPlus,
      gradient: 'from-blue-500 to-blue-700',
      delay: 'animation-delay-400',
    },
  ]

  const getHeatmapColor = (value: number, max: number) => {
    if (value === 0) return 'bg-slate-100'
    const intensity = value / max
    if (intensity > 0.7) return 'bg-red-500'
    if (intensity > 0.5) return 'bg-orange-400'
    if (intensity > 0.3) return 'bg-amber-300'
    if (intensity > 0.1) return 'bg-yellow-200'
    return 'bg-teal-100'
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="font-serif text-2xl font-bold text-slate-800">质检看板</h1>
        <p className="text-sm text-slate-400 mt-1">连锁口腔运营数据总览与话术质量洞察</p>
      </div>

      <div className="grid grid-cols-4 gap-5 mb-8">
        {overviewCards.map((card) => (
          <div
            key={card.title}
            className={`animate-fade-in-up ${card.delay} rounded-xl shadow-sm hover:shadow-md transition-shadow bg-white overflow-hidden`}
          >
            <div className={`bg-gradient-to-r ${card.gradient} px-5 py-4 flex items-center justify-between`}>
              <div>
                <p className="text-white/80 text-xs">{card.title}</p>
                <p className="text-white text-3xl font-bold mt-1">{card.value}</p>
              </div>
              <card.icon className="w-10 h-10 text-white/30" />
            </div>
            {card.sub && (
              <div className="px-5 py-3">
                <p className="text-xs text-slate-500 truncate">{card.sub}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-5 mb-8">
        <div className="bg-white rounded-xl shadow-sm p-6 animate-fade-in-up animation-delay-100">
          <h2 className="font-serif text-lg font-semibold text-slate-700 mb-4">场景分布</h2>
          <div className="flex items-center">
            <ResponsiveContainer width="60%" height={260}>
              <PieChart>
                <Pie
                  data={scenarioDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={95}
                  paddingAngle={3}
                  dataKey="value"
                  stroke="none"
                >
                  {scenarioDistribution.map((entry) => (
                    <Cell key={entry.scenario} fill={SCENARIO_COLORS[entry.scenario as ScenarioType]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number, name: string) => [`${value} 条`, name]}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-3">
              {scenarioDistribution.map((entry) => (
                <div key={entry.scenario} className="flex items-center gap-3">
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: SCENARIO_COLORS[entry.scenario as ScenarioType] }}
                  />
                  <span className="text-sm text-slate-600 flex-1">{entry.name}</span>
                  <span className="text-sm font-semibold text-slate-800">{entry.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 animate-fade-in-up animation-delay-200">
          <h2 className="font-serif text-lg font-semibold text-slate-700 mb-4">门店健康排名</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={storeHealthRanking} layout="vertical" margin={{ left: 10, right: 30 }}>
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis
                type="category"
                dataKey="name"
                width={110}
                tick={{ fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                formatter={(value: number) => [`${value} 分`, '健康分']}
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
              />
              <Bar dataKey="healthScore" radius={[0, 6, 6, 0]} barSize={20}>
                {storeHealthRanking.map((entry, index) => {
                  const ratio = entry.healthScore / 100
                  const r = Math.round(13 + (249 - 13) * (1 - ratio))
                  const g = Math.round(148 + (115 - 148) * (1 - ratio))
                  const b = Math.round(136 + (22 - 136) * (1 - ratio))
                  return <Cell key={index} fill={`rgb(${r},${g},${b})`} />
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6 mb-8 animate-fade-in-up animation-delay-300">
        <h2 className="font-serif text-lg font-semibold text-slate-700 mb-4">问题标签热力图</h2>
        <div className="overflow-x-auto">
          <div className="inline-block min-w-full">
            <div
              className="grid gap-1"
              style={{
                gridTemplateColumns: `100px repeat(${stores.length}, minmax(70px, 1fr))`,
              }}
            >
              <div />
              {stores.map((s) => (
                <div key={s.id} className="text-xs text-slate-500 text-center truncate py-1 font-medium">
                  {s.name.replace(/店$/, '')}
                </div>
              ))}

              {heatmapData.tagTypes.map((tag) => (
                <Fragment key={tag}>
                  <div className="text-xs text-slate-500 truncate py-1 pr-2 flex items-center">
                    {TAG_LABELS[tag]}
                  </div>
                  {stores.map((s) => {
                    const value = heatmapData.matrix[s.id]?.[tag] || 0
                    const isHovered = hoveredCell?.storeId === s.id && hoveredCell?.tag === tag
                    return (
                      <div
                        key={`${s.id}-${tag}`}
                        className={`relative rounded aspect-square flex items-center justify-center text-xs font-medium cursor-default transition-transform ${getHeatmapColor(value, heatmapData.maxVal)} ${isHovered ? 'scale-110 z-10' : ''}`}
                        onMouseEnter={() => setHoveredCell({ storeId: s.id, tag })}
                        onMouseLeave={() => setHoveredCell(null)}
                      >
                        {value > 0 && <span className="text-slate-700">{value}</span>}
                        {isHovered && (
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-slate-800 text-white text-xs px-3 py-1.5 rounded-lg whitespace-nowrap z-20 shadow-lg">
                            {s.name} · {TAG_LABELS[tag]}：{value}次
                            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-slate-800" />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </Fragment>
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-4 text-xs text-slate-400">
          <span>频率：</span>
          <span className="w-4 h-4 rounded bg-slate-100" /> 低
          <span className="w-4 h-4 rounded bg-yellow-200" />
          <span className="w-4 h-4 rounded bg-amber-300" />
          <span className="w-4 h-4 rounded bg-orange-400" />
          <span className="w-4 h-4 rounded bg-red-500" /> 高
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6 mb-8 animate-fade-in-up animation-delay-350">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ListTodo className="w-5 h-5 text-primary" />
            <h2 className="font-serif text-lg font-semibold text-slate-700">运营待办</h2>
          </div>
          <div className="flex items-center gap-3 text-xs">
            {(Object.keys(TODO_META) as TodoType[]).map((t) => (
              <div key={t} className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${TODO_META[t].dot}`} />
                <span className="text-slate-500">{TODO_META[t].label}</span>
                <span className={`px-1.5 py-0.5 rounded text-white font-semibold ${TODO_META[t].badge}`}>
                  {operatorTodos.counts[t]}
                </span>
              </div>
            ))}
          </div>
        </div>
        {operatorTodos.rows.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-400">
            暂无待办事项，干得漂亮 👍
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {operatorTodos.rows.map((row) => {
              const meta = TODO_META[row.type]
              const Icon = meta.icon
              return (
                <button
                  key={row.id}
                  onClick={row.action}
                  className="flex items-start gap-3 p-3 rounded-lg border border-slate-100 hover:border-primary/40 hover:bg-primary/5 transition-colors text-left group"
                >
                  <div
                    className={`p-2 rounded-lg ${meta.badge} shrink-0`}
                  >
                    <Icon className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-medium text-slate-700 truncate">{row.title}</span>
                      <span
                        className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium text-white ${meta.badge}`}
                      >
                        {meta.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      {row.primary && <span className="truncate">{row.primary}</span>}
                      {row.primary && <span>·</span>}
                      <span className="truncate">{row.meta}</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-primary shrink-0 mt-1 transition-colors" />
                </button>
              )
            })}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6 animate-fade-in-up animation-delay-400">
        <h2 className="font-serif text-lg font-semibold text-slate-700 mb-4">最近标注记录</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left py-3 px-3 text-slate-400 font-medium">场景</th>
                <th className="text-left py-3 px-3 text-slate-400 font-medium">标签</th>
                <th className="text-left py-3 px-3 text-slate-400 font-medium">门店</th>
                <th className="text-left py-3 px-3 text-slate-400 font-medium">标注人</th>
                <th className="text-left py-3 px-3 text-slate-400 font-medium">时间</th>
                <th className="text-left py-3 px-3 text-slate-400 font-medium">建议</th>
                <th className="text-left py-3 px-3 text-slate-400 font-medium w-44">操作</th>
              </tr>
            </thead>
            <tbody>
              {recentAnnotations.map((a) => (
                <tr key={a.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                  <td className="py-3 px-3">
                    {a.scenario && (
                      <span
                        className="inline-block px-2 py-0.5 rounded-full text-xs font-medium text-white"
                        style={{ backgroundColor: SCENARIO_COLORS[a.scenario as ScenarioType] }}
                      >
                        {a.scenarioLabel}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-3">
                    <div className="flex flex-wrap gap-1">
                      {a.tags.map((tag) => (
                        <button
                          key={tag}
                          onClick={() =>
                            navigate('/ledger', {
                              state: {
                                filterStore: a.storeId ?? 'all',
                                filterTag: tag,
                                filterScenario: 'all',
                                filterKeyword: '',
                                highlightAnnotationId: a.id,
                                highlightRecordingId: a.recordingId,
                              },
                            })
                          }
                          className={`inline-block px-2 py-0.5 rounded text-xs hover:opacity-80 transition-opacity ${
                            TAG_CATEGORY[tag as TagType] === 'positive'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-red-50 text-red-600'
                          }`}
                        >
                          {TAG_LABELS[tag as TagType]}
                        </button>
                      ))}
                    </div>
                  </td>
                  <td className="py-3 px-3 text-slate-600 font-medium">{a.storeName}</td>
                  <td className="py-3 px-3 text-slate-500">{a.annotator}</td>
                  <td className="py-3 px-3 text-slate-400 whitespace-nowrap">
                    {new Date(a.createdAt).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="py-3 px-3 text-slate-500 max-w-xs truncate">{a.suggestion}</td>
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-1">
                      {a.storeId && (
                        <button
                          onClick={() =>
                            navigate('/comparison', {
                              state: {
                                drillDownStoreId: a.storeId,
                                highlightRecordingId: a.recordingId,
                              },
                            })
                          }
                          className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-primary/10 text-primary hover:bg-primary/20 text-xs font-medium transition-colors"
                          title="跳转到门店详情并定位该录音"
                        >
                          <GitCompareArrows className="w-3 h-3" />
                          门店
                        </button>
                      )}
                      <button
                        onClick={() =>
                          navigate('/ledger', {
                            state: {
                              filterStore: a.storeId ?? 'all',
                              filterScenario: (a.scenario as ScenarioType) ?? 'all',
                              filterTag: 'all',
                              filterKeyword: a.suggestion.slice(0, 8),
                              highlightAnnotationId: a.id,
                              highlightRecordingId: a.recordingId,
                            },
                          })
                        }
                        className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-100 text-slate-600 hover:bg-slate-200 text-xs font-medium transition-colors"
                        title="跳转到台账并定位该记录"
                      >
                        <ClipboardCheck className="w-3 h-3" />
                        台账
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
