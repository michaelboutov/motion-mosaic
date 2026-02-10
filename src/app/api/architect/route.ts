import { NextRequest, NextResponse } from 'next/server'

interface ArchitectRequest {
  topic: string
  apiKey: string
  provider?: 'kie' | 'google'
  kieModel?: string
  scriptLength?: number
}

const SYSTEM_PROMPT = `
# ROLE
You are the **Viral AI Video Architect**. Your goal is to engineer high-retention short-form videos (TikTok/Reels/Shorts) using a strict automated pipeline. You focus on cinematic storytelling, visual variety, and "The Infinite Loop."

# 1. THE TECH STACK & WORKFLOW (STRICT RULES)

### **A. Midjourney v7 (PRIMARY TOOL)**
*   **Usage:** Generates **80-90%** of the scenes. We want fresh, exciting visuals for the montage.
*   **MANDATORY STYLE:** You **MUST** append this string to the end of EVERY Midjourney prompt:
    > \`35mm film photography, slightly grainy texture, Kodak Portra 400 aesthetic, candid moment --style raw\` 

### **B. Nano Banana Pro (SECONDARY TOOL)**
*   **Usage:** Used **sparingly (2-3 times max)** per video.
*   **Purpose:** Only use this when the script specifically calls for the **Main Character** to reappear (e.g., a flashback, a mirror reflection, or the final loop scene).
*   **Function:** It edits an existing image to keep the face consistent while changing the environment/age.
*   **Reference:** Always refer to "Scene 1" as the reference for Nano Banana tasks to ensure character consistency.

### **C. Grok Video (ANIMATION)**
*   **Mode A (Scene 1 Only):** Lip Sync. The character speaks directly to the camera.
*   **Mode B (Scenes 2-15):** High-Motion & Physics. You must describe how the world moves (e.g., "Gravity reversing," "Walls crumbling," "Water flooding," "Fast drone flyover").
*   **CRITICAL: grokMotion Prompt Length:** Every \`grokMotion\` field MUST be **at least 50 words**. Write rich, cinematic motion descriptions including camera movement, subject action, environmental dynamics, lighting shifts, particle effects, and emotional tone. Be extremely detailed and specific about how the scene animates over the 3-second duration.

### **D. ElevenLabs v3 (AUDIO)**
*   **Requirement:** You must use **Performance Directions** in brackets \`[]\` before every sentence.
*   **Allowed Tags:** \`[whispering]\`, \`[shouting]\`, \`[terrified]\`, \`[deep and confident]\`, \`[crying]\`, \`[laughing]\`, \`[breathless]\`.

---

# 2. VIDEO STRUCTURE
*   **TOTAL DURATION:** Target [TARGET_DURATION] seconds.
*   **SCENE COUNT:** You MUST generate EXACTLY [SCENE_COUNT] scenes.
*   **SCENE DURATION:** Every scene is exactly 3 seconds long.

*   **SCENE 1 (THE HOOK):**
    *   **Duration:** 3 Seconds.
    *   **Visual:** Close-up of Main Character.
    *   **Audio:** Character speaks directly to the camera (Lip Sync).
    *   **Overlay:** One catchy Caption/Title (Max 5 words).

*   **SCENES 2 - (N-1) (THE MONTAGE):**
    *   **Duration:** 3 Seconds each.
    *   **Visual:** Fast-paced evolution, different places, objects, metaphors (Mostly Midjourney).
    *   **Audio:** Background Narration + Music.
    *   **Narration Rule:** The narration text must be long enough to cover the entire montage duration (approx 150 words per minute).

*   **SCENE N (THE LOOP):**
    *   **Duration:** 3 Seconds.
    *   **Visual:** Often brings back the Main Character (using Nano Banana) to close the story visually.
    *   **Audio:** Final narration line that connects to the start.

---

# 3. CRITICAL LOGIC: "THE INFINITE LOOP"

The video must loop perfectly on TikTok.
*   **The Rule:** The **LAST phrase** of the final scene must grammatically and logically lead into the **FIRST phrase** of Scene 1.
*   **Example:**
    *   *End (Final Scene):* "...and that is the only reason why..."
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
      "grokMotion": "Lip Sync: The character stares directly into the camera with an intense, unblinking gaze. Subtle micro-expressions shift across their face as they speak — eyebrows furrowing slightly, lips parting with deliberate weight. The camera slowly pushes in from a medium close-up to an extreme close-up over 3 seconds. Shallow depth of field softens the moody, dimly-lit background while warm key light catches the contours of their face. Dust particles drift lazily through the air. (MUST be at least 50 words)"
    },
    ...
  ]
}
`

export async function POST(request: NextRequest) {
  try {
    let body;
    try {
      body = await request.json()
    } catch (e) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    if (!body) {
      return NextResponse.json({ error: 'Empty request body' }, { status: 400 })
    }

    const { topic, apiKey, provider = 'kie', kieModel = 'gemini-3-flash', scriptLength = 60 } = body

    if (!topic || !apiKey) {
      return NextResponse.json(
        { error: 'Topic and API key are required' },
        { status: 400 }
      )
    }

    // Calculate exact number of scenes: 3 seconds per scene
    const sceneCount = Math.max(5, Math.ceil(scriptLength / 3));
    const dynamicPrompt = SYSTEM_PROMPT
      .replace('[TARGET_DURATION]', scriptLength.toString())
      .replace('[SCENE_COUNT]', sceneCount.toString());

    let content = '';

    if (provider === 'google') {
      try {
        const { GoogleGenAI } = await import('@google/genai')
        const ai = new GoogleGenAI({
          apiKey: apiKey,
        });
        
        const response = await ai.models.generateContent({
          model: 'gemini-2.0-flash', 
          config: {
              systemInstruction: {
                  parts: [{ text: dynamicPrompt }]
              },
              responseMimeType: 'application/json',
          },
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: `Topic: ${topic}. Target Video Length: ${scriptLength} seconds.`,
                },
              ],
            },
          ],
        });

        // Handle response
        if (response.candidates && response.candidates.length > 0) {
            const candidate = response.candidates[0];
            if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
                content = candidate.content.parts[0].text || '';
            }
        }
        
        if (!content) {
            throw new Error('No content generated from Google API');
        }
      } catch (googleError) {
        console.error('Google API Error:', googleError);
        return NextResponse.json({ 
          error: `Google API Error: ${googleError instanceof Error ? googleError.message : 'Unknown error'}`,
        }, { status: 502 });
      }

    } else {
      // Kie.ai implementation - Model in URL as per documentation
      try {
        console.log('Using Kie.ai with model', kieModel)
        
        // Set a timeout for the fetch request (55 seconds)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 55000);
        
        const response = await fetch(`https://api.kie.ai/${kieModel}/v1/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            messages: [
              {
                role: 'system',
                content: dynamicPrompt
              },
              {
                role: 'user',
                content: `Topic: ${topic}. Target Video Length: ${scriptLength} seconds.`
              }
            ],
            stream: false,
            temperature: 0.7
          }),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.text().catch(() => 'Unable to read error response')
        console.error('Kie.ai API Error:', errorData)
        return NextResponse.json({ 
          error: `Kie.ai API error: ${response.status} - ${errorData.substring(0, 200)}`,
        }, { status: 502 })
      }

      const result = await response.json().catch((e) => {
        console.error('Failed to parse Kie.ai response:', e)
        return null
      })
      
      if (!result) {
        return NextResponse.json({ 
          error: 'Failed to parse Kie.ai response as JSON',
        }, { status: 502 })
      }
      
      console.log('--- KIE.AI DEBUG START ---')
      console.log('Status:', response.status)
      console.log('Full Response:', JSON.stringify(result, null, 2))
      
      // Check for explicit error object first
      if (result.error) {
        console.error('Kie.ai Error Object:', result.error)
        const errorMsg = result.error.message || result.error.msg || JSON.stringify(result.error)
        return NextResponse.json({ 
          error: `Kie.ai API Error: ${errorMsg}`,
          details: result.error
        }, { status: 422 })
      }

      // Ultra-robust response parsing for Kie.ai and similar proxies
      
      const findContent = (obj: any): string | null => {
        if (!obj) return null;
        if (typeof obj === 'string') return obj;
        
        // OpenAI/Kie.ai Chat format
        if (obj.choices?.[0]?.message?.content) return obj.choices[0].message.content;
        if (obj.choices?.[0]?.text) return obj.choices[0].text;
        
        // Google Gemini format
        if (obj.candidates?.[0]?.content?.parts?.[0]?.text) return obj.candidates[0].content.parts[0].text;
        
        // Kie.ai Specific or other proxies
        if (obj.data?.choices?.[0]?.message?.content) return obj.data.choices[0].message.content;
        if (obj.data?.content) return obj.data.content;
        if (obj.result) return typeof obj.result === 'string' ? obj.result : findContent(obj.result);
        if (obj.message?.content) return obj.message.content;
        
        // Some APIs return the content directly in a 'text' or 'output' field
        if (obj.text) return typeof obj.text === 'string' ? obj.text : null;
        if (obj.output) return typeof obj.output === 'string' ? obj.output : findContent(obj.output);
        
        // Some proxies wrap in data
        if (obj.data && obj.data !== obj) return findContent(obj.data);
        
        // Anthropic format (just in case)
        if (obj.content?.[0]?.text) return obj.content[0].text;
        if (Array.isArray(obj.content)) {
            for (const item of obj.content) {
                if (item.text) return item.text;
                if (typeof item === 'string') return item;
            }
        }
        
        return null;
      };

      content = findContent(result) || '';

      console.log('Extracted Content Length:', content?.length || 0)
      console.log('--- KIE.AI DEBUG END ---')

      if (!content) {
        console.error('Invalid Kie.ai response structure:', result)
        return NextResponse.json({ 
          error: 'The Kie.ai API returned a response that couldn\'t be parsed. This usually happens when the model name or API path is incorrect.',
          details: result,
          status: response.status,
          keys: Object.keys(result)
        }, { status: 502 })
      }
      
      } catch (fetchError) {
        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
          return NextResponse.json({ 
            error: 'Request timed out. The Kie.ai API took too long to respond.',
          }, { status: 504 })
        }
        console.error('Kie.ai Fetch Error:', fetchError)
        return NextResponse.json({ 
          error: `Failed to connect to Kie.ai API: ${fetchError instanceof Error ? fetchError.message : 'Unknown error'}`,
        }, { status: 502 })
      }
    }

    // Parse JSON content
    // Remove markdown code blocks and handle potential preamble/postamble text
    let jsonString = content.trim();
    
    // Attempt to extract JSON from markdown blocks first
    const jsonMatch = jsonString.match(/```json\s*([\s\S]*?)\s*```/) || jsonString.match(/```\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      jsonString = jsonMatch[1];
    } else {
      // Find the first '{' and last '}' to isolate JSON if it's buried in text
      const firstBrace = jsonString.indexOf('{');
      const lastBrace = jsonString.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        jsonString = jsonString.substring(firstBrace, lastBrace + 1);
      }
    }
    
    let parsedData
    try {
      parsedData = JSON.parse(jsonString)
    } catch (e) {
      console.error('Failed to parse LLM response as JSON:', jsonString)
      // Fallback: If it's not JSON, return a descriptive error
      return NextResponse.json({ 
        error: 'The AI architect returned an invalid script format. Please try again.',
        rawContent: content.substring(0, 500)
      }, { status: 422 })
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
