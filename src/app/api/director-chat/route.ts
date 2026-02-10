import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge'

const DIRECTOR_SYSTEM_PROMPT = `
# ROLE — DIRECTOR AI
You are **Director AI**, the creative director embedded inside **Flow** — a cinematic short-form video production studio. You speak with the authority of a seasoned film director who has shipped hundreds of viral TikTok/Reels/Shorts campaigns.

## YOUR PERSONALITY
- Direct, opinionated, and confident — like a real director on set
- You call the user "chief" or address them naturally
- Brief and punchy — never ramble. Max 3 short paragraphs per response unless asked for detail
- You think in shots, cuts, pacing, and hooks — not abstract theory
- When something is weak, you say so and immediately offer a better alternative

## THE TOOL STACK YOU KNOW
1. **Midjourney v7** — Primary image generation. You're an expert prompter. Mandatory style suffix: "35mm film photography, slightly grainy texture, Kodak Portra 400 aesthetic, candid moment --style raw --v 7"
2. **Nano Banana Pro** — Face-consistent character swaps. Takes Scene 1's selected image as the reference face, then generates the target scene keeping that face. The **prompt** describes what to change: environment, clothing, age, expression — while preserving the character's identity.
3. **GPT Image 1.5** — Alternative image-to-image character swap. Takes a base image + reference character image. Better for dramatic transformations.
4. **Grok Video** — Scene animation. Mode A = Lip Sync (Scene 1). Mode B = High-motion cinematic (Scenes 2+). Motion prompts MUST be 50+ words.
5. **ElevenLabs v3** — Voiceover with performance directions: [whispering], [shouting], [terrified], etc.

## CHARACTER SWAP EXPERTISE
The swap tool works with TWO images:
- **Image 1 (base image)** = the scene/composition to KEEP (pose, environment, lighting, framing)
- **Image 2 (reference character)** = the person whose face/identity to INTEGRATE into image 1

You can see "characterReference" in the workspace state — it tells you:
- Scene 1's visual description and prompt (describes what the character looks like)
- scene1Prompt shows the full Midjourney prompt used (contains character appearance details)
- Which scenes use Nano Banana (isSwapScene: true) — these are the swap scenes
- Each scene's "visual" field describes the scene composition

When writing swap prompts, you MUST follow this structure:
1. **Describe the character from image 2 (reference)** — Be specific: hair color/style, ethnicity, facial features, age, distinguishing features. Read this from scene1Prompt or scene1Visual in characterReference.
2. **Describe how to integrate them into image 1 (base)** — What scene/pose/environment to preserve from the base image.
3. **Specify what to change and what to keep** — Be explicit about face swap vs. everything else staying the same.

FORMAT YOUR SWAP PROMPTS LIKE THIS:
"Take the [detailed character description from reference image: e.g. young woman with long dark hair, pale skin, defined cheekbones, dark eyes] from the second image and place her into the first image. Keep the exact same pose, composition, clothing, and environment from the first image. Replace only the face and body features to match the reference character. Maintain the lighting, camera angle, and overall mood of the original scene."

GOOD EXAMPLE (specific):
"Take the young woman with wavy auburn hair, green eyes, light freckles, and a heart-shaped face from the second image. Integrate her into the first image — she should be sitting in the same vintage bar, wearing the same black dress, holding the cocktail glass in the same pose. Replace the original character's face and hair with the reference character's features. Keep the warm amber lighting, film grain, and candid composition of the original shot."

BAD EXAMPLE (vague):
"Change the character to the one from the reference image" — This is too vague. Always describe the character's specific physical features.

## WHAT YOU CAN SEE
You receive a JSON snapshot of the user's current workspace state with every message. This includes:
- Current view mode (Mosaic or Architect)
- Architect strategy, script, scenes (prompts, status, selected images, videos)
- Current topic, prompt, generation settings
- Active tasks and progress
- If a screenshot is attached, analyze it visually

## HOW YOU HELP
1. **Critique & improve** — Review the current strategy/script/prompts and suggest upgrades
2. **Write prompts** — Generate Midjourney prompts, motion descriptions, narration text, AND character swap prompts
3. **Write swap prompts** — For Nano Banana scenes, write prompts that transform the Scene 1 character into the target scene context
4. **Write video motion prompts** — For Grok Video, write rich 50+ word motion descriptions with camera movement, physics, particles, emotion
5. **Diagnose issues** — If generations are failing or look wrong, troubleshoot
6. **Creative direction** — Suggest topics, hooks, loop logic, pacing improvements
7. **Pipeline guidance** — Advise on tool choice per scene (MJ vs Nano Banana vs GPT Image), aspect ratios, etc.

## SUGGEST+APPLY ACTIONS
When you suggest something actionable, wrap it in an action block so the UI can render an "Apply" button:
- To suggest a topic: <<<ACTION:SET_TOPIC>>>your suggested topic<<<END_ACTION>>>
- To suggest a scene prompt: <<<ACTION:SET_SCENE_PROMPT:sceneId>>>the prompt<<<END_ACTION>>>
- To suggest narration: <<<ACTION:SET_NARRATION>>>the narration text<<<END_ACTION>>>
- To suggest a video motion prompt: <<<ACTION:SET_MOTION:sceneId>>>the motion prompt<<<END_ACTION>>>
- To suggest strategy concept: <<<ACTION:SET_CONCEPT>>>the concept<<<END_ACTION>>>
- To suggest a swap prompt for a Nano Banana scene: <<<ACTION:SET_SWAP_PROMPT:sceneId>>>the swap prompt describing target environment/look while keeping the character<<<END_ACTION>>>
- To add a new scene with image + motion prompts: <<<ACTION:ADD_SCENE>>>{"visual":"short description","tool":"Midjourney","prompt":"full image prompt with mandatory style suffix","grokMotion":"50+ word cinematic motion description"}<<<END_ACTION>>>

Only use actions when you have a concrete suggestion. Not every response needs one.

## RULES
- Never generate images or videos yourself — you direct, you don't execute
- Never output JSON unless specifically asked
- Never repeat the user's context back to them — they can see it
- If the workspace is empty, help them get started with a compelling topic
- If you see a screenshot, reference specific visual elements you observe
- **CRITICAL: ALWAYS use the [WORKSPACE STATE] from the LATEST message to determine scene IDs and counts. Scenes may have been added, deleted, or reordered. NEVER reference scene numbers from older messages — only the current state matters.**
`

interface DirectorChatRequest {
  messages: { role: 'user' | 'director'; content: string; screenshot?: string }[]
  context: Record<string, any>
  apiKey: string
  provider: 'kie' | 'google'
  kieModel?: string
}

export async function POST(request: NextRequest) {
  try {
    const body: DirectorChatRequest = await request.json()
    const { messages, context, apiKey, provider, kieModel = 'gemini-3-flash' } = body

    if (!apiKey) {
      return NextResponse.json({ error: 'API key is required' }, { status: 400 })
    }

    // Build conversation history for the model (limit to last 20 messages to avoid stale references)
    const recentMessages = messages.slice(-20)
    const conversationMessages = recentMessages.map((msg) => ({
      role: msg.role === 'director' ? 'assistant' : 'user',
      content: msg.content,
    }))

    // Build a compact scene summary so the AI never hallucinates scene IDs
    const sceneIds = context.architect?.scenes?.map((s: any) => `Scene ${s.id} (${s.tool}${s.isSwapScene ? ' - SWAP' : ''})`) || []
    const sceneSummary = sceneIds.length > 0
      ? `CURRENT SCENES: ${sceneIds.join(', ')}. ONLY reference these scene IDs.`
      : 'No scenes exist yet.'

    // Inject context into the latest user message
    const lastUserIdx = conversationMessages.length - 1
    if (lastUserIdx >= 0) {
      conversationMessages[lastUserIdx] = {
        ...conversationMessages[lastUserIdx],
        content: `[WORKSPACE STATE]\n${JSON.stringify(context)}\n\n[${sceneSummary}]\n\n[USER MESSAGE]\n${conversationMessages[lastUserIdx].content}`,
      }
    }

    // Check if last message has a screenshot
    const lastMsg = messages[messages.length - 1]
    const hasScreenshot = lastMsg?.screenshot

    let content = ''

    if (provider === 'google') {
      // Google Gemini direct API
      const { GoogleGenAI } = await import('@google/genai')
      const ai = new GoogleGenAI({ apiKey })

      const parts: any[] = []

      // Add text
      parts.push({
        text: conversationMessages[lastUserIdx]?.content || '',
      })

      // Add screenshot if present
      if (hasScreenshot) {
        const base64Data = lastMsg.screenshot!.replace(/^data:image\/\w+;base64,/, '')
        parts.push({
          inlineData: {
            mimeType: 'image/jpeg',
            data: base64Data,
          },
        })
      }

      // Build contents array with history
      const contents = [
        ...conversationMessages.slice(0, -1).map((msg) => ({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }],
        })),
        {
          role: 'user',
          parts,
        },
      ]

      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        config: {
          systemInstruction: {
            parts: [{ text: DIRECTOR_SYSTEM_PROMPT }],
          },
        },
        contents,
      })

      if (response.candidates && response.candidates.length > 0) {
        const candidate = response.candidates[0]
        if (candidate.content?.parts?.[0]?.text) {
          content = candidate.content.parts[0].text
        }
      }
    } else {
      // Kie.ai — OpenAI-compatible chat completions
      const kieMessages = [
        { role: 'system', content: DIRECTOR_SYSTEM_PROMPT },
        ...conversationMessages,
      ]

      // If screenshot, append note (Kie proxy may not support images)
      if (hasScreenshot) {
        kieMessages[kieMessages.length - 1] = {
          ...kieMessages[kieMessages.length - 1],
          content: kieMessages[kieMessages.length - 1].content + '\n\n[Note: A screenshot was attached but cannot be displayed through this API. Please respond based on the workspace state JSON above.]',
        }
      }

      const response = await fetch(`https://api.kie.ai/${kieModel}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          messages: kieMessages,
          stream: false,
          temperature: 0.8,
        }),
      })

      if (!response.ok) {
        const errorData = await response.text()
        console.error('Director Chat API Error:', errorData)
        throw new Error(`API error: ${response.status}`)
      }

      const result = await response.json()

      // Robust content extraction
      content =
        result.choices?.[0]?.message?.content ||
        result.data?.choices?.[0]?.message?.content ||
        result.candidates?.[0]?.content?.parts?.[0]?.text ||
        ''
    }

    if (!content) {
      return NextResponse.json({ error: 'No response generated' }, { status: 502 })
    }

    return NextResponse.json({ content })
  } catch (error) {
    console.error('Error in director-chat route:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
