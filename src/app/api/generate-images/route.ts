import { NextRequest, NextResponse } from 'next/server'

interface MidjourneyRequest {
  taskType: string
  prompt: string
  speed?: string
  aspectRatio?: string
  version?: string
  variety?: number
  stylization?: number
  weirdness?: number
  callBackUrl?: string
}

interface MidjourneyResponse {
  code: number
  msg: string
  data: {
    taskId: string
  }
}

interface CallbackData {
  taskId: string
  resultUrls: string[]
  state: 'success' | 'fail'
}

// In-memory storage for demo purposes
// In production, use Redis or database
const taskResults = new Map<string, CallbackData>()

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

    const { prompt, apiKey, aspectRatio, speed, variety } = body

    if (!prompt || !apiKey) {
      return NextResponse.json(
        { error: 'Prompt and API key are required' },
        { status: 400 }
      )
    }

    // Generate 15 requests to get 60 images (4 images per request)
    const requests: MidjourneyRequest[] = Array.from({ length: 15 }, (_, i) => ({
      taskType: 'mj_txt2img',
      prompt: `${prompt} `,
      speed: speed || 'relaxed',
      aspectRatio: aspectRatio || '9:16',
      version: '7',
      variety: variety ?? 5,
      stylization: 100,
      weirdness: 0,
      callBackUrl: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/midjourney-callback`
    }))

    // Create all tasks in parallel
    const taskPromises = requests.map(async (req, index) => {
      try {
        const response = await fetch('https://api.kie.ai/api/v1/mj/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify(req)
        })

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const result: MidjourneyResponse = await response.json()
        
        if (result.code !== 200) {
          throw new Error(result.msg)
        }

        return {
          taskId: result.data.taskId,
          batchIndex: index,
          status: 'pending'
        }
      } catch (error) {
        console.error(`Failed to create task ${index}:`, error)
        return {
          taskId: null,
          batchIndex: index,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    })

    const taskResults = await Promise.all(taskPromises)
    
    // Filter out failed tasks
    const successfulTasks = taskResults.filter(task => task.taskId)
    
    return NextResponse.json({
      success: true,
      totalBatches: 15,
      successfulBatches: successfulTasks.length,
      tasks: successfulTasks
    })

  } catch (error) {
    console.error('Error in generate-images:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
