import { create } from 'zustand'

export interface Image {
  id: string
  url: string
  status: 'loading' | 'done' | 'error'
  prompt?: string
  videoPrompt?: string
  taskId?: string
}

export interface AppState {
  kieApiKey: string | null
  googleApiKey: string | null
  provider: 'kie' | 'google'
  prompt: string
  isGeneratingImages: boolean
  images: Image[]
  selectedImageId: string | null
  generatedVideos: Record<string, { url: string; taskId: string; model: string }>
  activeVideoTasks: { taskId: string; imageId: string; model: string }[]
  activeNanoTasks: { taskId: string; sourceImageId: string }[]
  topic: string
  scriptLength: number
  
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
      voiceoverUrl?: string
      isGeneratingVoiceover?: boolean
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
      selectedImageId?: string
      video?: {
        url: string
        status: 'pending' | 'generating' | 'done' | 'error'
        taskId?: string
      }
      activeTasks?: string[] // Task IDs for polling
    }[]
    isGenerating: boolean
  }

  // Saved Projects
  savedProjects: SavedProject[]

  // Actions
  setKieApiKey: (key: string | null) => void
  setGoogleApiKey: (key: string | null) => void
  setProvider: (provider: 'kie' | 'google') => void
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
  setTopic: (topic: string) => void
  setScriptLength: (length: number) => void
  
  // Architect Actions
  setArchitectState: (updates: Partial<AppState['architect']>) => void
  updateScene: (sceneId: number, updates: Partial<AppState['architect']['scenes'][0]>) => void
  addSceneImages: (sceneId: number, images: Image[]) => void
  reorderScenes: (fromIndex: number, toIndex: number) => void
  newProject: () => void
  reset: () => void
  clearPersistence: () => void
  // Project Actions
  saveProject: (project: Omit<SavedProject, 'id' | 'createdAt'>) => void
  deleteProject: (id: string) => void
  loadProject: (id: string) => void
}

export interface SavedProject {
  id: string
  name: string
  createdAt: number
  architect: AppState['architect']
}

const initialState = {
  kieApiKey: null,
  googleApiKey: null,
  provider: 'kie' as 'kie' | 'google',
  prompt: '',
  isGeneratingImages: false,
  images: [],
  selectedImageId: null,
  generatedVideos: {},
  activeVideoTasks: [],
  activeNanoTasks: [],
  topic: '',
  scriptLength: 60,
  architect: {
    strategy: null,
    script: null,
    scenes: [],
    isGenerating: false
  },
  savedProjects: []
}

export const useAppStore = create<AppState>((set) => ({
  ...initialState,

  setKieApiKey: (key) => set({ kieApiKey: key }),
  setGoogleApiKey: (key) => set({ googleApiKey: key }),

  setProvider: (provider) => set({ provider }),
  
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

  setTopic: (topic) => set({ topic }),
  setScriptLength: (scriptLength) => set({ scriptLength }),
  
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

  reorderScenes: (fromIndex, toIndex) => set((state) => {
    const scenes = [...state.architect.scenes]
    const [moved] = scenes.splice(fromIndex, 1)
    scenes.splice(toIndex, 0, moved)
    // Re-assign IDs to keep them sequential
    const reindexed = scenes.map((s, i) => ({ ...s, id: i + 1 }))
    return { architect: { ...state.architect, scenes: reindexed } }
  }),

  saveProject: (projectData) => set((state) => {
    const newProject: SavedProject = {
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      ...projectData
    }
    const updatedProjects = [newProject, ...state.savedProjects]
    // Persist to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('motion-mosaic-projects', JSON.stringify(updatedProjects))
    }
    return { savedProjects: updatedProjects }
  }),

  deleteProject: (id) => set((state) => {
    const updatedProjects = state.savedProjects.filter(p => p.id !== id)
    if (typeof window !== 'undefined') {
      localStorage.setItem('motion-mosaic-projects', JSON.stringify(updatedProjects))
    }
    return { savedProjects: updatedProjects }
  }),

  loadProject: (id) => set((state) => {
    const project = state.savedProjects.find(p => p.id === id)
    if (!project) return {}
    return { architect: { ...project.architect, isGenerating: false } }
  }),

  newProject: () => set((state) => ({
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
  })),

  reset: () => set(initialState),

  clearPersistence: () => {
    set(initialState)
    if (typeof window !== 'undefined') {
      localStorage.removeItem('motion-mosaic-state')
      localStorage.removeItem('motion-mosaic-kie-key')
      localStorage.removeItem('motion-mosaic-google-key')
      localStorage.removeItem('motion-mosaic-eleven-key')
      localStorage.removeItem('motion-mosaic-projects')
    }
  }
}))

// Load State from localStorage on mount
if (typeof window !== 'undefined') {
  // Load individual keys (legacy/compatibility)
  const savedKieKey = localStorage.getItem('motion-mosaic-kie-key')
  const savedGoogleKey = localStorage.getItem('motion-mosaic-google-key')
  
  if (savedKieKey) useAppStore.setState({ kieApiKey: savedKieKey })
  if (savedGoogleKey) useAppStore.setState({ googleApiKey: savedGoogleKey })
  
  const savedProjects = localStorage.getItem('motion-mosaic-projects')
  if (savedProjects) {
    try {
      useAppStore.setState({ savedProjects: JSON.parse(savedProjects) })
    } catch (e) {
      console.error('Failed to parse saved projects', e)
    }
  }

  // Load main app state
  const savedState = localStorage.getItem('motion-mosaic-state')
  if (savedState) {
    try {
      const parsed = JSON.parse(savedState)
      
      // Clean up session-specific state
      const cleanArchitect = parsed.architect ? {
        ...parsed.architect,
        isGenerating: false,
        script: parsed.architect.script ? {
          ...parsed.architect.script,
          isGeneratingVoiceover: false,
          voiceoverUrl: null // Blob URLs expire on refresh
        } : null,
        scenes: (parsed.architect.scenes || []).map((scene: any) => ({
          ...scene,
          status: scene.status === 'generating' ? 'pending' : scene.status,
          images: (scene.images || [])
            .filter((img: any) => {
              // Remove incomplete placeholders (loading images with no URL, temp IDs)
              if (img.status === 'loading') return false
              if (img.id?.startsWith('temp-')) return false
              if (img.id?.startsWith('nano-pending-')) return false
              if (!img.url || img.url === '') return false
              return true
            })
            .map((img: any) => ({
              ...img,
              status: img.status === 'loading' ? 'error' : img.status
            })),
          video: scene.video ? {
            ...scene.video,
            status: scene.video.status === 'generating' ? 'error' : scene.video.status
          } : undefined
        }))
      } : initialState.architect

      useAppStore.setState({
        provider: parsed.provider || 'kie',
        architect: cleanArchitect,
        images: (parsed.images || []).map((img: any) => ({
          ...img,
          status: img.status === 'loading' ? 'error' : img.status
        })),
        generatedVideos: parsed.generatedVideos || {},
        prompt: parsed.prompt || '',
        topic: parsed.topic || '',
        scriptLength: parsed.scriptLength || 60,
        selectedImageId: parsed.selectedImageId || null,
        isGeneratingImages: false,
        activeVideoTasks: [],
        activeNanoTasks: []
      })
    } catch (e) {
      console.error('Failed to parse saved state', e)
    }
  }
  
  // Persistence Subscriber
  useAppStore.subscribe((state) => {
    const stateToSave = {
      provider: state.provider,
      architect: state.architect,
      images: state.images,
      generatedVideos: state.generatedVideos,
      prompt: state.prompt,
      topic: state.topic,
      scriptLength: state.scriptLength,
      selectedImageId: state.selectedImageId
    }
    localStorage.setItem('motion-mosaic-state', JSON.stringify(stateToSave))
    
    // Also save individual keys for convenience/compatibility
    if (state.kieApiKey) localStorage.setItem('motion-mosaic-kie-key', state.kieApiKey)
    else localStorage.removeItem('motion-mosaic-kie-key')
    
    if (state.googleApiKey) localStorage.setItem('motion-mosaic-google-key', state.googleApiKey)
    else localStorage.removeItem('motion-mosaic-google-key')
    

    localStorage.setItem('motion-mosaic-projects', JSON.stringify(state.savedProjects))
  })
}
