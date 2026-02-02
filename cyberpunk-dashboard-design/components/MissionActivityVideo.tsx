cimport Hls from 'hls.js'
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
const DETECT_MAX_BOXES = 50
const DETECT_MIN_SCORE = 0.35
const CAR_MIN_SCORE = 0.45
const CAR_MIN_AREA_RATIO = 0.002
const USE_SERVER_DETECTION = import.meta.env.VITE_USE_SERVER_DETECTION === 'true'
const SERVER_DETECT_ENDPOINT = '/api/detect'
const SERVER_DETECT_TIMEOUT_MS = 8000
const DETECTION_INTERVAL_MS = USE_SERVER_DETECTION ? 1000 : 200
const CAPTURE_MAX_WIDTH = 1280

const extractStreamUrl = (html: string) => {
  const match = html.match(/var\s+vurl\s*=\s*'([^']+)'/)
  return match?.[1] ?? null
}

export default function MissionActivityVideo() {
  const [streamStatus, setStreamStatus] = useState('Connecting')
  const [modelStatus, setModelStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [carCount, setCarCount] = useState(0)
  const [totalCars, setTotalCars] = useState(0)
  const [detections, setDetections] = useState<Detection[]>([])
  const [streamSrc, setStreamSrc] = useState<string | null>(null)
  const modelRef = useRef<cocoSsd.ObjectDetection | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const inFlightRef = useRef(false)
  const detectionTimerRef = useRef<number | null>(null)
  const hlsRef = useRef<Hls | null>(null)
  const tracksRef = useRef<Track[]>([])
  const nextTrackIdRef = useRef(1)
  const captureCanvasRef = useRef<HTMLCanvasElement | null>(null)

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
        }
      } catch {
        if (!cancelled) {
          setStreamStatus('Stream unavailable')
        }
      }
    }

    loadStream()
    const refresh = window.setInterval(loadStream, 25 * 60 * 1000)

    return () => {
      cancelled = true
      window.clearInterval(refresh)
    }
  }, [])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !streamSrc) return

    const handlePlaying = () => setStreamStatus('Live')
    const handleWaiting = () => setStreamStatus('Buffering')
    const handleError = () => setStreamStatus('Playback error')

    video.addEventListener('playing', handlePlaying)
    video.addEventListener('waiting', handleWaiting)
    video.addEventListener('error', handleError)

    if (Hls.isSupported()) {
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
      })
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = streamSrc
      video.play().catch(() => undefined)
    } else {
      setStreamStatus('HLS not supported')
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
      context.strokeStyle = isCar ? '#f97316' : 'rgba(255,255,255,0.45)'
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
    inFlightRef.current = true
    try {
      let predictions: any[] = []
      if (USE_SERVER_DETECTION) {
        predictions = await fetchServerDetections()
      } else if (model) {
        predictions = await model.detect(video, DETECT_MAX_BOXES, DETECT_MIN_SCORE)
      }

      const normalized: Detection[] = predictions.map((prediction: any) => ({
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
      setDetections(normalized)

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
      setStreamStatus('Detection error')
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

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-2xl border border-neutral-700 bg-neutral-950/80 p-4">
          <span className="text-xs uppercase tracking-wider text-neutral-400">Cars detected</span>
          <strong className="mt-2 block text-2xl font-bold text-white font-mono">{carCount}</strong>
        </div>
        <div className="rounded-2xl border border-neutral-700 bg-neutral-950/80 p-4">
          <span className="text-xs uppercase tracking-wider text-neutral-400">Total cars</span>
          <strong className="mt-2 block text-2xl font-bold text-white font-mono">{totalCars}</strong>
        </div>
        <div className="rounded-2xl border border-neutral-700 bg-neutral-950/80 p-4">
          <span className="text-xs uppercase tracking-wider text-neutral-400">Model</span>
          <strong className="mt-2 block text-2xl font-bold text-white font-mono">
            {modelStatus === 'ready'
              ? USE_SERVER_DETECTION
                ? 'GPU server'
                : 'Online'
              : modelStatus}
          </strong>
        </div>
        <div className="rounded-2xl border border-neutral-700 bg-neutral-950/80 p-4">
          <span className="text-xs uppercase tracking-wider text-neutral-400">Status</span>
          <strong className="mt-2 block text-2xl font-bold text-white font-mono">
            {streamStatus}
          </strong>
        </div>
      </div>
      <div className="stream-frame">
        <video ref={videoRef} muted playsInline autoPlay crossOrigin="anonymous" />
        <canvas ref={canvasRef} />
      </div>
      <div className="text-sm text-neutral-400">
        {detections.length === 0
          ? 'Waiting on predictions'
          : `Tracking ${detections.filter((item) => item.class === 'car').length} cars`}
      </div>
    </div>
  )
}
