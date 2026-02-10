import { NextRequest, NextResponse } from 'next/server'

/**
 * Server-side media proxy — bypasses CORS restrictions.
 * Usage: GET /api/media-proxy?url=<encoded-remote-url>
 *
 * The browser can't fetch cross-origin video files directly (CORS).
 * This route fetches them server-side and streams the bytes back.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url')

  if (!url) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 })
  }

  // Validate URL
  try {
    const parsed = new URL(url)
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return NextResponse.json({ error: 'Invalid protocol' }, { status: 400 })
    }
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
  }

  try {
    const upstream = await fetch(url, {
      headers: {
        'User-Agent': 'MotionMosaic/1.0',
      },
    })

    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Upstream returned ${upstream.status}` },
        { status: upstream.status }
      )
    }

    const contentType = upstream.headers.get('content-type') || 'application/octet-stream'
    const contentLength = upstream.headers.get('content-length')

    const headers: Record<string, string> = {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=86400',
      'Access-Control-Allow-Origin': '*',
    }

    if (contentLength) {
      headers['Content-Length'] = contentLength
    }

    // Stream the response body through
    return new NextResponse(upstream.body, {
      status: 200,
      headers,
    })
  } catch (err) {
    console.error('Media proxy error:', err)
    return NextResponse.json(
      { error: 'Failed to fetch upstream resource' },
      { status: 502 }
    )
  }
}
