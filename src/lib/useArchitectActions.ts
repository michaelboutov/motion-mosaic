import { useState, useEffect, useRef } from 'react'
import { useAppStore, Image } from '@/lib/store'
import { startPolling } from '@/lib/usePoll'
import { useToast } from '@/components/Toast'
import { refreshTaskImages, extractTaskId } from '@/lib/refreshTaskImages'

/**
 * All Architect business logic extracted from ViralArchitect.tsx:
 *  - Design / generate strategy
 *  - Scene image generation (Midjourney + Nano Banana)
 *  - Scene video animation (Grok)
 *  - Voiceover generation (ElevenLabs)
 *  - Image URL refresh
 *  - Project save / load / new
 */
export function useArchitectActions() {
  const {
    kieApiKey,
    googleApiKey,
    provider,
    kieModel,
    architect,
    setArchitectState,
    updateScene,
    addSceneImages,
    setTopic,
    topic,
    scriptLength,
    saveProject,
    loadProject,
    newProject,
  } = useAppStore()

  const { toast } = useToast()
  const [isDesigning, setIsDesigning] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [refreshResult, setRefreshResult] = useState<string | null>(null)
  const hasRefreshedRef = useRef(false)
  const hasResumedVideoPollingRef = useRef(false)
  // Use a ref instead of (window as any).__refreshingTasks
  const refreshingTasksRef = useRef(new Set<string>())
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState<string | null>(null)

  // Track unsaved changes by comparing current architect state to last saved snapshot
  const currentSnapshot = architect.strategy ? JSON.stringify({
    strategy: architect.strategy,
    script: architect.script,
    scenes: architect.scenes.map(s => ({ id: s.id, prompt: s.prompt, visual: s.visual, images: s.images.length, selectedImageId: s.selectedImageId })),
  }) : null
  const hasUnsavedChanges = !!(currentSnapshot && currentSnapshot !== lastSavedSnapshot)

  // ── Auto-refresh on page load ──────────────────────────────────────
  const refreshAllImageUrls = async () => {
    if (!kieApiKey || architect.scenes.length === 0) return
    setIsRefreshing(true)
    setRefreshResult(null)
    let refreshed = 0
    let failed = 0

    // Collect all unique tasks across all scenes
    const allTasks: { sceneId: number; taskId: string; isMidjourney: boolean }[] = []
    for (const scene of architect.scenes) {
      const seen = new Set<string>()
      for (const img of scene.images) {
        if (img.status !== 'done') continue
        const taskId = extractTaskId(img)
        if (!taskId || seen.has(taskId)) continue
        seen.add(taskId)
        allTasks.push({
          sceneId: scene.id,
          taskId,
          isMidjourney: img.id.startsWith('mj-'),
        })
      }
    }

    console.log(`[Refresh] ${allTasks.length} unique tasks to refresh`)

    const batchSize = 5
    for (let i = 0; i < allTasks.length; i += batchSize) {
      const batch = allTasks.slice(i, i + batchSize)
      const results = await Promise.allSettled(
        batch.map(async (task) => {
          const currentScene = useAppStore
            .getState()
            .architect.scenes.find((s) => s.id === task.sceneId)
          if (!currentScene) return false

          const result = await refreshTaskImages({
            taskId: task.taskId,
            isMidjourney: task.isMidjourney,
            images: currentScene.images,
            apiKey: kieApiKey!,
          })

          if (result.success && result.updatedImages) {
            updateScene(task.sceneId, { images: result.updatedImages })
            return true
          }
          return false
        })
      )

      for (const r of results) {
        if (r.status === 'fulfilled' && r.value) refreshed++
        else failed++
      }
    }

    console.log(`[Refresh] Done: ${refreshed} refreshed, ${failed} failed`)
    setIsRefreshing(false)
    if (refreshed > 0) {
      setRefreshResult(`Refreshed ${refreshed} task(s)`)
    } else if (failed > 0) {
      setRefreshResult(`Could not refresh ${failed} task(s)`)
    }
    setTimeout(() => setRefreshResult(null), 5000)
  }

  useEffect(() => {
    if (hasRefreshedRef.current) return
    if (!kieApiKey || architect.scenes.length === 0) return
    const hasImages = architect.scenes.some((s) =>
      s.images.some((i) => i.status === 'done')
    )
    if (!hasImages) return
    hasRefreshedRef.current = true
    refreshAllImageUrls()
  }, [kieApiKey, architect.scenes.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Resume polling for scene videos that were generating before refresh ──
  useEffect(() => {
    if (hasResumedVideoPollingRef.current) return
    if (!kieApiKey || architect.scenes.length === 0) return
    const generatingScenes = architect.scenes.filter(
      (s) => s.video?.status === 'generating' && s.video?.taskId
    )
    if (generatingScenes.length === 0) return
    hasResumedVideoPollingRef.current = true
    console.log(`[Resume] Resuming polling for ${generatingScenes.length} scene video(s)`)
    for (const scene of generatingScenes) {
      pollSceneVideo(scene.id, scene.video!.taskId!)
    }
  }, [kieApiKey, architect.scenes.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Design (generate strategy + script + scenes) ───────────────────
  const handleDesign = async () => {
    const activeKey = provider === 'google' ? googleApiKey : kieApiKey
    if (!topic || !activeKey || isDesigning) return

    setIsDesigning(true)
    setArchitectState({ isGenerating: true })

    try {
      const response = await fetch('/api/architect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, apiKey: activeKey, provider, kieModel, scriptLength }),
      })

      // Handle non-JSON responses (e.g. Netlify timeout HTML pages)
      const contentType = response.headers.get('content-type') || ''
      if (!contentType.includes('application/json')) {
        throw new Error(
          response.status === 504
            ? 'Request timed out. The AI took too long to respond. Try a shorter script length.'
            : `Server error (${response.status}). Please try again.`
        )
      }

      const data = await response.json()

      if (data.error) {
        const err = new Error(data.error)
        ;(err as any).details = data.details || data.rawContent
        throw err
      }

      if (!data.scenes || !Array.isArray(data.scenes)) {
        throw new Error('Invalid response format: scenes array missing or malformed')
      }

      setArchitectState({
        strategy: data.strategy,
        script: data.script,
        scenes: data.scenes.map((s: any) => ({
          ...s,
          status: 'pending',
          images: [],
        })),
        isGenerating: false,
      })
    } catch (error: any) {
      console.error('Architect error:', error)
      setArchitectState({ isGenerating: false })

      let errorMessage = 'Failed to generate script. Please try again.'
      if (error instanceof Error) {
        errorMessage = error.message
      }
      if (error.details) {
        console.error('API Error Details:', error.details)
      }
      toast({ title: 'Design failed', description: errorMessage, variant: 'error' })
    } finally {
      setIsDesigning(false)
    }
  }

  // ── Scene image generation ─────────────────────────────────────────
  const handleGenerateScene = async (
    sceneId: number,
    tool: 'Midjourney' | 'Nano Banana',
    prompt: string,
    reference?: string
  ) => {
    if (!kieApiKey) return

    updateScene(sceneId, { status: 'generating' })

    try {
      if (tool === 'Midjourney') {
        const response = await fetch('/api/generate-batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt,
            apiKey: kieApiKey,
            batchCount: 3,
            aspectRatio: '9:16',
          }),
        })

        const result = await response.json()

        if (result.success && result.tasks) {
          const placeholders: Image[] = result.tasks.flatMap((task: any) =>
            Array(4)
              .fill(0)
              .map((_, i) => ({
                id: `temp-${task.taskId}-${i}`,
                url: '',
                status: 'loading',
                prompt,
              }))
          )
          addSceneImages(sceneId, placeholders)
          pollBatchTasks(sceneId, result.tasks)
        }
      } else if (tool === 'Nano Banana') {
        const scene1 = architect.scenes.find((s) => s.id === 1)
        if (!scene1) {
          toast({ title: 'Scene 1 not found', variant: 'error' })
          updateScene(sceneId, { status: 'pending' })
          return
        }

        const refImage =
          scene1.images.find((img) => img.id === scene1.selectedImageId) ||
          scene1.images.find((img) => img.status === 'done')

        if (!refImage) {
          toast({ title: 'No reference image', description: 'Please generate and select a reference image in Scene 1 first.', variant: 'warning' })
          updateScene(sceneId, { status: 'pending' })
          return
        }

        const response = await fetch('/api/generate-nano', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${kieApiKey}`,
          },
          body: JSON.stringify({
            imageUrl: refImage.url,
            prompt,
            aspectRatio: '9:16',
          }),
        })

        const result = await response.json()
        if (result.success) {
          pollNanoTask(sceneId, result.taskId, refImage.id)
        }
      }
    } catch (error) {
      console.error(`Error generating scene ${sceneId}:`, error)
      updateScene(sceneId, { status: 'error' })
    }
  }

  // ── Batch polling (Midjourney) ─────────────────────────────────────
  const pollBatchTasks = (sceneId: number, tasks: any[]) => {
    const completedTaskIds = new Set<string>()

    startPolling({
      intervalMs: 3000,
      maxAttempts: 100,
      onTimeout: () => updateScene(sceneId, { status: 'error' }),
      checkFn: async () => {
        let allDone = true
        const newCompletedTasks: any[] = []

        for (const task of tasks) {
          if (completedTaskIds.has(task.taskId)) continue

          try {
            const res = await fetch(
              `/api/generate-batch/callback?taskId=${task.taskId}`,
              { headers: { Authorization: `Bearer ${kieApiKey}` } }
            )
            const data = await res.json()

            if (data.status === 'success' && data.resultUrls) {
              completedTaskIds.add(task.taskId)
              newCompletedTasks.push({ task, urls: data.resultUrls })
            } else if (data.status === 'fail') {
              completedTaskIds.add(task.taskId)
              const currentScene = useAppStore
                .getState()
                .architect.scenes.find((s) => s.id === sceneId)
              if (currentScene) {
                const updatedImages = currentScene.images.filter(
                  (img) => !img.id.startsWith(`temp-${task.taskId}`)
                )
                updateScene(sceneId, { images: updatedImages })
              }
            } else {
              allDone = false
            }
          } catch {
            allDone = false
          }
        }

        if (newCompletedTasks.length > 0) {
          const currentScene = useAppStore
            .getState()
            .architect.scenes.find((s) => s.id === sceneId)
          if (currentScene) {
            let updatedImages = [...currentScene.images]

            newCompletedTasks.forEach(({ task, urls }) => {
              updatedImages = updatedImages.filter(
                (img) => !img.id.startsWith(`temp-${task.taskId}`)
              )
              const realImages: Image[] = urls.map((url: string, idx: number) => ({
                id: `mj-${task.taskId}-${idx}`,
                url,
                status: 'done',
                prompt: 'Scene generation',
                taskId: task.taskId,
              }))
              updatedImages.push(...realImages)
            })

            updateScene(sceneId, { images: updatedImages })
          }
        }

        if (allDone) {
          updateScene(sceneId, { status: 'done' })
          return 'done'
        }
        return 'continue'
      },
    })
  }

  // ── Nano polling ───────────────────────────────────────────────────
  const pollNanoTask = (sceneId: number, taskId: string, _sourceId: string) => {
    addSceneImages(sceneId, [
      {
        id: `nano-pending-${taskId}`,
        url: '',
        status: 'loading',
        prompt: 'Nano Banana Edit',
      },
    ])

    startPolling({
      intervalMs: 3000,
      maxAttempts: 60,
      onTimeout: () => {
        updateScene(sceneId, { status: 'error' })
        const currentScene = useAppStore
          .getState()
          .architect.scenes.find((s) => s.id === sceneId)
        if (currentScene) {
          const updatedImages = currentScene.images.map((img) =>
            img.id === `nano-pending-${taskId}`
              ? { ...img, status: 'error' as const }
              : img
          )
          updateScene(sceneId, { images: updatedImages })
        }
      },
      checkFn: async () => {
        const res = await fetch(`/api/nano-callback?taskId=${taskId}`, {
          headers: { Authorization: `Bearer ${kieApiKey}` },
        })
        const data = await res.json()

        if (data.status === 'success' && data.imageUrls) {
          const newImages = data.imageUrls.map((url: string, i: number) => ({
            id: `nano-${taskId}-${i}`,
            url,
            status: 'done',
            prompt: 'Nano Edit',
            taskId,
          }))

          const currentScene = useAppStore
            .getState()
            .architect.scenes.find((s) => s.id === sceneId)
          if (currentScene) {
            const updatedImages = currentScene.images.filter(
              (img) => img.id !== `nano-pending-${taskId}`
            )
            updatedImages.push(...newImages)
            updateScene(sceneId, { images: updatedImages, status: 'done' })
          }
          return 'done'
        } else if (data.status === 'fail') {
          updateScene(sceneId, { status: 'error' })
          return 'done'
        }
        return 'continue'
      },
    })
  }

  // ── Scene video animation ──────────────────────────────────────────
  const handleAnimateScene = async (
    sceneId: number,
    options?: { model?: 'seedream' | 'grok'; prompt?: string; duration?: string; mode?: string }
  ) => {
    if (!kieApiKey) return

    const scene = architect.scenes.find((s) => s.id === sceneId)
    if (!scene) return

    const selectedImg =
      scene.images.find((img) => img.id === scene.selectedImageId) ||
      scene.images.find((img) => img.status === 'done')

    if (!selectedImg) {
      toast({ title: 'No image selected', description: 'Please generate and select an image first.', variant: 'warning' })
      return
    }

    updateScene(sceneId, { video: { url: '', status: 'generating' } })

    const selectedModel = options?.model || 'seedream'
    const videoPrompt = options?.prompt || scene.grokMotion || 'Animate this image'

    try {
      const response = await fetch('/api/generate-video', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${kieApiKey}`,
        },
        body: JSON.stringify({
          imageUrl: selectedImg.url,
          prompt: videoPrompt,
          model: selectedModel === 'grok' ? 'grok-imagine/image-to-video' : 'bytedance/seedance-1.5-pro',
          ...(selectedModel === 'grok' && {
            duration: options?.duration || '6',
            mode: options?.mode || 'normal',
          }),
        }),
      })

      const result = await response.json()
      if (result.success && result.taskId) {
        updateScene(sceneId, {
          video: { url: '', status: 'generating', taskId: result.taskId },
        })
        pollSceneVideo(sceneId, result.taskId)
      } else {
        throw new Error(result.error || 'Failed to start animation')
      }
    } catch (error) {
      console.error(`Error animating scene ${sceneId}:`, error)
      updateScene(sceneId, { video: { url: '', status: 'error' } })
    }
  }

  const pollSceneVideo = (sceneId: number, taskId: string) => {
    startPolling({
      intervalMs: 3000,
      maxAttempts: 120,
      onTimeout: () =>
        updateScene(sceneId, { video: { url: '', status: 'error' } }),
      checkFn: async () => {
        const res = await fetch(`/api/video-callback?taskId=${taskId}`, {
          headers: { Authorization: `Bearer ${kieApiKey}` },
        })
        const data = await res.json()

        if (data.status === 'success' && data.videoUrl) {
          updateScene(sceneId, {
            video: { url: data.videoUrl, status: 'done', taskId },
          })
          return 'done'
        } else if (data.status === 'fail') {
          updateScene(sceneId, { video: { url: '', status: 'error' } })
          return 'done'
        }
        return 'continue'
      },
    })
  }

  // ── Voiceover ──────────────────────────────────────────────────────
  const handleGenerateVoiceover = async () => {
    if (!kieApiKey || !architect.script) {
      if (!kieApiKey) toast({ title: 'API key required', description: 'Please set your Kie.ai API Key in settings.', variant: 'warning' })
      return
    }

    setArchitectState({
      script: { ...architect.script, isGeneratingVoiceover: true },
    })

    try {
      const fullScript = `${architect.script.scene1}. ${architect.script.narration}`
      const response = await fetch('/api/generate-voiceover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: fullScript, apiKey: kieApiKey }),
      })

      const result = await response.json()
      if (!result.success || !result.taskId)
        throw new Error(result.error || 'Failed to create voiceover task')

      const taskId = result.taskId

      startPolling({
        intervalMs: 3000,
        maxAttempts: 120,
        onTimeout: () => {
          setArchitectState({
            script: {
              ...useAppStore.getState().architect.script!,
              isGeneratingVoiceover: false,
            },
          })
          toast({ title: 'Voiceover timed out', description: 'Voiceover generation timed out.', variant: 'error' })
        },
        checkFn: async () => {
          const res = await fetch(`/api/generate-voiceover?taskId=${taskId}`, {
            headers: { Authorization: `Bearer ${kieApiKey}` },
          })
          const data = await res.json()

          if (data.status === 'success' && data.audioUrl) {
            setArchitectState({
              script: {
                ...useAppStore.getState().architect.script!,
                voiceoverUrl: data.audioUrl,
                isGeneratingVoiceover: false,
              },
            })
            return 'done'
          } else if (data.status === 'fail') {
            setArchitectState({
              script: {
                ...useAppStore.getState().architect.script!,
                isGeneratingVoiceover: false,
              },
            })
            toast({ title: 'Voiceover failed', description: data.error || 'Voiceover generation failed.', variant: 'error' })
            return 'done'
          }
          return 'continue'
        },
      })
    } catch (error) {
      console.error('Voiceover error:', error)
      toast({ title: 'Voiceover error', description: 'Failed to generate voiceover. Please check your Kie.ai API key.', variant: 'error' })
      setArchitectState({
        script: { ...architect.script, isGeneratingVoiceover: false },
      })
    }
  }

  // ── Generate all pending scenes ────────────────────────────────────
  const handleGenerateAllScenes = async () => {
    if (!kieApiKey) return

    const pendingScenes = architect.scenes.filter((s) => s.status === 'pending')
    if (pendingScenes.length === 0) {
      toast({ title: 'No pending scenes', description: 'All scenes are already generated.', variant: 'default' })
      return
    }

    toast({ title: `Generating ${pendingScenes.length} scene${pendingScenes.length > 1 ? 's' : ''}…`, description: 'This may take a few minutes. You can continue working.', variant: 'default' })

    for (const scene of pendingScenes) {
      handleGenerateScene(scene.id, scene.tool, scene.prompt)
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
  }

  // ── Image error / refresh (with dedup via ref) ─────────────────────
  const handleImageError = async (
    sceneId: number,
    imageId: string,
    storedTaskId: string | undefined
  ) => {
    const taskId = extractTaskId({ id: imageId, taskId: storedTaskId })
    if (!kieApiKey || !taskId) return

    const refreshKey = `${sceneId}-${taskId}`
    if (refreshingTasksRef.current.has(refreshKey)) return
    refreshingTasksRef.current.add(refreshKey)

    try {
      const currentScene = useAppStore
        .getState()
        .architect.scenes.find((s) => s.id === sceneId)
      if (!currentScene) return

      const result = await refreshTaskImages({
        taskId,
        isMidjourney: imageId.startsWith('mj-'),
        images: currentScene.images,
        apiKey: kieApiKey,
      })

      if (result.success && result.updatedImages) {
        updateScene(sceneId, { images: result.updatedImages })
      }
    } catch (error) {
      console.error(`Failed to refresh task ${taskId}:`, error)
    } finally {
      setTimeout(() => {
        refreshingTasksRef.current.delete(refreshKey)
      }, 10000)
    }
  }

  // ── Project actions ────────────────────────────────────────────────
  const handleSave = () => {
    if (!architect.strategy) return
    const name = prompt(
      'Enter a name for this project:',
      architect.strategy.concept || 'Untitled Project'
    )
    if (name) {
      saveProject({ name, architect })
      setLastSavedSnapshot(currentSnapshot)
      toast({ title: 'Project saved', variant: 'success' })
    }
  }

  const handleNewProject = () => {
    newProject()
    setTopic('')
  }

  return {
    isDesigning,
    isRefreshing,
    refreshResult,
    hasUnsavedChanges,
    handleDesign,
    handleGenerateScene,
    handleAnimateScene,
    handleGenerateVoiceover,
    handleGenerateAllScenes,
    handleImageError,
    handleSave,
    handleNewProject,
    refreshAllImageUrls,
    loadProject,
  }
}
