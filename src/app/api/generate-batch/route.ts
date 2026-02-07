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

// Reuse the task storage from generate-images if possible, or create a shared one.
// For now, we'll implement a simple in-memory store here too, but in a real app this should be shared (Redis/DB).
// Since we are using polling, the callback endpoint needs to know where to put results.
// We can reuse the EXISTING api/midjourney-callback endpoint if we ensure it stores results where we can find them.
// The existing midjourney-callback stores in a module-level variable in generate-images/route.ts.
// This is problematic for separate route files in Next.js serverless functions (they might not share memory).
// However, since we are likely running in a single process for dev or a specific environment, it *might* work if we import the store.
// BUT, better practice is to have the callback handling logic centralized or use a database.
// Given the constraints and the existing "demo purposes" comment, I will create a new callback endpoint for batch generation 
// OR simpler: I will assume the user wants me to implement this robustly enough to work.
// I will create a shared `lib/task-store.ts` to hold the results in memory, 
// and update both generate-images and this new route to use it. 
// BUT, modifying existing working code might be risky if I break it.
// Let's check `generate-images/route.ts` again. It has `taskResults` local map.
// I will create `api/generate-batch/route.ts` and `api/generate-batch/callback/route.ts` to keep it isolated and safe.

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

    const { prompt, apiKey, batchCount = 1, aspectRatio = '9:16' } = body

    if (!prompt || !apiKey) {
      return NextResponse.json(
        { error: 'Prompt and API key are required' },
        { status: 400 }
      )
    }

    // Limit batch count to avoid abuse
    const count = Math.min(Math.max(1, batchCount), 5)

    const requests: MidjourneyRequest[] = Array.from({ length: count }, (_, i) => ({
      taskType: 'mj_txt2img',
      prompt: `${prompt} `,
      speed: 'relaxed',
      aspectRatio: aspectRatio,
      version: '7',
      variety: 5,
      stylization: 100,
      weirdness: 0,
      callBackUrl: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/generate-batch/callback`
    }))

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
    const successfulTasks = taskResults.filter(task => task.taskId)
    
    return NextResponse.json({
      success: true,
      totalBatches: count,
      successfulBatches: successfulTasks.length,
      tasks: successfulTasks
    })

  } catch (error) {
    console.error('Error in generate-batch:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
