import { NextRequest, NextResponse } from 'next/server'

interface NanoCallback {
  code: number
  msg: string
  data: {
    taskId: string
    state: 'success' | 'fail'
    resultJson?: string
    failCode?: string
    failMsg?: string
    completeTime: number
    costTime: number
  }
}

// In-memory storage for demo purposes
const nanoTaskResults = new Map<string, { imageUrls: string[]; status: 'success' | 'fail' }>()

export async function POST(request: NextRequest) {
  try {
    const callback: NanoCallback = await request.json()
    
    console.log('Received nano callback:', callback)
    
    if (callback.code === 200 && callback.data.state === 'success' && callback.data.resultJson) {
      // Success case
      const resultData = JSON.parse(callback.data.resultJson)
      const imageUrls = resultData.resultUrls || []
      
      if (imageUrls.length > 0) {
        nanoTaskResults.set(callback.data.taskId, {
          imageUrls: imageUrls,
          status: 'success'
        })
        
        console.log(`Nano task ${callback.data.taskId} completed successfully`)
      } else {
        nanoTaskResults.set(callback.data.taskId, {
          imageUrls: [],
          status: 'fail'
        })
      }
    } else {
      // Failure case
      nanoTaskResults.set(callback.data.taskId, {
        imageUrls: [],
        status: 'fail'
      })
      
      console.error(`Nano task ${callback.data.taskId} failed:`, callback.data.failMsg)
    }
    
    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Error processing nano callback:', error)
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
  const cachedResult = nanoTaskResults.get(taskId)
  if (cachedResult) {
    return NextResponse.json({
      status: cachedResult.status,
      imageUrls: cachedResult.imageUrls
    })
  }

  // If not in cache and we have an API key, check upstream
  if (apiKey) {
    try {
      const response = await fetch(`https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${taskId}`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      })
      
      const data = await response.json()
      
      if (data.code === 200 && data.data) {
        const { state, resultJson, failMsg } = data.data
        
        if (state === 'success' && resultJson) {
          try {
            const parsedResult = JSON.parse(resultJson)
            const imageUrls = parsedResult.resultUrls || []
            
            if (imageUrls.length > 0) {
              // Cache the success result
              nanoTaskResults.set(taskId, {
                imageUrls,
                status: 'success'
              })
              
              return NextResponse.json({
                status: 'success',
                imageUrls
              })
            }
          } catch (e) {
            console.error('Error parsing nano resultJson:', e)
          }
        } else if (state === 'fail') {
          // Cache the failure
          nanoTaskResults.set(taskId, {
            imageUrls: [],
            status: 'fail'
          })
          
          return NextResponse.json({ 
            status: 'fail',
            error: failMsg 
          })
        }
      }
    } catch (error) {
      console.error('Error polling nano upstream:', error)
    }
  }
  
  return NextResponse.json({ status: 'pending' })
}
