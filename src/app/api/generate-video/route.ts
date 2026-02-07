import { NextRequest, NextResponse } from 'next/server'

interface VideoRequest {
  imageUrl: string
  prompt: string
  model?: string
  duration?: string
  mode?: string
}

interface VideoTaskRequest {
  model: string
  callBackUrl?: string
  input: Record<string, any>
}

interface VideoTaskResponse {
  code: number
  message: string
  data: {
    taskId: string
  }
}

// In-memory storage for demo purposes
const videoTaskResults = new Map<string, { videoUrl: string; status: 'success' | 'fail' }>()

export async function POST(request: NextRequest) {
  try {
    console.log('Generate Video request received')

    let body: VideoRequest;
    try {
      body = await request.json()
      console.log('Video Request body:', JSON.stringify(body, null, 2))
    } catch (e) {
      console.error('JSON parse error:', e)
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    if (!body) {
       return NextResponse.json({ error: 'Empty request body' }, { status: 400 })
    }

    const { imageUrl, prompt, model, duration, mode } = body
    const apiKey = request.headers.get('Authorization')?.replace('Bearer ', '')

    if (!imageUrl || !prompt || !apiKey) {
      return NextResponse.json(
        { error: 'Image URL, prompt, and API key are required' },
        { status: 400 }
      )
    }

    // Validate URL
    try {
      new URL(imageUrl);
    } catch (e) {
      return NextResponse.json({ error: 'Invalid Image URL format' }, { status: 400 })
    }

    const selectedModel = model || 'bytedance/seedance-1.5-pro'
    const callBackUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/video-callback`

    let taskRequest: VideoTaskRequest

    if (selectedModel === 'grok-imagine/image-to-video') {
      // Grok Payload
      taskRequest = {
        model: selectedModel,
        callBackUrl,
        input: {
          image_urls: [imageUrl],
          prompt: prompt,
          mode: mode || 'normal',
          duration: duration || '3',
          // Grok specific defaults if needed
        }
      }
    } else {
      // Seedance Payload (Default)
      taskRequest = {
        model: 'bytedance/seedance-1.5-pro',
        callBackUrl,
        input: {
          prompt: prompt || 'animate the shot, camera moves',
          input_urls: [imageUrl],
          aspect_ratio: '9:16',
          resolution: '720p',
          duration: '4',
          fixed_lens: false,
          generate_audio: false
        }
      }
    }

    console.log('Creating video task:', JSON.stringify(taskRequest, null, 2))

    const response = await fetch('https://api.kie.ai/api/v1/jobs/createTask', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(taskRequest)
    })
    
    console.log('Upstream response status:', response.status)

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Upstream API error:', response.status, errorText);
       return NextResponse.json(
        { error: `Upstream error (${response.status}): ${errorText || response.statusText}` },
        { status: 502 }
      );
    }

    const result = await response.json()
    console.log('Upstream result:', JSON.stringify(result, null, 2))
    console.log('Response code:', result.code, 'Message:', result.message)
    console.log('Response data:', result.data)

    if (result.code !== 200) {
      console.error('Upstream API logical error:', result);
      const errorMsg = result.message || JSON.stringify(result);
      return NextResponse.json(
        { error: errorMsg, fullResponse: result },
        { status: 422 }
      );
    }

    if (!result.data?.taskId) {
      console.error('Missing taskId in response:', result);
      return NextResponse.json(
        { error: 'Invalid response: missing taskId', fullResponse: result },
        { status: 422 }
      );
    }

    return NextResponse.json({
      success: true,
      taskId: result.data.taskId
    })

  } catch (error) {
    console.error('Error in generate-video:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
