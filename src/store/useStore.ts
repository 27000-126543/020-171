import { create } from 'zustand'
import type { Recording, Annotation, TagType } from '@/types'
import { recordings as initRecordings, annotations as initAnnotations } from '@/data/mockData'

interface AppState {
  recordings: Recording[]
  annotations: Annotation[]
  currentRecordingId: string | null
  setCurrentRecording: (id: string | null) => void
  addAnnotation: (recordingId: string, tags: TagType[], suggestion: string, annotator: string) => void
  markRecordingAnnotated: (id: string) => void
}

export const useStore = create<AppState>((set) => ({
  recordings: initRecordings,
  annotations: initAnnotations,
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
}))
