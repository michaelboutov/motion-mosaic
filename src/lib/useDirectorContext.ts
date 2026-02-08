import { useAppStore } from '@/lib/store'

export function useDirectorContext(viewMode: 'mosaic' | 'architect') {
  const state = useAppStore()

  return buildDirectorContext(state, viewMode)
}

export function buildDirectorContext(
  state: ReturnType<typeof useAppStore.getState>,
  viewMode: 'mosaic' | 'architect'
) {
  const { topic, scriptLength, architect, images, prompt, isGeneratingImages, activeVideoTasks, activeNanoTasks } = state

  const context: Record<string, any> = {
    viewMode,
    topic: topic || '(not set)',
    scriptLength,
  }

  // Architect state
  if (architect) {
    // Scene 1 reference character info (used by Nano Banana for all swaps)
    const scene1 = architect.scenes.find((s) => s.id === 1)
    const scene1SelectedImage = scene1?.images.find((img) => img.id === scene1?.selectedImageId)
    const scene1AnyDone = scene1?.images.find((img) => img.status === 'done')
    const refImage = scene1SelectedImage || scene1AnyDone

    context.architect = {
      hasStrategy: !!architect.strategy,
      concept: architect.strategy?.concept || null,
      loopLogic: architect.strategy?.loopLogic || null,
      music: architect.strategy?.music || null,
      overlay: architect.strategy?.overlay || null,
      hasScript: !!architect.script,
      narration: architect.script?.narration || null,
      scene1Dialog: architect.script?.scene1 || null,
      sceneCount: architect.scenes.length,
      isGenerating: architect.isGenerating,
      // Character reference info for swaps
      characterReference: {
        hasScene1Image: !!refImage,
        scene1Visual: scene1?.visual || null,
        scene1Prompt: scene1?.prompt || null,
        scene1ImageUrl: refImage?.url || null,
      },
      scenes: architect.scenes.map((s) => {
        const selectedImg = s.images.find((img) => img.id === s.selectedImageId)
        return {
          id: s.id,
          tool: s.tool,
          reference: s.reference,
          status: s.status,
          imageCount: s.images.length,
          hasSelectedImage: !!s.selectedImageId,
          selectedImageUrl: selectedImg?.url || null,
          selectedImagePrompt: selectedImg?.prompt || null,
          hasVideo: !!s.video?.url,
          videoStatus: s.video?.status || null,
          videoPromptUsed: selectedImg?.videoPrompt || null,
          prompt: s.prompt,
          grokMotion: s.grokMotion || '(not set)',
          visual: s.visual,
          isSwapScene: s.tool === 'Nano Banana',
        }
      }),
    }
  }

  // Mosaic state
  context.mosaic = {
    imageCount: images.length,
    doneCount: images.filter((i) => i.status === 'done').length,
    errorCount: images.filter((i) => i.status === 'error').length,
    loadingCount: images.filter((i) => i.status === 'loading').length,
    prompt: prompt || '(not set)',
    isGenerating: isGeneratingImages,
  }

  // Active tasks
  context.activeTasks = {
    videoTasks: activeVideoTasks.length,
    nanoTasks: activeNanoTasks.length,
  }

  return context
}
