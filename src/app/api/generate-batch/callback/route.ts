import { NextRequest, NextResponse } from 'next/server'

interface MidjourneyCallback {
  code: number
  msg: string
  data: {
    taskId: string
    promptJson?: string
    resultUrls?: string[]
    successFlag?: number
    resultInfoJson?: any
    errorMessage?: string
  }
}

// In-memory storage for demo purposes
const taskResults = new Map<string, { resultUrls: string[]; status: 'success' | 'fail' | 'pending'; error?: string }>()

export async function POST(request: NextRequest) {
  try {
    const callback: MidjourneyCallback = await request.json()
    
    console.log('Received Batch callback:', JSON.stringify(callback, null, 2))
    
    if (callback.code === 200 && callback.data?.resultUrls) {
      // Direct success with URLs
      taskResults.set(callback.data.taskId, {
        resultUrls: callback.data.resultUrls,
        status: 'success'
      })
    } else if (callback.data?.successFlag !== undefined) {
      // Check successFlag format (sometimes used in different endpoints)
      const { successFlag, resultInfoJson, errorMessage, resultUrls } = callback.data
      
      // successFlag: 1 (Success), 2 (Fail), 3 (Gen Fail), 0 (Generating)
      if (successFlag === 1) {
        let urls = resultUrls || []
        if (!urls.length && resultInfoJson) {
           // Parse if needed
           try {
             const info = typeof resultInfoJson === 'string' ? JSON.parse(resultInfoJson) : resultInfoJson
             if (info.resultUrls) urls = info.resultUrls.map((u: any) => typeof u === 'string' ? u : u.resultUrl)
           } catch (e) { console.error('Error parsing info json', e) }
        }
        
        taskResults.set(callback.data.taskId, {
          resultUrls: urls,
          status: 'success'
        })
      } else if (successFlag === 2 || successFlag === 3) {
        taskResults.set(callback.data.taskId, {
          resultUrls: [],
          status: 'fail',
          error: errorMessage
        })
      }
    } else if (callback.code === 200 && callback.data?.taskId) {
        // Sometimes just taskId is returned for updates? Assume pending if no other info?
        // Or if failure
        if (callback.msg !== 'success') {
             taskResults.set(callback.data.taskId, {
                resultUrls: [],
                status: 'fail',
                error: callback.msg
            })
        }
    } else {
      // Fallback failure
      if (callback.data?.taskId) {
        taskResults.set(callback.data.taskId, {
            resultUrls: [],
            status: 'fail',
            error: callback.msg || 'Unknown error'
        })
      }
    }
    
    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Error processing Batch callback:', error)
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
    return NextResponse.json({ error: 'Task ID is required' }, { status: 400 })
  }
  
  // Check local cache
  const cachedResult = taskResults.get(taskId)
  if (cachedResult) {
    return NextResponse.json(cachedResult)
  }

  // Upstream polling (fallback)
  if (apiKey) {
    try {
      const apiUrl = `https://api.kie.ai/api/v1/mj/record-info?taskId=${taskId}`
      const response = await fetch(apiUrl, {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      })
      
      const data = await response.json()
      
      if (data.code === 200 && data.data) {
        const { successFlag, resultInfoJson, errorMessage } = data.data
        
        if (successFlag === 1) {
          let resultUrls: string[] = []
          let infoJson = resultInfoJson
          
          if (typeof infoJson === 'string') {
            try { infoJson = JSON.parse(infoJson) } catch (e) {}
          }
          
          if (infoJson?.resultUrls) {
            resultUrls = infoJson.resultUrls.map((item: any) => 
              typeof item === 'string' ? item : item.resultUrl
            ).filter(Boolean)
          }

          if (resultUrls.length > 0) {
            const result = { resultUrls, status: 'success' as const }
            taskResults.set(taskId, result)
            return NextResponse.json(result)
          }
        } else if (successFlag === 2 || successFlag === 3) {
          const result = { resultUrls: [], status: 'fail' as const, error: errorMessage }
          taskResults.set(taskId, result)
          return NextResponse.json(result)
        }
      }
    } catch (error) {
      console.error('Error polling upstream:', error)
    }
  }
  
  return NextResponse.json({ status: 'pending' })
}
