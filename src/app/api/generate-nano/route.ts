import { NextRequest, NextResponse } from 'next/server'

interface NanoRequest {
  imageUrl: string
  prompt: string
  aspectRatio?: string
  resolution?: string
  outputFormat?: string
}

interface NanoTaskRequest {
  model: string
  callBackUrl?: string
  input: {
    prompt: string
    image_input?: string[]
    aspect_ratio: string
    resolution: string
    output_format: string
  }
}

interface NanoTaskResponse {
  code: number
  message: string
  data: {
    taskId: string
  }
}

export async function POST(request: NextRequest) {
  try {
    const { imageUrl, prompt, aspectRatio, resolution, outputFormat }: NanoRequest = await request.json()
    const apiKey = request.headers.get('Authorization')?.replace('Bearer ', '')

    if (!imageUrl || !prompt || !apiKey) {
      return NextResponse.json(
        { error: 'Image URL, prompt, and API key are required' },
        { status: 400 }
      )
    }

    // Create Nano Banana Pro task
    const taskRequest: NanoTaskRequest = {
      model: 'nano-banana-pro',
      callBackUrl: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/nano-callback`,
      input: {
        prompt: prompt,
        image_input: [imageUrl],
        aspect_ratio: aspectRatio || '9:16',
        resolution: resolution || '2K',
        output_format: outputFormat || 'png'
      }
    }

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

    const result: NanoTaskResponse = await response.json()

    if (result.code !== 200) {
      throw new Error(result.message)
    }

    return NextResponse.json({
      success: true,
      taskId: result.data.taskId
    })

  } catch (error) {
    console.error('Error in generate-nano:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
