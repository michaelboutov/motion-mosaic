import { NextRequest, NextResponse } from 'next/server'

const ENHANCE_SYSTEM_PROMPT = `You are a Midjourney prompt expert. The user will give you a scene prompt for Midjourney image generation. Your job is to refine and expand it for better, more cinematic results while keeping the original intent.

Rules:
- Keep the core subject/concept intact
- Add cinematic lighting, composition, and mood details
- Add texture and material descriptions where relevant
- Keep it under 400 words
- Do NOT add --ar, --v, --style, or any Midjourney parameters — those are handled separately
- If the prompt already ends with a style suffix like "35mm film photography..." keep it
- Return ONLY the enhanced prompt text, no explanation`

export async function POST(request: NextRequest) {
  try {
    const { prompt, apiKey, provider = 'kie', kieModel = 'gemini-3-flash' } = await request.json()

    if (!prompt || !apiKey) {
      return NextResponse.json({ error: 'Prompt and API key required' }, { status: 400 })
    }

    let enhanced = ''

    if (provider === 'google') {
      const { GoogleGenAI } = await import('@google/genai')
      const ai = new GoogleGenAI({ apiKey })
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        config: {
          systemInstruction: { parts: [{ text: ENHANCE_SYSTEM_PROMPT }] },
        },
        contents: [{ role: 'user', parts: [{ text: `Enhance this Midjourney prompt:\n\n${prompt}` }] }],
      })
      if (response.candidates?.[0]?.content?.parts?.[0]?.text) {
        enhanced = response.candidates[0].content.parts[0].text
      }
    } else {
      const response = await fetch(`https://api.kie.ai/${kieModel}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: ENHANCE_SYSTEM_PROMPT },
            { role: 'user', content: `Enhance this Midjourney prompt:\n\n${prompt}` },
          ],
          stream: false,
          temperature: 0.7,
        }),
      })

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`)
      }

      const result = await response.json()
      enhanced =
        result.choices?.[0]?.message?.content ||
        result.data?.choices?.[0]?.message?.content ||
        ''
    }

    if (!enhanced) {
      return NextResponse.json({ error: 'No enhanced prompt returned' }, { status: 502 })
    }

    return NextResponse.json({ enhanced: enhanced.trim() })
  } catch (error) {
    console.error('Error enhancing prompt:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
