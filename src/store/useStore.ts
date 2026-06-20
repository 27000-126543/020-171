import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { Recording, Annotation, TagType, TrainingItem, TrainingStatus, WeaknessDimension } from '@/types'
import { recordings as initRecordings, annotations as initAnnotations } from '@/data/mockData'

function normalizeTrainingItem(item: Partial<TrainingItem> & { id: string; storeId: string; recordingId: string }): TrainingItem {
  return {
    id: item.id,
    storeId: item.storeId,
    recordingId: item.recordingId,
    dimension: item.dimension ?? 'followup_guidance',
    owner: item.owner ?? '待分配',
    planDate: item.planDate ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    status: item.status ?? 'pending',
    note: item.note ?? '',
    createdAt: item.createdAt ?? new Date().toISOString(),
    resultNote: item.resultNote ?? '',
    followUpRecordingId: item.followUpRecordingId ?? null,
    effectScore: item.effectScore ?? null,
    completedAt: item.completedAt ?? null,
    preScore: item.preScore ?? null,
    postScore: item.postScore ?? null,
  }
}

interface AppState {
  recordings: Recording[]
  annotations: Annotation[]
  trainingItems: TrainingItem[]
  currentRecordingId: string | null
  setCurrentRecording: (id: string | null) => void
  addAnnotation: (recordingId: string, tags: TagType[], suggestion: string, annotator: string) => void
  markRecordingAnnotated: (id: string) => void
  addTrainingItem: (data: Omit<TrainingItem, 'id' | 'createdAt' | 'resultNote' | 'followUpRecordingId' | 'effectScore' | 'completedAt' | 'preScore' | 'postScore'>) => void
  updateTrainingItem: (id: string, updates: Partial<Omit<TrainingItem, 'id' | 'createdAt'>>) => void
  removeTrainingItem: (id: string) => void
  completeTrainingItem: (
    id: string,
    result: { resultNote: string; followUpRecordingId: string | null; effectScore: number; postScore: number }
  ) => void
  resetToInitial: () => void
}

const initialTrainingItems: TrainingItem[] = []

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      recordings: initRecordings,
      annotations: initAnnotations,
      trainingItems: initialTrainingItems,
      currentRecordingId: null,
      setCurrentRecording: (id) => set({ currentRecordingId: id }),
      addAnnotation: (recordingId, tags, suggestion, annotator) =>
        set((state) => ({
          annotations: [
            ...state.annotations,
            {
              id: `a${Date.now()}`,
              recordingId,
              tags,
              suggestion,
              annotator,
              createdAt: new Date().toISOString(),
            },
          ],
        })),
      markRecordingAnnotated: (id) =>
        set((state) => ({
          recordings: state.recordings.map((r) =>
            r.id === id ? { ...r, isAnnotated: true } : r
          ),
        })),
      addTrainingItem: (data) =>
        set((state) => ({
          trainingItems: [
            ...state.trainingItems,
            normalizeTrainingItem({
              ...data,
              id: `t${Date.now()}`,
              createdAt: new Date().toISOString(),
            }),
          ],
        })),
      updateTrainingItem: (id, updates) =>
        set((state) => ({
          trainingItems: state.trainingItems.map((t) =>
            t.id === id ? normalizeTrainingItem({ ...t, ...updates }) : t
          ),
        })),
      removeTrainingItem: (id) =>
        set((state) => ({
          trainingItems: state.trainingItems.filter((t) => t.id !== id),
        })),
      completeTrainingItem: (id, { resultNote, followUpRecordingId, effectScore, postScore }) =>
        set((state) => ({
          trainingItems: state.trainingItems.map((t) =>
            t.id === id
              ? normalizeTrainingItem({
                  ...t,
                  status: 'completed',
                  resultNote,
                  followUpRecordingId,
                  effectScore,
                  postScore,
                  completedAt: new Date().toISOString(),
                  preScore: t.preScore ?? null,
                })
              : t
          ),
        })),
      resetToInitial: () =>
        set({
          recordings: initRecordings,
          annotations: initAnnotations,
          trainingItems: initialTrainingItems,
        }),
    }),
    {
      name: 'dental-quality-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        recordings: state.recordings,
        annotations: state.annotations,
        trainingItems: state.trainingItems,
      }),
      onRehydrateStorage: () => (state) => {
        if (state?.trainingItems) {
          state.trainingItems = state.trainingItems.map((t) => normalizeTrainingItem(t))
        }
      },
    }
  )
)
