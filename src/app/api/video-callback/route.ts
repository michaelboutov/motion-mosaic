import { NextRequest, NextResponse } from 'next/server'

interface VideoCallback {
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
const videoTaskResults = new Map<string, { videoUrl: string; status: 'success' | 'fail' }>()

export async function POST(request: NextRequest) {
  try {
    let callback: VideoCallback;
    try {
      callback = await request.json()
    } catch (e) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    
    console.log('Received video callback:', callback)
    
    if (callback.code === 200 && callback.data.state === 'success' && callback.data.resultJson) {
      // Success case
      const resultData = JSON.parse(callback.data.resultJson)
      const videoUrls = resultData.resultUrls || []
      
      if (videoUrls.length > 0) {
        videoTaskResults.set(callback.data.taskId, {
          videoUrl: videoUrls[0], // Take first video URL
          status: 'success'
        })
        
        console.log(`Video task ${callback.data.taskId} completed successfully`)
      } else {
        videoTaskResults.set(callback.data.taskId, {
          videoUrl: '',
          status: 'fail'
        })
      }
    } else {
      // Failure case
      videoTaskResults.set(callback.data.taskId, {
        videoUrl: '',
        status: 'fail'
      })
      
      console.error(`Video task ${callback.data.taskId} failed:`, callback.data.failMsg)
    }
    
    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Error processing video callback:', error)
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
  const cachedResult = videoTaskResults.get(taskId)
  if (cachedResult) {
    return NextResponse.json({
      status: cachedResult.status,
      videoUrl: cachedResult.videoUrl
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
            const videoUrls = parsedResult.resultUrls || []
            
            if (videoUrls.length > 0) {
              const videoUrl = videoUrls[0]
              // Cache the success result
              videoTaskResults.set(taskId, {
                videoUrl,
                status: 'success'
              })
              
              return NextResponse.json({
                status: 'success',
                videoUrl
              })
            }
          } catch (e) {
            console.error('Error parsing video resultJson:', e)
          }
        } else if (state === 'fail') {
          // Cache the failure
          videoTaskResults.set(taskId, {
            videoUrl: '',
            status: 'fail'
          })
          
          return NextResponse.json({ 
            status: 'fail',
            error: failMsg 
          })
        }
      }
    } catch (error) {
      console.error('Error polling video upstream:', error)
    }
  }
  
  return NextResponse.json({ status: 'pending' })
}
