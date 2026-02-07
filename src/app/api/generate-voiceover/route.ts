import { NextRequest, NextResponse } from 'next/server'

// POST: Create an ElevenLabs voiceover task via Kie.ai
export async function POST(request: NextRequest) {
  try {
    const { text, apiKey, voiceId = 'pNInz6obpgDQGcFmaJgB', stability = 0.5, languageCode = 'auto' } = await request.json()

    if (!text || !apiKey) {
      return NextResponse.json(
        { error: 'Text and Kie.ai API key are required' },
        { status: 400 }
      )
    }

    const response = await fetch('https://api.kie.ai/api/v1/jobs/createTask', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'elevenlabs/text-to-dialogue-v3',
        input: {
          stability,
          language_code: languageCode,
          dialogue: [
            {
              text,
              voice: voiceId
            }
          ]
        }
      })
    })

    const data = await response.json()
    console.log('[Voiceover] createTask response:', JSON.stringify(data).slice(0, 500))

    if (data.code === 200 && data.data?.taskId) {
      return NextResponse.json({ success: true, taskId: data.data.taskId })
    }

    return NextResponse.json(
      { error: data.message || 'Failed to create voiceover task' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Error in generate-voiceover POST:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET: Poll voiceover task status via Kie.ai recordInfo
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const taskId = searchParams.get('taskId')
  const apiKey = request.headers.get('Authorization')?.replace('Bearer ', '')

  if (!taskId) {
    return NextResponse.json({ error: 'Task ID is required' }, { status: 400 })
  }

  if (!apiKey) {
    return NextResponse.json({ error: 'API key is required' }, { status: 401 })
  }

  try {
    const res = await fetch(`https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${taskId}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    })

    const data = await res.json()
    console.log(`[Voiceover] recordInfo for ${taskId}:`, JSON.stringify(data).slice(0, 500))

    if (data.code === 200 && data.data) {
      const { state, resultJson, failMsg } = data.data

      if (state === 'success' && resultJson) {
        let parsed = resultJson
        if (typeof parsed === 'string') {
          try { parsed = JSON.parse(parsed) } catch (e) {
            console.error('[Voiceover] Failed to parse resultJson')
          }
        }

        const audioUrl = parsed?.resultUrls?.[0]
        if (audioUrl) {
          return NextResponse.json({ status: 'success', audioUrl })
        }
      } else if (state === 'fail') {
        return NextResponse.json({ status: 'fail', error: failMsg || 'Voiceover generation failed' })
      }
    }
  } catch (error) {
    console.error('[Voiceover] Error polling upstream:', error)
  }

  return NextResponse.json({ status: 'pending' })
}
