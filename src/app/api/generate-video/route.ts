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
    const { imageUrl, prompt, model, duration, mode }: VideoRequest = await request.json()
    const apiKey = request.headers.get('Authorization')?.replace('Bearer ', '')

    if (!imageUrl || !prompt || !apiKey) {
      return NextResponse.json(
        { error: 'Image URL, prompt, and API key are required' },
        { status: 400 }
      )
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
          duration: duration || '6',
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

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const result: VideoTaskResponse = await response.json()

    if (result.code !== 200) {
      throw new Error(result.message)
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
