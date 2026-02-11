import { useEffect, useRef, useState, useCallback } from 'react'
import Hls from 'hls.js'
import * as cocoSsd from '@tensorflow-models/coco-ssd'
import '@tensorflow/tfjs'

type Detection = {
  class: string
  score?: number
  bbox: number[]
}

type Track = {
  id: number
  bbox: number[]
  lastSeen: number
  counted: boolean
  movingStreak: number
}

const streamFrameUrl = '/api/wetmet/frame'
const directFrameUrl = 'https://api.wetmet.net/widgets/stream/frame.php?uid=73078bd38a6f267f388473b67316baab'
const iframeSourceId = 'wetmet-iframe'
const DETECT_MAX_BOXES = 50
const DETECT_MIN_SCORE = 0.35
const CAR_MIN_SCORE = 0.45
const CAR_MIN_AREA_RATIO = 0.002
const FORCE_LOCAL_DETECTION = import.meta.env.VITE_FORCE_OBJECT_DETECTION !== 'false'
const USE_SERVER_DETECTION =
  !FORCE_LOCAL_DETECTION && import.meta.env.VITE_USE_SERVER_DETECTION === 'true'
const SERVER_DETECT_ENDPOINT = '/api/detect'
const SERVER_DETECT_TIMEOUT_MS = 8000
const DETECTION_INTERVAL_MS = USE_SERVER_DETECTION ? 1000 : 200
const CAPTURE_MAX_WIDTH = 1280
const TOTAL_CARS_STORAGE_KEY = 'traffic:totalCars'
const TOTAL_CARS_DATE_KEY = 'traffic:totalCarsDate'
const TOTAL_CARS_STARTED_AT_KEY = 'traffic:totalCarsStartedAt'

const getTodayKey = () => {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const loadStoredTotalCars = () => {
  const storedDate = localStorage.getItem(TOTAL_CARS_DATE_KEY)
  const today = getTodayKey()
  if (storedDate !== today) {
    const now = Date.now()
    localStorage.setItem(TOTAL_CARS_DATE_KEY, today)
    localStorage.setItem(TOTAL_CARS_STORAGE_KEY, '0')
    localStorage.setItem(TOTAL_CARS_STARTED_AT_KEY, String(now))
    return 0
  }
  const storedValue = Number(localStorage.getItem(TOTAL_CARS_STORAGE_KEY) ?? 0)
  return Number.isFinite(storedValue) ? storedValue : 0
}

const loadStartedAt = () => {
  const storedValue = Number(localStorage.getItem(TOTAL_CARS_STARTED_AT_KEY))
  if (Number.isFinite(storedValue) && storedValue > 0) return storedValue
  const now = Date.now()
  localStorage.setItem(TOTAL_CARS_STARTED_AT_KEY, String(now))
  return now
}

const extractStreamUrl = (html: string) => {
  const match = html.match(/var\s+vurl\s*=\s*'([^']+)'/)
  return match?.[1] ?? null
}

const isImageSource = (src: string) => /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(src)

type MissionActivityVideoProps = {
  onCarCountChange?: (count: number) => void
  onTotalCarsChange?: (count: number) => void
  onStatusChange?: (status: string) => void
  onResetAgeChange?: (startedAt: number) => void
  videoSource?: string | null
}

export default function MissionActivityVideo({
  onCarCountChange,
  onTotalCarsChange,
  onStatusChange,
  onResetAgeChange,
  videoSource
}: MissionActivityVideoProps) {
  const [streamStatus, setStreamStatus] = useState('Connecting')
  const [modelStatus, setModelStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [carCount, setCarCount] = useState(0)
  const [totalCars, setTotalCars] = useState(() => {
    if (typeof window === 'undefined') return 0
    return loadStoredTotalCars()
  })
  const [startedAt, setStartedAt] = useState(() => {
    if (typeof window === 'undefined') return Date.now()
    return loadStartedAt()
  })
  const [streamSrc, setStreamSrc] = useState<string | null>(null)
  const [streamError, setStreamError] = useState<string | null>(null)
  const [debugEnabled, setDebugEnabled] = useState(false)
  const [useIframeFallback, setUseIframeFallback] = useState(false)
  const modelRef = useRef<cocoSsd.ObjectDetection | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const inFlightRef = useRef(false)
  const detectionTimerRef = useRef<number | null>(null)
  const hlsRef = useRef<Hls | null>(null)
  const tracksRef = useRef<Track[]>([])
  const nextTrackIdRef = useRef(1)
  const captureCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const resetTotals = useCallback((nextStartedAt = Date.now()) => {
    setTotalCars(0)
    setStartedAt(nextStartedAt)
    if (typeof window !== 'undefined') {
      localStorage.setItem(TOTAL_CARS_STORAGE_KEY, '0')
      localStorage.setItem(TOTAL_CARS_DATE_KEY, getTodayKey())
      localStorage.setItem(TOTAL_CARS_STARTED_AT_KEY, String(nextStartedAt))
    }
  }, [])

  useEffect(() => {
    let mounted = true
    if (USE_SERVER_DETECTION) {
      setModelStatus('ready')
      return () => {
        mounted = false
      }
    }
    cocoSsd
      .load({ base: 'mobilenet_v2' })
      .then((model) => {
        if (!mounted) return
        modelRef.current = model
        setModelStatus('ready')
      })
      .catch(() => {
        if (!mounted) return
        setModelStatus('error')
      })
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    setDebugEnabled(params.get('debug') === '1')
  }, [])

  useEffect(() => {
    if (videoSource) {
      if (videoSource === iframeSourceId) {
        setStreamSrc(null)
        setStreamStatus('Embedded')
        setStreamError(null)
        setUseIframeFallback(true)
        return
      }
      setStreamSrc(videoSource)
      setStreamStatus(isImageSource(videoSource) ? 'Image' : 'File ready')
      setStreamError(null)
      setUseIframeFallback(false)
      return
    }

    let cancelled = false

    const loadStream = async () => {
      setStreamStatus('Fetching stream source')
      try {
        const response = await fetch(streamFrameUrl)
        const html = await response.text()
        const url = extractStreamUrl(html)
        if (!url) {
          throw new Error('Stream URL not found')
        }
        if (!cancelled) {
          setStreamSrc(`/api/wetmet/proxy?url=${encodeURIComponent(url)}`)
          setStreamStatus('Stream ready')
          setStreamError(null)
          setUseIframeFallback(false)
        }
      } catch {
        if (!cancelled) {
          setStreamStatus('Stream unavailable')
          setStreamError('Failed to fetch stream frame')
          setUseIframeFallback(true)
        }
      }
    }

    loadStream()
    const refresh = window.setInterval(loadStream, 25 * 60 * 1000)

    return () => {
      cancelled = true
      window.clearInterval(refresh)
    }
  }, [videoSource])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !streamSrc || isImageSource(streamSrc) || useIframeFallback) return

    const handlePlaying = () => setStreamStatus('Live')
    const handleWaiting = () => setStreamStatus('Buffering')
    const handleError = () => {
      setStreamStatus('Playback error')
      setStreamError('Video playback error')
    }

    video.addEventListener('playing', handlePlaying)
    video.addEventListener('waiting', handleWaiting)
    video.addEventListener('error', handleError)

    const isHls = streamSrc.endsWith('.m3u8')
    if (Hls.isSupported() && isHls) {
      const hls = new Hls({
        lowLatencyMode: true,
        backBufferLength: 90
      })
      hlsRef.current = hls
      hls.loadSource(streamSrc)
      hls.attachMedia(video)
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => undefined)
      })
      hls.on(Hls.Events.ERROR, () => {
        setStreamStatus('Playback error')
        setStreamError('HLS playback error')
      })
    } else if (isHls && video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = streamSrc
      video.play().catch(() => undefined)
    } else {
      video.src = streamSrc
      video.play().catch(() => undefined)
    }

    return () => {
      video.removeEventListener('playing', handlePlaying)
      video.removeEventListener('waiting', handleWaiting)
      video.removeEventListener('error', handleError)
      if (hlsRef.current) {
        hlsRef.current.destroy()
        hlsRef.current = null
      }
    }
  }, [streamSrc])

  useEffect(() => {
    if (!streamSrc || isImageSource(streamSrc) || useIframeFallback) return
    let cancelled = false
    const verify = async () => {
      try {
        const response = await fetch(streamSrc, { method: 'HEAD' })
        if (!cancelled && response.status === 403) {
          setStreamStatus('Stream blocked')
          setStreamError('Upstream blocked proxy access')
          setUseIframeFallback(true)
        }
      } catch {
        // ignore
      }
    }
    verify()
    return () => {
      cancelled = true
    }
  }, [streamSrc, useIframeFallback])

  const drawDetections = useCallback((predictions: Detection[]) => {
    if (!videoRef.current || !canvasRef.current) return
    const video = videoRef.current
    const canvas = canvasRef.current
    const context = canvas.getContext('2d')
    if (!context) return

    const { clientWidth, clientHeight } = video
    canvas.width = clientWidth
    canvas.height = clientHeight
    context.clearRect(0, 0, canvas.width, canvas.height)

    if (!video.videoWidth || !video.videoHeight) return
    const scaleX = clientWidth / video.videoWidth
    const scaleY = clientHeight / video.videoHeight

    predictions.forEach((prediction) => {
      const [x, y, width, height] = prediction.bbox
      const isCar = prediction.class === 'car'
      context.strokeStyle = isCar ? '#3b82f6' : 'rgba(255,255,255,0.45)'
      context.lineWidth = isCar ? 3 : 1.5
      context.strokeRect(x * scaleX, y * scaleY, width * scaleX, height * scaleY)
      if (isCar) {
        context.fillStyle = 'rgba(0, 0, 0, 0.7)'
        context.fillRect(x * scaleX, y * scaleY - 22, 64, 20)
        context.fillStyle = '#ffffff'
        context.font = '12px "Geist Mono", ui-monospace, monospace'
        context.fillText('car', x * scaleX + 6, y * scaleY - 7)
      }
    })
  }, [])

  const iou = (a: number[], b: number[]) => {
    const [ax, ay, aw, ah] = a
    const [bx, by, bw, bh] = b
    const x1 = Math.max(ax, bx)
    const y1 = Math.max(ay, by)
    const x2 = Math.min(ax + aw, bx + bw)
    const y2 = Math.min(ay + ah, by + bh)
    const interArea = Math.max(0, x2 - x1) * Math.max(0, y2 - y1)
    if (interArea === 0) return 0
    const union = aw * ah + bw * bh - interArea
    return union > 0 ? interArea / union : 0
  }

  const fetchServerDetections = useCallback(async () => {
    if (!videoRef.current) return []
    const video = videoRef.current
    if (!video.videoWidth || !video.videoHeight) return []

    if (!captureCanvasRef.current) {
      captureCanvasRef.current = document.createElement('canvas')
    }
    const captureCanvas = captureCanvasRef.current
    const scale = Math.min(1, CAPTURE_MAX_WIDTH / video.videoWidth)
    captureCanvas.width = Math.round(video.videoWidth * scale)
    captureCanvas.height = Math.round(video.videoHeight * scale)
    const ctx = captureCanvas.getContext('2d')
    if (!ctx) return []

    ctx.drawImage(video, 0, 0, captureCanvas.width, captureCanvas.height)

    const blob = await new Promise<Blob | null>((resolve) =>
      captureCanvas.toBlob(resolve, 'image/jpeg', 0.8)
    )
    if (!blob) return []

    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), SERVER_DETECT_TIMEOUT_MS)
    try {
      const response = await fetch(SERVER_DETECT_ENDPOINT, {
        method: 'POST',
        body: blob,
        headers: {
          'content-type': 'image/jpeg'
        },
        signal: controller.signal
      })
      if (!response.ok) {
        return []
      }
      const data = (await response.json()) as {
        predictions?: Detection[]
        width?: number
        height?: number
      }
      const predictions = data.predictions ?? []
      if (!data.width || !data.height) return predictions
      const scaleX = video.videoWidth / data.width
      const scaleY = video.videoHeight / data.height
      return predictions.map((prediction) => ({
        ...prediction,
        bbox: [
          prediction.bbox[0] * scaleX,
          prediction.bbox[1] * scaleY,
          prediction.bbox[2] * scaleX,
          prediction.bbox[3] * scaleY
        ]
      }))
    } catch {
      return []
    } finally {
      window.clearTimeout(timeout)
    }
  }, [])

  const detectFrame = useCallback(async () => {
    const model = modelRef.current
    if (
      (!USE_SERVER_DETECTION && !model) ||
      !videoRef.current ||
      !canvasRef.current ||
      inFlightRef.current
    ) {
      return
    }
    const video = videoRef.current
    if (video.readyState < 2) {
      return
    }
    if (!video.videoWidth || !video.videoHeight) {
      return
    }
    inFlightRef.current = true
    try {
      let predictions: Detection[] = []
      if (USE_SERVER_DETECTION) {
        predictions = await fetchServerDetections()
      } else if (model) {
        const modelPredictions = (await model.detect(
          video,
          DETECT_MAX_BOXES,
          DETECT_MIN_SCORE
        )) as Detection[]
        predictions = modelPredictions
      }

      const normalized: Detection[] = predictions.map((prediction) => ({
        class: prediction.class,
        score: prediction.score,
        bbox: prediction.bbox
      }))

      const minCarArea = video.videoWidth * video.videoHeight * CAR_MIN_AREA_RATIO
      const cars = normalized.filter((prediction) => {
        if (prediction.class !== 'car') return false
        if ((prediction.score ?? 0) < CAR_MIN_SCORE) return false
        const [, , width, height] = prediction.bbox
        return width * height >= minCarArea
      })

      const now = Date.now()
      const tracks = tracksRef.current
      const matchedTrackIds = new Set<number>()
      let newMovingTracks = 0
      let movingCarsCount = 0

      cars.forEach((car) => {
        let bestMatchId: number | null = null
        let bestMatchIou = 0
        tracks.forEach((track) => {
          if (matchedTrackIds.has(track.id)) return
          const score = iou(track.bbox, car.bbox)
          if (score > 0.3 && score > bestMatchIou) {
            bestMatchId = track.id
            bestMatchIou = score
          }
        })

        if (bestMatchId !== null) {
          const track = tracks.find((item) => item.id === bestMatchId)
          if (track) {
            const [x1, y1, w1, h1] = track.bbox
            const [x2, y2, w2, h2] = car.bbox
            const dx = x2 + w2 / 2 - (x1 + w1 / 2)
            const dy = y2 + h2 / 2 - (y1 + h1 / 2)
            const moved = Math.hypot(dx, dy) > 4
            track.movingStreak = moved ? track.movingStreak + 1 : 0
            if (track.movingStreak >= 1) {
              movingCarsCount += 1
              if (!track.counted) {
                track.counted = true
                newMovingTracks += 1
              }
            }
            track.bbox = car.bbox
            track.lastSeen = now
          }
          matchedTrackIds.add(bestMatchId)
        } else {
          tracks.push({
            id: nextTrackIdRef.current++,
            bbox: car.bbox,
            lastSeen: now,
            counted: false,
            movingStreak: 0
          })
        }
      })

      tracksRef.current = tracks.filter((track) => now - track.lastSeen < 5000)
      setCarCount(movingCarsCount)
      if (newMovingTracks > 0) {
        setTotalCars((current) => current + newMovingTracks)
      }

      drawDetections(normalized)
    } catch {
      // Don't overwrite stream status on intermittent detection errors.
    } finally {
      inFlightRef.current = false
    }
  }, [drawDetections, fetchServerDetections])

  useEffect(() => {
    if (modelStatus !== 'ready') return
    detectionTimerRef.current = window.setInterval(detectFrame, DETECTION_INTERVAL_MS)
    return () => {
      if (detectionTimerRef.current) {
        window.clearInterval(detectionTimerRef.current)
      }
    }
  }, [detectFrame, modelStatus])

  useEffect(() => {
    if (!onCarCountChange) return
    onCarCountChange(carCount)
  }, [carCount, onCarCountChange])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(TOTAL_CARS_STORAGE_KEY, String(totalCars))
      localStorage.setItem(TOTAL_CARS_DATE_KEY, getTodayKey())
      localStorage.setItem(TOTAL_CARS_STARTED_AT_KEY, String(startedAt))
    }
    if (!onTotalCarsChange) return
    onTotalCarsChange(totalCars)
  }, [startedAt, totalCars, onTotalCarsChange])

  useEffect(() => {
    if (!onStatusChange) return
    onStatusChange(streamStatus)
  }, [streamStatus, onStatusChange])

  useEffect(() => {
    if (!onResetAgeChange) return
    onResetAgeChange(startedAt)
  }, [onResetAgeChange, startedAt])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const timer = window.setInterval(() => {
      const today = getTodayKey()
      const storedDate = localStorage.getItem(TOTAL_CARS_DATE_KEY)
      if (storedDate !== today) {
        resetTotals(Date.now())
      }
    }, 60000)
    return () => window.clearInterval(timer)
  }, [resetTotals])


  return (
    <div className="space-y-4">
      {debugEnabled && (
        <div className="rounded border border-yellow-500/60 bg-yellow-500/10 p-3 text-xs text-yellow-100">
          <div className="font-mono">debug=1</div>
          <div className="font-mono">streamStatus: {streamStatus}</div>
          <div className="font-mono">streamSrc: {streamSrc ?? 'null'}</div>
          <div className="font-mono">error: {streamError ?? 'none'}</div>
          <div className="font-mono">
            iframeFallback: {useIframeFallback ? 'true' : 'false'}
          </div>
        </div>
      )}
      <div className="stream-frame">
        {useIframeFallback ? (
          <iframe
            title="Traffic Stream"
            src={directFrameUrl}
            className="h-full w-full"
            allow="autoplay; fullscreen"
          />
        ) : streamSrc && isImageSource(streamSrc) ? (
          <img src={streamSrc} alt="Camera still" />
        ) : (
          <>
            <video ref={videoRef} muted playsInline autoPlay crossOrigin="anonymous" />
            <canvas ref={canvasRef} />
          </>
        )}
      </div>
    </div>
  )
}
