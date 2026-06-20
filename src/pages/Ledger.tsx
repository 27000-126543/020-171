import { useState, useMemo } from 'react'
import { useStore } from '@/store/useStore'
import { TAG_LABELS, TAG_CATEGORY, SCENARIO_LABELS, type TagType, type ScenarioType } from '@/types'
import { stores } from '@/data/mockData'
import {
  Search, Filter, Clock, Building2, User, FileText,
  Calendar, Tag, MessageSquare, ListFilter, X, BarChart3, List,
  PieChart, TrendingUp, ChevronRight, ArrowRight,
} from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'

type TabMode = 'summary' | 'list'

const KEYWORD_STOP_WORDS = new Set([
  '的', '了', '是', '在', '和', '有', '不', '这', '我', '你', '他',
  '就', '都', '也', '要', '会', '可以', '好', '请', '让', '把', '给',
  '对', '更', '能', '需要', '进行', '一个', '一下', '不要', '应该',
  '可能', '一些', '比较', '没有', '已经', '还是', '还是', '这样',
])

function extractKeywords(texts: string[], topN = 10): { word: string; count: number }[] {
  const freq = new Map<string, number>()
  texts.forEach((text) => {
    const clean = text
      .replace(/[，。！？；：、（）""''【】\s]/g, ' ')
      .replace(/[!?,;:"'()\[\]\.]/g, ' ')
    const tokens = clean.split(/\s+/).filter((t) => t.length >= 2 && !KEYWORD_STOP_WORDS.has(t))
    tokens.forEach((t) => {
      freq.set(t, (freq.get(t) ?? 0) + 1)
    })
    for (let len = 2; len <= 4; len++) {
      for (let i = 0; i <= text.length - len; i++) {
        const slice = text.slice(i, i + len)
        if (/^[\u4e00-\u9fa5]+$/.test(slice) && !KEYWORD_STOP_WORDS.has(slice)) {
          freq.set(slice, (freq.get(slice) ?? 0) + 1)
        }
      }
    }
  })
  return Array.from(freq.entries())
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, topN)
}

export default function Ledger() {
  const navigate = useNavigate()
  const location = useLocation()

  const annotations = useStore((s) => s.annotations)
  const recordings = useStore((s) => s.recordings)

  const state = (location.state as { filterStore?: string; filterScenario?: ScenarioType | 'all'; filterTag?: TagType | 'all'; filterKeyword?: string } | null) ?? {}

  const [tabMode, setTabMode] = useState<TabMode>('summary')
  const [filterStore, setFilterStore] = useState<string>(state.filterStore ?? 'all')
  const [filterScenario, setFilterScenario] = useState<ScenarioType | 'all'>(state.filterScenario ?? 'all')
  const [filterTag, setFilterTag] = useState<TagType | 'all'>(state.filterTag ?? 'all')
  const [filterKeyword, setFilterKeyword] = useState(state.filterKeyword ?? '')
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc')

  const enrichedAnnotations = useMemo(() => {
    return annotations
      .map((ann) => {
        const rec = recordings.find((r) => r.id === ann.recordingId)
        return { ...ann, recording: rec }
      })
      .filter((item) => item.recording !== undefined)
      .sort((a, b) => {
        const diff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        return sortOrder === 'desc' ? diff : -diff
      })
  }, [annotations, recordings, sortOrder])

  const filteredAnnotations = useMemo(() => {
    return enrichedAnnotations.filter((item) => {
      const rec = item.recording!
      if (filterStore !== 'all' && rec.storeId !== filterStore) return false
      if (filterScenario !== 'all' && rec.scenario !== filterScenario) return false
      if (filterTag !== 'all' && !item.tags.includes(filterTag)) return false
      if (filterKeyword) {
        const keyword = filterKeyword.toLowerCase()
        const matchesSuggestion = item.suggestion.toLowerCase().includes(keyword)
        const matchesConcern = rec.summary.patientConcern.toLowerCase().includes(keyword)
        const matchesStore = rec.storeName.toLowerCase().includes(keyword)
        const matchesDoctor = rec.doctorCode.toLowerCase().includes(keyword)
        if (!matchesSuggestion && !matchesConcern && !matchesStore && !matchesDoctor) return false
      }
      return true
    })
  }, [enrichedAnnotations, filterStore, filterScenario, filterTag, filterKeyword])

  const tagDistribution = useMemo(() => {
    const counts: Record<string, number> = {}
    filteredAnnotations.forEach((item) => {
      item.tags.forEach((tag) => {
        counts[tag] = (counts[tag] ?? 0) + 1
      })
    })
    const total = filteredAnnotations.length || 1
    return (Object.keys(counts) as TagType[])
      .map((tag) => ({
        tag,
        label: TAG_LABELS[tag],
        count: counts[tag],
        percent: Math.round((counts[tag] / total) * 100),
        category: TAG_CATEGORY[tag],
      }))
      .sort((a, b) => b.count - a.count)
  }, [filteredAnnotations])

  const keywordRanking = useMemo(() => {
    const suggestions = filteredAnnotations.map((a) => a.suggestion).filter(Boolean)
    return extractKeywords(suggestions, 12)
  }, [filteredAnnotations])

  const byStoreSummary = useMemo(() => {
    const map: Record<string, { name: string; total: number; negative: number; tags: Record<string, number> }> = {}
    filteredAnnotations.forEach((item) => {
      const rec = item.recording!
      if (!map[rec.storeId]) {
        map[rec.storeId] = { name: rec.storeName, total: 0, negative: 0, tags: {} }
      }
      map[rec.storeId].total += 1
      if (item.tags.some((t) => TAG_CATEGORY[t] === 'negative')) {
        map[rec.storeId].negative += 1
      }
      item.tags.forEach((t) => {
        if (TAG_CATEGORY[t] === 'negative') {
          map[rec.storeId].tags[t] = (map[rec.storeId].tags[t] ?? 0) + 1
        }
      })
    })
    return Object.entries(map)
      .map(([storeId, data]) => ({
        storeId,
        ...data,
        negativeRate: Math.round((data.negative / (data.total || 1)) * 100),
        topTag: Object.entries(data.tags).sort((a, b) => b[1] - a[1])[0]?.[0] as TagType | undefined,
      }))
      .sort((a, b) => b.negative - a.negative)
  }, [filteredAnnotations])

  const byScenarioSummary = useMemo(() => {
    const map: Record<ScenarioType, { total: number; negative: number; tags: Record<string, number> }> = {
      implant: { total: 0, negative: 0, tags: {} },
      orthodontic: { total: 0, negative: 0, tags: {} },
      pediatric: { total: 0, negative: 0, tags: {} },
      cleaning: { total: 0, negative: 0, tags: {} },
    }
    filteredAnnotations.forEach((item) => {
      const rec = item.recording!
      map[rec.scenario].total += 1
      if (item.tags.some((t) => TAG_CATEGORY[t] === 'negative')) {
        map[rec.scenario].negative += 1
      }
      item.tags.forEach((t) => {
        if (TAG_CATEGORY[t] === 'negative') {
          map[rec.scenario].tags[t] = (map[rec.scenario].tags[t] ?? 0) + 1
        }
      })
    })
    return (Object.keys(map) as ScenarioType[]).map((sc) => ({
      scenario: sc,
      label: SCENARIO_LABELS[sc],
      ...map[sc],
      negativeRate: Math.round((map[sc].negative / (map[sc].total || 1)) * 100),
      topTag: Object.entries(map[sc].tags).sort((a, b) => b[1] - a[1])[0]?.[0] as TagType | undefined,
    })).filter((d) => d.total > 0)
  }, [filteredAnnotations])

  const stats = useMemo(() => {
    const total = annotations.length
    const thisMonth = annotations.filter((a) => {
      const date = new Date(a.createdAt)
      const now = new Date()
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()
    }).length
    const withNegative = annotations.filter((a) =>
      a.tags.some((t) => TAG_CATEGORY[t] === 'negative')
    ).length
    return { total, thisMonth, withNegative }
  }, [annotations])

  const allTags = Object.keys(TAG_LABELS) as TagType[]
  const negativeTags = allTags.filter((t) => TAG_CATEGORY[t] === 'negative')
  const positiveTags = allTags.filter((t) => TAG_CATEGORY[t] === 'positive')

  const hasActiveFilters =
    filterStore !== 'all' ||
    filterScenario !== 'all' ||
    filterTag !== 'all' ||
    filterKeyword !== ''

  const resetFilters = () => {
    setFilterStore('all')
    setFilterScenario('all')
    setFilterTag('all')
    setFilterKeyword('')
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const handleTagClick = (tag: TagType) => {
    setFilterTag(tag)
    setTabMode('list')
  }

  const handleKeywordClick = (keyword: string) => {
    setFilterKeyword(keyword)
    setTabMode('list')
  }

  const handleGoToComparison = (storeId: string) => {
    navigate('/comparison', { state: { drillDownStoreId: storeId } })
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold text-slate-800">标注台账</h1>
          <p className="text-sm text-slate-400 mt-1">标注结果复盘汇总与明细检索</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-100 rounded-lg p-1">
            <button
              onClick={() => setTabMode('summary')}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                tabMode === 'summary'
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              复盘汇总
            </button>
            <button
              onClick={() => setTabMode('list')}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                tabMode === 'list'
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <List className="w-4 h-4" />
              标注明细
            </button>
          </div>
          {tabMode === 'list' && (
            <button
              onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
              className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <ListFilter className="w-3.5 h-3.5" />
              {sortOrder === 'desc' ? '最新在前' : '最早在前'}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm p-5">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="w-4 h-4 text-primary" />
            <span className="text-sm text-slate-500">标注总数</span>
          </div>
          <p className="text-3xl font-bold text-slate-800 font-serif">{stats.total}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-5">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-4 h-4 text-accent" />
            <span className="text-sm text-slate-500">本月标注</span>
          </div>
          <p className="text-3xl font-bold text-slate-800 font-serif">{stats.thisMonth}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-5">
          <div className="flex items-center gap-2 mb-2">
            <Tag className="w-4 h-4 text-red-500" />
            <span className="text-sm text-slate-500">含负面标签</span>
          </div>
          <p className="text-3xl font-bold text-red-600 font-serif">{stats.withNegative}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-5">
          <div className="flex items-center gap-2 mb-2">
            <Building2 className="w-4 h-4 text-blue-500" />
            <span className="text-sm text-slate-500">覆盖门店</span>
          </div>
          <p className="text-3xl font-bold text-slate-800 font-serif">
            {new Set(enrichedAnnotations.map((a) => a.recording?.storeId).filter(Boolean)).size}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-500" />
            <span className="text-sm font-medium text-slate-700">筛选条件</span>
          </div>
          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              清空筛选
            </button>
          )}
        </div>

        <div className="grid grid-cols-5 gap-4">
          <div>
            <label className="text-xs text-slate-500 mb-1.5 block">门店</label>
            <select
              value={filterStore}
              onChange={(e) => setFilterStore(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            >
              <option value="all">全部门店</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1.5 block">项目类型</label>
            <select
              value={filterScenario}
              onChange={(e) => setFilterScenario(e.target.value as ScenarioType | 'all')}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            >
              <option value="all">全部类型</option>
              {(Object.keys(SCENARIO_LABELS) as ScenarioType[]).map((sc) => (
                <option key={sc} value={sc}>{SCENARIO_LABELS[sc]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1.5 block">标签</label>
            <select
              value={filterTag}
              onChange={(e) => setFilterTag(e.target.value as TagType | 'all')}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            >
              <option value="all">全部标签</option>
              <optgroup label="负面标签">
                {negativeTags.map((t) => (
                  <option key={t} value={t}>{TAG_LABELS[t]}</option>
                ))}
              </optgroup>
              <optgroup label="正面标签">
                {positiveTags.map((t) => (
                  <option key={t} value={t}>{TAG_LABELS[t]}</option>
                ))}
              </optgroup>
            </select>
          </div>
          <div className="col-span-2">
            <label className="text-xs text-slate-500 mb-1.5 block">关键词搜索</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={filterKeyword}
                onChange={(e) => setFilterKeyword(e.target.value)}
                placeholder="搜索建议内容、患者顾虑、门店、医生编码..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            </div>
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
          <p className="text-xs text-slate-400">
            找到 <span className="font-medium text-slate-600">{filteredAnnotations.length}</span> 条标注
            {hasActiveFilters && `（共 ${enrichedAnnotations.length} 条）`}
          </p>
          {hasActiveFilters && tabMode === 'summary' && (
            <p className="text-xs text-slate-400">汇总数据基于当前筛选条件</p>
          )}
        </div>
      </div>

      {tabMode === 'summary' ? (
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-6">
            <div className="bg-white rounded-xl shadow-sm p-6 col-span-2">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <PieChart className="w-5 h-5 text-primary" />
                  <h3 className="font-serif text-lg font-semibold text-slate-700">问题标签占比</h3>
                </div>
                <span className="text-xs text-slate-400">点击标签查看明细</span>
              </div>
              {tagDistribution.length === 0 ? (
                <div className="py-10 text-center text-sm text-slate-400">暂无标签数据</div>
              ) : (
                <div className="space-y-3">
                  {tagDistribution.slice(0, 10).map((item) => (
                    <div
                      key={item.tag}
                      onClick={() => handleTagClick(item.tag)}
                      className="group cursor-pointer"
                    >
                      <div className="flex items-center justify-between text-sm mb-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              item.category === 'positive' ? 'bg-emerald-500' : 'bg-red-500'
                            }`}
                          />
                          <span className="text-slate-700 group-hover:text-primary transition-colors">
                            {item.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400 text-xs">{item.count}条</span>
                          <span className="text-slate-600 font-medium">{item.percent}%</span>
                          <ArrowRight className="w-3 h-3 text-slate-300 group-hover:text-primary transition-colors" />
                        </div>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all group-hover:opacity-90 ${
                            item.category === 'positive' ? 'bg-emerald-400' : 'bg-red-400'
                          }`}
                          style={{ width: `${item.percent}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-primary" />
                  <h3 className="font-serif text-lg font-semibold text-slate-700">建议关键词Top</h3>
                </div>
              </div>
              {keywordRanking.length === 0 ? (
                <div className="py-10 text-center text-sm text-slate-400">暂无关键词数据</div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {keywordRanking.map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleKeywordClick(item.word)}
                      className={`group flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                        idx < 3
                          ? 'bg-orange-50 text-orange-700 hover:bg-orange-100'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {idx < 3 && (
                        <span className="w-4 h-4 rounded-full bg-orange-500 text-white flex items-center justify-center text-[10px] leading-none">
                          {idx + 1}
                        </span>
                      )}
                      {item.word}
                      <span className="text-[10px] opacity-60 ml-0.5">×{item.count}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-primary" />
                <h3 className="font-serif text-lg font-semibold text-slate-700">按门店汇总</h3>
              </div>
              <span className="text-xs text-slate-400">点击门店可跳转对比详情</span>
            </div>
            {byStoreSummary.length === 0 ? (
              <div className="py-10 text-center text-sm text-slate-400">暂无数据</div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {byStoreSummary.map((item) => (
                  <div
                    key={item.storeId}
                    onClick={() => handleGoToComparison(item.storeId)}
                    className="border border-slate-100 rounded-lg p-4 hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-slate-700">{item.name}</span>
                      <ChevronRight className="w-4 h-4 text-slate-300" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-end justify-between">
                        <span className="text-xs text-slate-400">标注数</span>
                        <span className="text-sm font-bold text-slate-700">{item.total}</span>
                      </div>
                      <div className="flex items-end justify-between">
                        <span className="text-xs text-slate-400">负面率</span>
                        <span
                          className={`text-sm font-bold ${
                            item.negativeRate >= 60
                              ? 'text-red-600'
                              : item.negativeRate >= 40
                              ? 'text-orange-600'
                              : 'text-emerald-600'
                          }`}
                        >
                          {item.negativeRate}%
                        </span>
                      </div>
                      {item.topTag && (
                        <div className="pt-2 border-t border-slate-50">
                          <span className="text-[11px] text-slate-400 mr-1">最常见问题：</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleTagClick(item.topTag!)
                            }}
                            className="text-[11px] text-red-600 bg-red-50 px-1.5 py-0.5 rounded hover:bg-red-100 transition-colors"
                          >
                            {TAG_LABELS[item.topTag]}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-5 h-5 text-primary" />
              <h3 className="font-serif text-lg font-semibold text-slate-700">按项目类型汇总</h3>
            </div>
            {byScenarioSummary.length === 0 ? (
              <div className="py-10 text-center text-sm text-slate-400">暂无数据</div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {byScenarioSummary.map((item) => (
                  <div
                    key={item.scenario}
                    onClick={() => { setFilterScenario(item.scenario); setTabMode('list') }}
                    className="border border-slate-100 rounded-lg p-4 hover:shadow-sm cursor-pointer transition-all"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span
                        className="text-xs font-medium px-2 py-0.5 rounded-full text-white"
                        style={{
                          backgroundColor:
                            item.scenario === 'implant' ? '#0D9488' :
                            item.scenario === 'orthodontic' ? '#F97316' :
                            item.scenario === 'pediatric' ? '#8B5CF6' : '#3B82F6',
                        }}
                      >
                        {item.label}
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-300" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-end justify-between">
                        <span className="text-xs text-slate-400">标注数</span>
                        <span className="text-sm font-bold text-slate-700">{item.total}</span>
                      </div>
                      <div className="flex items-end justify-between">
                        <span className="text-xs text-slate-400">负面率</span>
                        <span
                          className={`text-sm font-bold ${
                            item.negativeRate >= 60
                              ? 'text-red-600'
                              : item.negativeRate >= 40
                              ? 'text-orange-600'
                              : 'text-emerald-600'
                          }`}
                        >
                          {item.negativeRate}%
                        </span>
                      </div>
                      {item.topTag && (
                        <div className="pt-2 border-t border-slate-50">
                          <span className="text-[11px] text-slate-400 mr-1">最常见问题：</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleTagClick(item.topTag!)
                            }}
                            className="text-[11px] text-red-600 bg-red-50 px-1.5 py-0.5 rounded hover:bg-red-100 transition-colors"
                          >
                            {TAG_LABELS[item.topTag]}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredAnnotations.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm py-16 text-center">
              <FileText className="w-12 h-12 text-slate-200 mx-auto mb-3" />
              <p className="text-sm text-slate-400">没有找到匹配的标注记录</p>
              <p className="text-xs text-slate-300 mt-1">试试调整筛选条件或清空搜索关键词</p>
            </div>
          ) : (
            filteredAnnotations.map((item) => {
              const rec = item.recording!
              const hasNegative = item.tags.some((t) => TAG_CATEGORY[t] === 'negative')
              return (
                <div
                  key={item.id}
                  className="bg-white rounded-xl shadow-sm p-5 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start gap-5">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <span
                          className="inline-block px-2 py-0.5 rounded-full text-[11px] font-medium text-white"
                          style={{
                            backgroundColor:
                              rec.scenario === 'implant' ? '#0D9488' :
                              rec.scenario === 'orthodontic' ? '#F97316' :
                              rec.scenario === 'pediatric' ? '#8B5CF6' : '#3B82F6',
                          }}
                        >
                          {SCENARIO_LABELS[rec.scenario]}
                        </span>
                        <span className="text-sm font-medium text-slate-700">{rec.storeName}</span>
                        <span className="text-xs text-slate-400">·</span>
                        <span className="text-xs text-slate-500">{rec.doctorCode}</span>
                        <span className="text-xs text-slate-400">·</span>
                        <span className="text-xs text-slate-400">{rec.patientType}</span>
                      </div>

                      <p className="text-sm text-slate-600 mb-3 line-clamp-2">
                        {rec.summary.patientConcern}
                      </p>

                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {item.tags.map((tag) => (
                          <button
                            key={tag}
                            onClick={() => handleTagClick(tag)}
                            className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium hover:opacity-80 transition-opacity ${
                              TAG_CATEGORY[tag] === 'positive'
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-red-50 text-red-600'
                            }`}
                          >
                            {TAG_LABELS[tag]}
                          </button>
                        ))}
                      </div>

                      {item.suggestion && (
                        <div className="bg-slate-50 rounded-lg px-3 py-2">
                          <div className="flex items-center gap-1.5 mb-1">
                            <MessageSquare className="w-3.5 h-3.5 text-amber-500" />
                            <span className="text-[11px] font-medium text-amber-700">改进建议</span>
                          </div>
                          <p className="text-sm text-slate-600">{item.suggestion}</p>
                        </div>
                      )}
                    </div>

                    <div className="shrink-0 text-right">
                      <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-2">
                        <Clock className="w-3.5 h-3.5" />
                        {formatDate(item.createdAt)}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-2">
                        <User className="w-3.5 h-3.5" />
                        {item.annotator}
                      </div>
                      {hasNegative ? (
                        <span className="inline-block px-2 py-0.5 rounded bg-red-50 text-red-600 text-[11px] font-medium">
                          待改进
                        </span>
                      ) : (
                        <span className="inline-block px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[11px] font-medium">
                          表现良好
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
