import { create } from 'zustand'

export interface Image {
  id: string
  url: string
  status: 'loading' | 'done' | 'error'
  prompt?: string
}

export interface AppState {
  apiKey: string | null
  prompt: string
  isGeneratingImages: boolean
  images: Image[]
  selectedImageId: string | null
  generatedVideos: Record<string, { url: string; taskId: string; model: string }>
  activeVideoTasks: { taskId: string; imageId: string; model: string }[]
  activeNanoTasks: { taskId: string; sourceImageId: string }[]
  
  // Architect State
  architect: {
    strategy: {
      concept: string
      music: string
      overlay: string
      loopLogic: string
    } | null
    script: {
      scene1: string
      narration: string
    } | null
    scenes: {
      id: number
      visual: string
      tool: 'Midjourney' | 'Nano Banana'
      reference: string
      prompt: string
      grokMotion: string
      status: 'pending' | 'generating' | 'done' | 'error'
      images: Image[]
      activeTasks?: string[] // Task IDs for polling
    }[]
    isGenerating: boolean
  }

  // Actions
  setApiKey: (key: string | null) => void
  setPrompt: (prompt: string) => void
  setIsGeneratingImages: (isGenerating: boolean) => void
  setImages: (images: Image[]) => void
  addImages: (images: Image[]) => void
  updateImage: (id: string, updates: Partial<Image>) => void
  setSelectedImageId: (id: string | null) => void
  setGeneratedVideo: (imageId: string, video: { url: string; taskId: string; model: string }) => void
  addVideoTask: (taskId: string, imageId: string, model: string) => void
  removeVideoTask: (taskId: string) => void
  addNanoTask: (taskId: string, sourceImageId: string) => void
  removeNanoTask: (taskId: string) => void
  
  // Architect Actions
  setArchitectState: (updates: Partial<AppState['architect']>) => void
  updateScene: (sceneId: number, updates: Partial<AppState['architect']['scenes'][0]>) => void
  addSceneImages: (sceneId: number, images: Image[]) => void
  reset: () => void
}

const initialState = {
  apiKey: null,
  prompt: '',
  isGeneratingImages: false,
  images: [],
  selectedImageId: null,
  generatedVideos: {},
  activeVideoTasks: [],
  activeNanoTasks: [],
  architect: {
    strategy: null,
    script: null,
    scenes: [],
    isGenerating: false
  }
}

export const useAppStore = create<AppState>((set, get) => ({
  ...initialState,

  setApiKey: (key) => set({ apiKey: key }),
  
  setPrompt: (prompt) => set({ prompt }),
  
  setIsGeneratingImages: (isGenerating) => set({ isGeneratingImages: isGenerating }),
  
  setImages: (images) => set({ images }),
  
  addImages: (newImages) => set((state) => ({ 
    images: [...state.images, ...newImages] 
  })),
  
  updateImage: (id, updates) => set((state) => ({
    images: state.images.map(img => 
      img.id === id ? { ...img, ...updates } : img
    )
  })),
  
  setSelectedImageId: (id) => set({ selectedImageId: id }),
  
  setGeneratedVideo: (imageId, video) => set((state) => ({
    generatedVideos: { ...state.generatedVideos, [imageId]: video }
  })),
  
  addVideoTask: (taskId, imageId, model) => set((state) => ({
    activeVideoTasks: [...state.activeVideoTasks, { taskId, imageId, model }]
  })),
  
  removeVideoTask: (taskId) => set((state) => ({
    activeVideoTasks: state.activeVideoTasks.filter(task => task.taskId !== taskId)
  })),

  addNanoTask: (taskId, sourceImageId) => set((state) => ({
    activeNanoTasks: [...state.activeNanoTasks, { taskId, sourceImageId }]
  })),

  removeNanoTask: (taskId) => set((state) => ({
    activeNanoTasks: state.activeNanoTasks.filter(task => task.taskId !== taskId)
  })),
  
  setArchitectState: (updates) => set((state) => ({
    architect: { ...state.architect, ...updates }
  })),

  updateScene: (sceneId, updates) => set((state) => ({
    architect: {
      ...state.architect,
      scenes: state.architect.scenes.map(scene => 
        scene.id === sceneId ? { ...scene, ...updates } : scene
      )
    }
  })),

  addSceneImages: (sceneId, images) => set((state) => ({
    architect: {
      ...state.architect,
      scenes: state.architect.scenes.map(scene => 
        scene.id === sceneId ? { 
          ...scene, 
          images: [...scene.images, ...images] 
        } : scene
      )
    }
  })),

  reset: () => set(initialState),
}))

// Load API key from localStorage on mount
if (typeof window !== 'undefined') {
  const savedApiKey = localStorage.getItem('motion-mosaic-api-key')
  if (savedApiKey) {
    useAppStore.setState({ apiKey: savedApiKey })
  }
  
  // Save API key to localStorage whenever it changes
  useAppStore.subscribe(
    (state, prevState) => {
      if (state.apiKey !== prevState.apiKey) {
        if (state.apiKey) {
          localStorage.setItem('motion-mosaic-api-key', state.apiKey)
        } else {
          localStorage.removeItem('motion-mosaic-api-key')
        }
      }
    }
  )
}
