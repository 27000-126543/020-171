import { useState, useMemo, useCallback, useEffect } from 'react'
import { useStore } from '@/store/useStore'
import { SCENARIO_LABELS, TAG_LABELS, TAG_CATEGORY, type TagType, type ScenarioType } from '@/types'
import { Play, Pause, SkipForward, ChevronRight, Check, Clock, User, Building2, FileText, Send, AlertCircle, ThumbsUp } from 'lucide-react'

const SCENARIO_COLORS: Record<ScenarioType, string> = {
  implant: '#0D9488',
  orthodontic: '#F97316',
  pediatric: '#8B5CF6',
  cleaning: '#3B82F6',
}

const QUICK_TEMPLATES = ['价格需分项说明', '需补充复诊安排', '知情同意需逐条说明', '避免绝对化承诺']

function generateWaveformHeights(seed: string): number[] {
  const bars: number[] = []
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0
  }
  for (let i = 0; i < 40; i++) {
    hash = (hash * 1103515245 + 12345) & 0x7fffffff
    bars.push(20 + (hash % 61))
  }
  return bars
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function formatPlaybackTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function Annotation() {
  const recordings = useStore((s) => s.recordings)
  const storeAnnotations = useStore((s) => s.annotations)
  const currentRecordingId = useStore((s) => s.currentRecordingId)
  const setCurrentRecording = useStore((s) => s.setCurrentRecording)
  const addAnnotation = useStore((s) => s.addAnnotation)
  const markRecordingAnnotated = useStore((s) => s.markRecordingAnnotated)

  const [selectedTags, setSelectedTags] = useState<Set<TagType>>(new Set())
  const [suggestion, setSuggestion] = useState('')
  const [isPlaying, setIsPlaying] = useState(false)
  const [playProgress, setPlayProgress] = useState(0)
  const [playbackSpeed, setPlaybackSpeed] = useState<1 | 1.5 | 2>(1)
  const [showToast, setShowToast] = useState(false)

  const selectedRecording = useMemo(
    () => recordings.find((r) => r.id === currentRecordingId) ?? null,
    [recordings, currentRecordingId]
  )

  const waveformHeights = useMemo(
    () => (selectedRecording ? generateWaveformHeights(selectedRecording.id) : []),
    [selectedRecording]
  )

  const recordingAnnotations = useMemo(
    () =>
      currentRecordingId
        ? storeAnnotations
            .filter((a) => a.recordingId === currentRecordingId)
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        : [],
    [storeAnnotations, currentRecordingId]
  )

  const positiveTags = useMemo(
    () => (Object.keys(TAG_LABELS) as TagType[]).filter((t) => TAG_CATEGORY[t] === 'positive'),
    []
  )
  const negativeTags = useMemo(
    () => (Object.keys(TAG_LABELS) as TagType[]).filter((t) => TAG_CATEGORY[t] === 'negative'),
    []
  )

  const toggleTag = useCallback((tag: TagType) => {
    setSelectedTags((prev) => {
      const next = new Set(prev)
      if (next.has(tag)) next.delete(tag)
      else next.add(tag)
      return next
    })
  }, [])

  const handleSubmit = useCallback(() => {
    if (!currentRecordingId || selectedTags.size === 0) return
    addAnnotation(currentRecordingId, Array.from(selectedTags), suggestion, '当前质检员')
    markRecordingAnnotated(currentRecordingId)
    setSelectedTags(new Set())
    setSuggestion('')
    setPlayProgress(0)
    setIsPlaying(false)
    setShowToast(true)
  }, [currentRecordingId, selectedTags, suggestion, addAnnotation, markRecordingAnnotated])

  useEffect(() => {
    if (showToast) {
      const timer = setTimeout(() => setShowToast(false), 2000)
      return () => clearTimeout(timer)
    }
  }, [showToast])

  useEffect(() => {
    if (!isPlaying || !selectedRecording) return
    const interval = setInterval(() => {
      setPlayProgress((prev) => {
        if (prev >= 100) {
          setIsPlaying(false)
          return 100
        }
        return prev + 0.5 * playbackSpeed
      })
    }, 100)
    return () => clearInterval(interval)
  }, [isPlaying, playbackSpeed, selectedRecording])

  useEffect(() => {
    setSelectedTags(new Set())
    setSuggestion('')
    setPlayProgress(0)
    setIsPlaying(false)
  }, [currentRecordingId])

  const currentTime = selectedRecording
    ? (playProgress / 100) * selectedRecording.duration
    : 0

  const playedBars = Math.floor((playProgress / 100) * 40)

  return (
    <div className="flex h-[calc(100vh-0px)]">
      {showToast && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-2 bg-emerald-500 text-white px-5 py-3 rounded-lg shadow-lg animate-fade-in-up">
          <Check className="w-4 h-4" />
          <span className="text-sm font-medium">标注提交成功</span>
        </div>
      )}

      <div className="w-80 bg-white border-r border-slate-200 flex flex-col shrink-0">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-serif text-lg font-semibold text-slate-800">录音列表</h2>
          <p className="text-xs text-slate-400 mt-1">共 {recordings.length} 条录音</p>
        </div>
        <div className="flex-1 overflow-y-auto">
          {recordings.map((rec) => {
            const isSelected = rec.id === currentRecordingId
            return (
              <div
                key={rec.id}
                onClick={() => setCurrentRecording(rec.id)}
                className={`px-4 py-3 cursor-pointer border-b border-slate-50 border-l-[3px] transition-colors ${
                  isSelected
                    ? 'bg-primary-50 border-l-primary'
                    : 'border-l-transparent hover:bg-slate-50'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-1 shrink-0">
                    {rec.isAnnotated ? (
                      <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center">
                        <Check className="w-3 h-3 text-emerald-600" />
                      </div>
                    ) : (
                      <div className="w-5 h-5 rounded-full flex items-center justify-center">
                        <div className="w-2.5 h-2.5 rounded-full bg-orange-400" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className="inline-block px-1.5 py-0.5 rounded-full text-[10px] font-medium text-white shrink-0"
                        style={{ backgroundColor: SCENARIO_COLORS[rec.scenario] }}
                      >
                        {SCENARIO_LABELS[rec.scenario]}
                      </span>
                      <span className="text-sm text-slate-700 font-medium truncate">
                        {rec.storeName}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-400">
                      <span>{rec.doctorCode}</span>
                      <span className="flex items-center gap-0.5">
                        <Clock className="w-3 h-3" />
                        {formatDuration(rec.duration)}
                      </span>
                      <span>{rec.date}</span>
                    </div>
                  </div>
                  {isSelected && <ChevronRight className="w-4 h-4 text-primary shrink-0 mt-2" />}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-bg">
        {!selectedRecording ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
            <FileText className="w-16 h-16 mb-4 text-slate-300" />
            <p className="text-lg font-serif">请从左侧选择一条录音</p>
            <p className="text-sm mt-1">选择录音后可查看详情并进行标注</p>
          </div>
        ) : (
          <div className="p-8 space-y-6">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="font-serif text-xl font-bold text-slate-800 mb-4">录音详情</h2>
              <div className="grid grid-cols-3 gap-4">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-slate-400" />
                  <span className="text-sm text-slate-500">门店</span>
                  <span className="text-sm text-slate-700 font-medium">{selectedRecording.storeName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-slate-400" />
                  <span className="text-sm text-slate-500">医生</span>
                  <span className="text-sm text-slate-700 font-medium">{selectedRecording.doctorCode}</span>
                </div>
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-slate-400" />
                  <span className="text-sm text-slate-500">患者类型</span>
                  <span className="text-sm text-slate-700 font-medium">{selectedRecording.patientType}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-500">场景</span>
                  <span
                    className="inline-block px-2 py-0.5 rounded-full text-xs font-medium text-white"
                    style={{ backgroundColor: SCENARIO_COLORS[selectedRecording.scenario] }}
                  >
                    {SCENARIO_LABELS[selectedRecording.scenario]}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-400" />
                  <span className="text-sm text-slate-500">时长</span>
                  <span className="text-sm text-slate-700 font-medium">{formatDuration(selectedRecording.duration)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-500">日期</span>
                  <span className="text-sm text-slate-700 font-medium">{selectedRecording.date}</span>
                </div>
                <div className="flex items-center gap-2 col-span-3">
                  <ThumbsUp className="w-4 h-4 text-slate-400" />
                  <span className="text-sm text-slate-500">满意度</span>
                  <span className={`text-sm font-bold ${
                    selectedRecording.satisfactionScore >= 4 ? 'text-emerald-600' :
                    selectedRecording.satisfactionScore >= 3 ? 'text-amber-600' : 'text-red-600'
                  }`}>
                    {selectedRecording.satisfactionScore.toFixed(1)}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-serif text-lg font-semibold text-slate-700">音频播放</h3>
                <div className="flex items-center gap-1">
                  {([1, 1.5, 2] as const).map((speed) => (
                    <button
                      key={speed}
                      onClick={() => setPlaybackSpeed(speed)}
                      className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                        playbackSpeed === speed
                          ? 'bg-primary text-white'
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}
                    >
                      {speed}x
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center hover:bg-primary-dark transition-colors shrink-0"
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                </button>
                <button
                  onClick={() => {
                    setIsPlaying(false)
                    setPlayProgress(0)
                  }}
                  className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200 transition-colors shrink-0"
                >
                  <SkipForward className="w-3.5 h-3.5" />
                </button>
                <div className="flex-1 flex items-end gap-[2px] h-12">
                  {waveformHeights.map((height, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-sm transition-colors duration-150"
                      style={{
                        height: `${height}%`,
                        backgroundColor: i < playedBars ? '#0D9488' : '#CBD5E1',
                      }}
                    />
                  ))}
                </div>
                <div className="text-xs text-slate-400 font-mono shrink-0 w-24 text-right">
                  {formatPlaybackTime(currentTime)} / {formatDuration(selectedRecording.duration)}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="font-serif text-lg font-semibold text-slate-700 mb-4">标签选择</h3>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <ThumbsUp className="w-4 h-4 text-emerald-500" />
                    <span className="text-sm font-medium text-emerald-700">正面标签</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {positiveTags.map((tag) => (
                      <button
                        key={tag}
                        onClick={() => toggleTag(tag)}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                          selectedTags.has(tag)
                            ? 'bg-emerald-500 text-white shadow-sm'
                            : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                        }`}
                      >
                        {TAG_LABELS[tag]}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="w-4 h-4 text-red-500" />
                    <span className="text-sm font-medium text-red-700">负面标签</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {negativeTags.map((tag) => (
                      <button
                        key={tag}
                        onClick={() => toggleTag(tag)}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                          selectedTags.has(tag)
                            ? 'bg-red-500 text-white shadow-sm'
                            : 'bg-red-50 text-red-600 hover:bg-red-100'
                        }`}
                      >
                        {TAG_LABELS[tag]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="font-serif text-lg font-semibold text-slate-700 mb-4">改进建议</h3>
              <div className="flex flex-wrap gap-2 mb-3">
                {QUICK_TEMPLATES.map((tpl) => (
                  <button
                    key={tpl}
                    onClick={() => {
                      const next = suggestion ? `${suggestion}；${tpl}` : tpl
                      if (next.length <= 200) setSuggestion(next)
                    }}
                    className="px-3 py-1 rounded-lg bg-slate-100 text-slate-600 text-xs hover:bg-slate-200 transition-colors"
                  >
                    {tpl}
                  </button>
                ))}
              </div>
              <textarea
                value={suggestion}
                onChange={(e) => {
                  if (e.target.value.length <= 200) setSuggestion(e.target.value)
                }}
                placeholder="请输入改进建议..."
                className="w-full h-28 px-4 py-3 border border-slate-200 rounded-lg text-sm text-slate-700 placeholder:text-slate-300 resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
              />
              <div className="flex justify-end mt-1">
                <span className={`text-xs ${suggestion.length >= 180 ? 'text-red-400' : 'text-slate-400'}`}>
                  {suggestion.length}/200
                </span>
              </div>
            </div>

            <button
              onClick={handleSubmit}
              disabled={selectedTags.size === 0}
              className={`w-full py-3 rounded-xl text-white font-medium flex items-center justify-center gap-2 transition-all ${
                selectedTags.size > 0
                  ? 'bg-primary hover:bg-primary-dark shadow-sm'
                  : 'bg-slate-300 cursor-not-allowed'
              }`}
            >
              <Send className="w-4 h-4" />
              提交标注
            </button>

            {recordingAnnotations.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="font-serif text-lg font-semibold text-slate-700 mb-4">
                  标注历史（{recordingAnnotations.length}）
                </h3>
                <div className="space-y-4">
                  {recordingAnnotations.map((ann) => (
                    <div key={ann.id} className="border border-slate-100 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex flex-wrap gap-1.5">
                          {ann.tags.map((tag) => (
                            <span
                              key={tag}
                              className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                                TAG_CATEGORY[tag] === 'positive'
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : 'bg-red-50 text-red-600'
                              }`}
                            >
                              {TAG_LABELS[tag]}
                            </span>
                          ))}
                        </div>
                        <span className="text-xs text-slate-400 shrink-0 ml-3">
                          {new Date(ann.createdAt).toLocaleDateString('zh-CN', {
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      {ann.suggestion && (
                        <p className="text-sm text-slate-600 mt-2">{ann.suggestion}</p>
                      )}
                      <p className="text-xs text-slate-400 mt-2">标注人：{ann.annotator}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
