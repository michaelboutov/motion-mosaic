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
    console.log('Generate Nano request received')

    let body: NanoRequest;
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

    const { imageUrl, prompt, aspectRatio, resolution, outputFormat } = body
    const authHeader = request.headers.get('Authorization')
    const apiKey = authHeader?.replace('Bearer ', '')
    
    console.log('Auth check:', { 
      hasAuthHeader: !!authHeader, 
      hasApiKey: !!apiKey, 
      imageUrl: !!imageUrl, 
      prompt: !!prompt 
    })

    if (!imageUrl || !prompt || !apiKey) {
      return NextResponse.json(
        { error: 'Image URL, prompt, and API key are required' },
        { status: 400 }
      )
    }

    // Validate URL
    try {
      const urlObj = new URL(imageUrl);
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
         return NextResponse.json({ error: 'Image URL must be http or https' }, { status: 400 })
      }
    } catch (e) {
      return NextResponse.json({ error: 'Invalid Image URL format' }, { status: 400 })
    }

    // Create Nano Banana Pro task
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const taskRequest: NanoTaskRequest = {
      model: 'nano-banana-pro',
      callBackUrl: `${baseUrl}/api/nano-callback`,
      input: {
        prompt: prompt,
        image_input: [imageUrl],
        aspect_ratio: aspectRatio || '9:16',
        resolution: resolution || '2K',
        output_format: outputFormat || 'png'
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
      const errorText = await response.text();
      console.error('Upstream API error:', response.status, errorText);
      return NextResponse.json(
        { error: `Upstream error (${response.status}): ${errorText || response.statusText}` },
        { status: 502 } // Bad Gateway for upstream failures
      );
    }

    const result: NanoTaskResponse = await response.json()
    console.log('Upstream result:', JSON.stringify(result, null, 2))

    if (result.code !== 200) {
      console.error('Upstream API logical error:', result);
      return NextResponse.json(
        { error: result.message || 'Upstream logical error' },
        { status: 422 } // Unprocessable Entity for business logic failures
      );
    }

    return NextResponse.json({
      success: true,
      taskId: result.data.taskId
    })

  } catch (error) {
    console.error('Error in generate-nano:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
