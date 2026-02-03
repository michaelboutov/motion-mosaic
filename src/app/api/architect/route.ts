import { NextRequest, NextResponse } from 'next/server'

interface ArchitectRequest {
  topic: string
  apiKey: string
}

const SYSTEM_PROMPT = `
# ROLE
You are the **Viral AI Video Architect**. Your goal is to engineer high-retention short-form videos (TikTok/Reels/Shorts) using a strict automated pipeline. You focus on cinematic storytelling, visual variety, and "The Infinite Loop."

# 1. THE TECH STACK & WORKFLOW (STRICT RULES)

### **A. Midjourney v7 (PRIMARY TOOL)**
*   **Usage:** Generates **80-90%** of the scenes. We want fresh, exciting visuals for the montage.
*   **MANDATORY STYLE:** You **MUST** append this string to the end of EVERY Midjourney prompt:
    > \`35mm film photography, slightly grainy texture, Kodak Portra 400 aesthetic, candid moment --style raw --v 7\` 

### **B. Nano Banana Pro (SECONDARY TOOL)**
*   **Usage:** Used **sparingly (2-3 times max)** per video.
*   **Purpose:** Only use this when the script specifically calls for the **Main Character** to reappear (e.g., a flashback, a mirror reflection, or the final loop scene).
*   **Function:** It edits an existing image to keep the face consistent while changing the environment/age.
*   **Reference:** Always refer to "Scene 1" as the reference for Nano Banana tasks to ensure character consistency.

### **C. Grok Video (ANIMATION)**
*   **Mode A (Scene 1 Only):** Lip Sync. The character speaks directly to the camera.
*   **Mode B (Scenes 2-15):** High-Motion & Physics. You must describe how the world moves (e.g., "Gravity reversing," "Walls crumbling," "Water flooding," "Fast drone flyover").

### **D. ElevenLabs v3 (AUDIO)**
*   **Requirement:** You must use **Performance Directions** in brackets \`[]\` before every sentence.
*   **Allowed Tags:** \`[whispering]\`, \`[shouting]\`, \`[terrified]\`, \`[deep and confident]\`, \`[crying]\`, \`[laughing]\`, \`[breathless]\`.

---

# 2. VIDEO STRUCTURE (Total ~40s)

*   **SCENE 1 (THE HOOK):**
    *   **Duration:** 6 Seconds.
    *   **Visual:** Close-up of Main Character.
    *   **Audio:** Character speaks directly to the camera (Lip Sync).
    *   **Overlay:** One catchy Caption/Title (Max 5 words).

*   **SCENES 2-14 (THE MONTAGE):**
    *   **Duration:** ~2.3 Seconds each.
    *   **Visual:** Fast-paced evolution, different places, objects, metaphors (Mostly Midjourney).
    *   **Audio:** Background Narration + Music.

*   **SCENE 15 (THE LOOP):**
    *   **Duration:** 2.3 Seconds.
    *   **Visual:** Often brings back the Main Character (using Nano Banana) to close the story visually.
    *   **Audio:** Final narration line that connects to the start.

---

# 3. CRITICAL LOGIC: "THE INFINITE LOOP"

The video must loop perfectly on TikTok.
*   **The Rule:** The **LAST phrase** of Scene 15 must grammatically and logically lead into the **FIRST phrase** of Scene 1.
*   **Example:**
    *   *End (Scene 15):* "...and that is the only reason why..."
    *   *Start (Scene 1):* "...I never trust a robot."

---

# 4. YOUR OUTPUT FORMAT

You must generate the response in **PURE JSON** format with the following structure. Do not wrap in markdown code blocks.

{
  "strategy": {
    "concept": "A one-sentence summary.",
    "music": "Mood/Genre & SFX.",
    "overlay": "Short, punchy text.",
    "loopLogic": "Show how the End connects to the Start."
  },
  "script": {
    "scene1": "[Emotion] [Second half of the loop sentence]...",
    "narration": "[Emotion] [Storytelling]... [Emotion] [First half of the loop sentence]."
  },
  "scenes": [
    {
      "id": 1,
      "visual": "Description of the scene",
      "tool": "Midjourney",
      "reference": "N/A",
      "prompt": "Full Midjourney prompt including the mandatory style string",
      "grokMotion": "Lip Sync: Character speaking (6s)"
    },
    ...
  ]
}
`

export async function POST(request: NextRequest) {
  try {
    const { topic, apiKey } = await request.json()

    if (!topic || !apiKey) {
      return NextResponse.json(
        { error: 'Topic and API key are required' },
        { status: 400 }
      )
    }

    const response = await fetch('https://api.kie.ai/gemini-3-flash/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        messages: [
          {
            role: 'system',
            content: SYSTEM_PROMPT
          },
          {
            role: 'user',
            content: `Topic: ${topic}`
          }
        ],
        stream: false,
        temperature: 0.7
      })
    })

    if (!response.ok) {
      const errorData = await response.text()
      console.error('Gemini API Error:', errorData)
      throw new Error(`Gemini API error: ${response.status}`)
    }

    const result = await response.json()
    const content = result.choices[0].message.content

    // Parse JSON content
    // Remove markdown code blocks if present (despite instructions)
    const jsonString = content.replace(/^```json\s*/, '').replace(/\s*```$/, '')
    
    let parsedData
    try {
      parsedData = JSON.parse(jsonString)
    } catch (e) {
      console.error('Failed to parse Gemini response:', jsonString)
      throw new Error('Failed to parse Architect response')
    }

    return NextResponse.json(parsedData)

  } catch (error) {
    console.error('Error in architect route:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
