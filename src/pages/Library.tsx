import { useState, useMemo, useCallback } from 'react'
import { scriptEntries, stores } from '@/data/mockData'
import { SCENARIO_LABELS, TAG_LABELS, TAG_CATEGORY, type ScenarioType, type TagType, type ScriptEntry } from '@/types'
import { Search, Star, Copy, X, BookOpen, Users, AlertCircle, Quote, Filter } from 'lucide-react'

const SCENARIO_COLORS: Record<ScenarioType, string> = {
  implant: '#0D9488',
  orthodontic: '#F97316',
  pediatric: '#8B5CF6',
  cleaning: '#3B82F6',
}

const SCENARIO_FILTER_OPTIONS: { value: ScenarioType | 'all'; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'implant', label: '种植咨询' },
  { value: 'orthodontic', label: '正畸初诊' },
  { value: 'pediatric', label: '儿童牙科' },
  { value: 'cleaning', label: '洁牙转化' },
]

export default function Library() {
  const [activeScenario, setActiveScenario] = useState<ScenarioType | 'all'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedEntry, setSelectedEntry] = useState<ScriptEntry | null>(null)
  const [showToast, setShowToast] = useState(false)

  const filteredEntries = useMemo(() => {
    return scriptEntries.filter((entry) => {
      const matchesScenario = activeScenario === 'all' || entry.scenario === activeScenario
      const query = searchQuery.toLowerCase().trim()
      const matchesSearch = !query || entry.title.toLowerCase().includes(query) || entry.content.toLowerCase().includes(query)
      return matchesScenario && matchesSearch
    })
  }, [activeScenario, searchQuery])

  const getStoreName = useCallback((storeId: string) => {
    return stores.find((s) => s.id === storeId)?.name ?? ''
  }, [])

  const handleCopyCitation = useCallback(async (entry: ScriptEntry) => {
    const storeName = getStoreName(entry.storeId)
    const citation = `【优秀话术引用】${entry.title} | 场景：${SCENARIO_LABELS[entry.scenario]} | 来源：${storeName} | 满意度：${entry.satisfactionScore} | 引用次数：${entry.referenceCount}`
    try {
      await navigator.clipboard.writeText(citation)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = citation
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
    }
    setShowToast(true)
    setTimeout(() => setShowToast(false), 2000)
  }, [getStoreName])

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="font-serif text-2xl font-bold text-slate-800">优秀话术库</h1>
        <p className="text-sm text-slate-400 mt-1">高满意度案例的标准化话术，可引用到培训材料</p>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <div className="flex items-center gap-2 flex-1 flex-wrap">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          {SCENARIO_FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setActiveScenario(opt.value)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                activeScenario === opt.value
                  ? 'bg-primary text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="relative w-72 shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索话术标题或内容…"
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-white"
          />
        </div>
      </div>

      {filteredEntries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-slate-400">
          <BookOpen className="w-16 h-16 mb-4 text-slate-300" />
          <p className="font-serif text-lg font-semibold text-slate-500 mb-1">暂无匹配话术</p>
          <p className="text-sm">试试调整筛选条件或搜索关键词</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-5">
          {filteredEntries.map((entry) => (
            <div
              key={entry.id}
              onClick={() => setSelectedEntry(entry)}
              className="rounded-xl shadow-sm bg-white hover:shadow-md transition-shadow cursor-pointer p-5 flex flex-col"
            >
              <span
                className="inline-block self-start px-2.5 py-0.5 rounded-full text-xs font-medium text-white mb-3"
                style={{ backgroundColor: SCENARIO_COLORS[entry.scenario] }}
              >
                {SCENARIO_LABELS[entry.scenario]}
              </span>
              <h3 className="font-serif text-base font-semibold text-slate-800 mb-2 line-clamp-1">
                {entry.title}
              </h3>
              <p className="text-sm text-slate-500 line-clamp-3 mb-4 flex-1">
                {entry.content}
              </p>
              <div className="flex items-center gap-3 mb-3">
                {entry.tags.map((tag) => (
                  <span
                    key={tag}
                    className={`inline-block px-2 py-0.5 rounded text-xs ${
                      TAG_CATEGORY[tag] === 'positive'
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-red-50 text-red-600'
                    }`}
                  >
                    {TAG_LABELS[tag]}
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-4 text-xs text-slate-400">
                <span className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" />
                  {entry.patientProfile.length > 10 ? entry.patientProfile.slice(0, 10) + '…' : entry.patientProfile}
                </span>
                <span className="flex items-center gap-1 text-amber-500">
                  <Star className="w-3.5 h-3.5 fill-amber-400" />
                  {entry.satisfactionScore}
                </span>
                <span className="flex items-center gap-1">
                  <Quote className="w-3.5 h-3.5" />
                  引用 {entry.referenceCount} 次
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedEntry && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setSelectedEntry(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl max-w-2xl w-full mx-4 max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between p-6 pb-4 border-b border-slate-100">
              <div className="flex-1 pr-4">
                <span
                  className="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium text-white mb-2"
                  style={{ backgroundColor: SCENARIO_COLORS[selectedEntry.scenario] }}
                >
                  {SCENARIO_LABELS[selectedEntry.scenario]}
                </span>
                <h2 className="font-serif text-xl font-semibold text-slate-800">
                  {selectedEntry.title}
                </h2>
              </div>
              <button
                onClick={() => setSelectedEntry(null)}
                className="p-1 rounded-lg hover:bg-slate-100 transition-colors text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              <div>
                <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed">
                  {selectedEntry.content}
                </p>
              </div>

              <div>
                <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                  <Users className="w-4 h-4 text-slate-400" />
                  适用患者
                </h4>
                <p className="text-sm text-slate-600 bg-slate-50 rounded-lg p-3">
                  {selectedEntry.patientProfile}
                </p>
              </div>

              <div>
                <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                  <AlertCircle className="w-4 h-4 text-amber-500" />
                  使用边界
                </h4>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-sm text-amber-800">{selectedEntry.usageBoundary}</p>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-slate-700 mb-2">标签</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedEntry.tags.map((tag) => (
                    <span
                      key={tag}
                      className={`inline-block px-2.5 py-1 rounded text-xs font-medium ${
                        TAG_CATEGORY[tag] === 'positive'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-red-50 text-red-600'
                      }`}
                    >
                      {TAG_LABELS[tag]}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-5 text-sm text-slate-500">
                <span className="flex items-center gap-1.5 text-amber-500 font-medium">
                  <Star className="w-4 h-4 fill-amber-400" />
                  满意度 {selectedEntry.satisfactionScore}
                </span>
                <span className="flex items-center gap-1.5">
                  <Quote className="w-4 h-4" />
                  引用 {selectedEntry.referenceCount} 次
                </span>
              </div>
            </div>

            <div className="p-6 pt-4 border-t border-slate-100">
              <button
                onClick={() => handleCopyCitation(selectedEntry)}
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 transition-opacity"
              >
                <Copy className="w-4 h-4" />
                引用到培训材料
              </button>
            </div>
          </div>
        </div>
      )}

      {showToast && (
        <div className="fixed top-6 right-6 z-[60] bg-emerald-500 text-white px-5 py-2.5 rounded-lg shadow-lg text-sm font-medium animate-fade-in-up">
          已复制
        </div>
      )}
    </div>
  )
}
