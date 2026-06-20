import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { Recording, Annotation, TagType, TrainingItem, TrainingStatus, WeaknessDimension } from '@/types'
import { recordings as initRecordings, annotations as initAnnotations } from '@/data/mockData'

interface AppState {
  recordings: Recording[]
  annotations: Annotation[]
  trainingItems: TrainingItem[]
  currentRecordingId: string | null
  setCurrentRecording: (id: string | null) => void
  addAnnotation: (recordingId: string, tags: TagType[], suggestion: string, annotator: string) => void
  markRecordingAnnotated: (id: string) => void
  addTrainingItem: (data: Omit<TrainingItem, 'id' | 'createdAt'>) => void
  updateTrainingItem: (id: string, updates: Partial<Omit<TrainingItem, 'id' | 'createdAt'>>) => void
  removeTrainingItem: (id: string) => void
  resetToInitial: () => void
}

const initialTrainingItems: TrainingItem[] = []

export const useStore = create<AppState>()(
  persist(
    (set) => ({
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
            {
              ...data,
              id: `t${Date.now()}`,
              createdAt: new Date().toISOString(),
            },
          ],
        })),
      updateTrainingItem: (id, updates) =>
        set((state) => ({
          trainingItems: state.trainingItems.map((t) =>
            t.id === id ? { ...t, ...updates } : t
          ),
        })),
      removeTrainingItem: (id) =>
        set((state) => ({
          trainingItems: state.trainingItems.filter((t) => t.id !== id),
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
    }
  )
)
