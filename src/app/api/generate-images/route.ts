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
    const { prompt, apiKey } = await request.json()

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
      speed: 'relaxed',
      aspectRatio: '9:16',
      version: '7',
      variety: 5, // Increase variety for each batch
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

// Callback endpoint for Midjourney
export async function POST_CALLBACK(request: NextRequest) {
  try {
    const callbackData = await request.json()
    
    if (callbackData.code === 200 && callbackData.data?.resultUrls) {
      const taskId = callbackData.data.taskId
      const resultUrls = callbackData.data.resultUrls
      
      // Store the result
      taskResults.set(taskId, {
        taskId,
        resultUrls,
        state: 'success'
      })
      
      // Notify frontend via WebSocket or polling
      // For now, we'll store it and let the frontend poll
    } else {
      // Handle failure
      const taskId = callbackData.data?.taskId
      if (taskId) {
        taskResults.set(taskId, {
          taskId,
          resultUrls: [],
          state: 'fail'
        })
      }
    }
    
    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Error in callback:', error)
    return NextResponse.json(
      { error: 'Callback processing failed' },
      { status: 500 }
    )
  }
}

// Polling endpoint for frontend to check task status
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const taskId = searchParams.get('taskId')
  
  if (!taskId) {
    return NextResponse.json(
      { error: 'Task ID is required' },
      { status: 400 }
    )
  }
  
  const result = taskResults.get(taskId)
  
  if (!result) {
    return NextResponse.json({ status: 'pending' })
  }
  
  return NextResponse.json({
    status: result.state,
    resultUrls: result.resultUrls
  })
}
