import { NextRequest, NextResponse } from 'next/server'

interface GptImageRequest {
  imageUrls: string[]
  prompt: string
  aspectRatio?: string
  quality?: string
}

interface GptImageTaskRequest {
  model: string
  callBackUrl?: string
  input: {
    input_urls: string[]
    prompt: string
    aspect_ratio: string
    quality: string
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
    console.log('Generate GPT Image request received')

    let body: GptImageRequest
    try {
      body = await request.json()
      console.log('Request body parsed:', JSON.stringify(body, null, 2))
    } catch (e) {
      console.error('JSON parse error:', e)
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    if (!body) {
      return NextResponse.json({ error: 'Empty request body' }, { status: 400 })
    }

    const { imageUrls, prompt, aspectRatio, quality } = body
    const authHeader = request.headers.get('Authorization')
    const apiKey = authHeader?.replace('Bearer ', '')

    console.log('Auth check:', {
      hasAuthHeader: !!authHeader,
      hasApiKey: !!apiKey,
      imageCount: imageUrls?.length || 0,
      prompt: !!prompt
    })

    if (!imageUrls?.length || !prompt || !apiKey) {
      return NextResponse.json(
        { error: 'At least one image URL, prompt, and API key are required' },
        { status: 400 }
      )
    }

    // Validate all URLs
    for (const url of imageUrls) {
      try {
        const urlObj = new URL(url)
        if (!['http:', 'https:'].includes(urlObj.protocol)) {
          return NextResponse.json({ error: `Image URL must be http or https: ${url}` }, { status: 400 })
        }
      } catch (e) {
        return NextResponse.json({ error: `Invalid Image URL format: ${url}` }, { status: 400 })
      }
    }

    // Create GPT Image 1.5 image-to-image task
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
    const taskRequest: GptImageTaskRequest = {
      model: 'gpt-image/1.5-image-to-image',
      callBackUrl: `${baseUrl}/api/nano-callback`,
      input: {
        input_urls: imageUrls,
        prompt: prompt,
        aspect_ratio: aspectRatio || '2:3',
        quality: quality || 'medium'
      }
    }

    console.log('Sending upstream request to Kie.ai:', JSON.stringify(taskRequest, null, 2))

    const response = await fetch('https://api.kie.ai/api/v1/jobs/createTask', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(taskRequest)
    })

    console.log('Upstream response status:', response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Upstream API error:', response.status, errorText)
      return NextResponse.json(
        { error: `Upstream error (${response.status}): ${errorText || response.statusText}` },
        { status: 502 }
      )
    }

    const result: TaskResponse = await response.json()
    console.log('Upstream result:', JSON.stringify(result, null, 2))

    if (result.code !== 200) {
      console.error('Upstream API logical error:', result)
      return NextResponse.json(
        { error: result.message || 'Upstream logical error' },
        { status: 422 }
      )
    }

    return NextResponse.json({
      success: true,
      taskId: result.data.taskId
    })

  } catch (error) {
    console.error('Error in generate-gpt-image:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
