'use client'

import { useState, useEffect, useRef } from 'react'

const waveformCache = new Map<string, number[]>()

export function useWaveform(sourceUrl: string | undefined, barCount: number = 60) {
  const [bars, setBars] = useState<number[]>([])
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!sourceUrl) { setBars([]); return }

    const cacheKey = `${sourceUrl}:${barCount}`
    if (waveformCache.has(cacheKey)) {
      setBars(waveformCache.get(cacheKey)!)
      return
    }

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    let cancelled = false

    async function analyze() {
      try {
        const ctx = new AudioContext()
        const response = await fetch(sourceUrl!, { signal: controller.signal })
        const arrayBuffer = await response.arrayBuffer()
        if (cancelled) return

        const audioBuffer = await ctx.decodeAudioData(arrayBuffer)
        if (cancelled) return

        const channelData = audioBuffer.getChannelData(0)
        const samplesPerBar = Math.floor(channelData.length / barCount)
        const result: number[] = []

        for (let i = 0; i < barCount; i++) {
          let sum = 0
          const start = i * samplesPerBar
          const end = Math.min(start + samplesPerBar, channelData.length)
          for (let j = start; j < end; j++) {
            sum += Math.abs(channelData[j])
          }
          result.push(sum / (end - start))
        }

        // Normalize to 0-1
        const max = Math.max(...result, 0.001)
        const normalized = result.map(v => v / max)

        if (!cancelled) {
          waveformCache.set(cacheKey, normalized)
          setBars(normalized)
        }

        ctx.close()
      } catch {
        // Fetch aborted or decode failed — use fallback
      }
    }

    analyze()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [sourceUrl, barCount])

  return bars
}
