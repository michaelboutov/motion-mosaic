import { NextRequest, NextResponse } from 'next/server'

interface MidjourneyCallback {
  code: number
  msg: string
  data: {
    taskId: string
    promptJson?: string
    resultUrls?: string[]
  }
}

// In-memory storage for demo purposes
// In production, use Redis or database with proper event handling
const taskResults = new Map<string, { resultUrls: string[]; status: 'success' | 'fail' }>()

export async function POST(request: NextRequest) {
  try {
    const callback: MidjourneyCallback = await request.json()
    
    console.log('Received Midjourney callback:', callback)
    
    if (callback.code === 200 && callback.data?.resultUrls) {
      // Success case
      taskResults.set(callback.data.taskId, {
        resultUrls: callback.data.resultUrls,
        status: 'success'
      })
      
      console.log(`Task ${callback.data.taskId} completed with ${callback.data.resultUrls.length} images`)
    } else {
      // Failure case
      taskResults.set(callback.data.taskId, {
        resultUrls: [],
        status: 'fail'
      })
      
      console.error(`Task ${callback.data.taskId} failed:`, callback.msg)
    }
    
    // In a real implementation, you would:
    // 1. Store results in a database
    // 2. Notify connected clients via WebSocket
    // 3. Trigger any webhooks
    
    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Error processing Midjourney callback:', error)
    return NextResponse.json(
      { error: 'Failed to process callback' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const taskId = searchParams.get('taskId')
  const apiKey = request.headers.get('Authorization')?.replace('Bearer ', '')
  
  if (!taskId) {
    return NextResponse.json(
      { error: 'Task ID is required' },
      { status: 400 }
    )
  }
  
  // Check local cache first
  const cachedResult = taskResults.get(taskId)
  if (cachedResult) {
    return NextResponse.json({
      status: cachedResult.status,
      resultUrls: cachedResult.resultUrls
    })
  }

  // If not in cache and we have an API key, check upstream
  if (apiKey) {
    try {
      // Use the correct endpoint for Midjourney task details
      const apiUrl = `https://api.kie.ai/api/v1/mj/record-info?taskId=${taskId}`
      console.log('Polling upstream:', apiUrl)
      
      const response = await fetch(apiUrl, {
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      })
      
      const data = await response.json()
      console.log('Upstream response:', JSON.stringify(data, null, 2))
      
      if (data.code === 200 && data.data) {
        const { successFlag, resultInfoJson, errorMessage } = data.data
        
        // successFlag: 0 (Generating), 1 (Success), 2 (Failed), 3 (Generation Failed)
        // Handle both number and string just in case
        const isSuccess = successFlag === 1 || successFlag === '1'
        const isFailure = successFlag === 2 || successFlag === 3 || successFlag === '2' || successFlag === '3'
        
        if (isSuccess) {
          // Handle resultInfoJson which contains resultUrls
          let resultUrls: string[] = []
          let infoJson = resultInfoJson

          // If it's a string, parse it
          if (typeof infoJson === 'string') {
            try {
              infoJson = JSON.parse(infoJson)
            } catch (e) {
              console.error('Error parsing resultInfoJson string:', e)
            }
          }
          
          if (infoJson?.resultUrls && Array.isArray(infoJson.resultUrls)) {
            // Check if it's array of strings or objects
            resultUrls = infoJson.resultUrls.map((item: any) => {
              return typeof item === 'string' ? item : item.resultUrl
            }).filter(Boolean)
          }

          if (resultUrls.length > 0) {
            // Cache the success result
            taskResults.set(taskId, {
              resultUrls,
              status: 'success'
            })
            
            return NextResponse.json({
              status: 'success',
              resultUrls
            })
          }
        } else if (isFailure) {
          // Cache the failure
          taskResults.set(taskId, {
            resultUrls: [],
            status: 'fail'
          })
          
          return NextResponse.json({ 
            status: 'fail',
            error: errorMessage 
          })
        }
        // If successFlag is 0, it's still generating, return pending
      }
    } catch (error) {
      console.error('Error polling upstream:', error)
    }
  }
  
  return NextResponse.json({ status: 'pending' })
}
