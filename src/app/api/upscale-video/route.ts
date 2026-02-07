import { NextRequest, NextResponse } from 'next/server'

interface UpscaleRequest {
  taskId: string
}

interface UpscaleTaskRequest {
  model: string
  callBackUrl?: string
  input: {
    task_id: string
  }
}

interface TaskResponse {
  code: number
  message: string
  data: {
    taskId: string
  }
}

export async function POST(request: NextRequest) {
  try {
    let body: UpscaleRequest;
    try {
      body = await request.json()
    } catch (e) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    if (!body) {
      return NextResponse.json({ error: 'Empty request body' }, { status: 400 })
    }

    const { taskId } = body
    const apiKey = request.headers.get('Authorization')?.replace('Bearer ', '')

    if (!taskId || !apiKey) {
      return NextResponse.json(
        { error: 'Task ID and API key are required' },
        { status: 400 }
      )
    }

    // Create upscale task
    const taskRequest: UpscaleTaskRequest = {
      model: 'grok-imagine/upscale',
      callBackUrl: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/video-callback`,
      input: {
        task_id: taskId
      }
    }

    console.log('Creating upscale task:', JSON.stringify(taskRequest, null, 2))

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

    const result: TaskResponse = await response.json()

    if (result.code !== 200) {
      throw new Error(result.message)
    }

    return NextResponse.json({
      success: true,
      taskId: result.data.taskId
    })

  } catch (error) {
    console.error('Error in upscale-video:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
