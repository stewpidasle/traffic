import { useEffect, useMemo, useRef, useState } from 'react'
import { Cctv } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import MissionActivityVideo from '../components/MissionActivityVideo'

declare global {
  interface Window {
    google: any
  }
}

declare const google: any

type CommandCenterPageProps = {
  onStatusChange?: (status: string) => void
  onResetAgeChange?: (startedAt: number) => void
  viewMode?: 'overview' | 'overwatch'
}

export default function CommandCenterPage({
  onStatusChange,
  onResetAgeChange,
  viewMode = 'overview'
}: CommandCenterPageProps) {
  const agents = [
    {
      id: 'G-081Z',
      name: 'CURSED REVENANT',
      status: 'compromised',
      source: null,
      dotClass: 'bg-green-500',
      disabled: false
    },
    {
      id: 'G-079X',
      name: 'OBSIDIAN SENTINEL',
      status: 'standby',
      source: encodeURI('/videos/Screenshot 2026-02-02 011440.png'),
      dotClass: 'bg-red-500',
      disabled: false
    }
  ]
  const cameraLabels = useMemo(
    () =>
      Array.from({ length: 4 }, () => String(100 + Math.floor(Math.random() * 101)).padStart(3, '0')),
    []
  )
  const [carCount, setCarCount] = useState(0)
  const [totalCars, setTotalCars] = useState(0)
  const [videoSource, setVideoSource] = useState<string | null>(null)
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null)
  const [latencyMs, setLatencyMs] = useState<number | null>(null)
  const [showRadarDots, setShowRadarDots] = useState(false)
  const [mapLocked, setMapLocked] = useState(true)
  const [mapError, setMapError] = useState<string | null>(null)
  const mapRef = useRef<HTMLDivElement | null>(null)
  const mapInstanceRef = useRef<any>(null)
  const pendingFlyToRef = useRef<any>(null)
  const markerRefs = useRef<any[]>([])
  const radarDotTimerRef = useRef<number | null>(null)
  const mapScriptId = 'google-maps-sdk'
  const handleAgentSelect = (agent: (typeof agents)[number]) => {
    setSelectedAgentId(agent.id)
    setVideoSource(agent.source ?? null)
  }

  const [devices, setDevices] = useState<
    { id: string; name: string; lat: number; lng: number; last_timestamp?: string }[]
  >([
    { id: 'def103c2b3bc5e44', name: 'Transport', lat: 39.485768470788464, lng: -88.18258415555323 },
    { id: 'd9a9b64270e72040', name: 'Ghost', lat: 39.4807227, lng: -88.1654593 },
    { id: 'e6f8724aef8c9bce', name: 'Angel-Fire', lat: 39.53893, lng: -87.677691 },
    { id: 'p!6408eeb937d9a20743665a7501dee6f5', name: 'Telecoms', lat: 39.4858167, lng: -88.1825483 },
    { id: 'p!880d9b5932a08d8d1431203b38a5f8d0', name: 'Hell-Fire', lat: 39.4857565, lng: -88.1825523 }
  ])
  const radarDotPositions = [
    'radar-dot-pos-1',
    'radar-dot-pos-2',
    'radar-dot-pos-3',
    'radar-dot-pos-4',
    'radar-dot-pos-5'
  ]

  useEffect(() => {
    if (typeof window === 'undefined') return

    let isActive = true
    const ping = async () => {
      const start = performance.now()
      try {
        await fetch(window.location.origin, { method: 'HEAD', cache: 'no-store' })
        if (!isActive) return
        setLatencyMs(Math.round(performance.now() - start))
      } catch {
        if (!isActive) return
        setLatencyMs(null)
      }
    }

    ping()
    const timer = window.setInterval(ping, 5000)
    return () => {
      isActive = false
      window.clearInterval(timer)
    }
  }, [])

  useEffect(() => {
    if (viewMode !== 'overwatch') return
    if (!mapRef.current) return
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
    if (!apiKey) {
      setMapError('Google Maps API key is missing.')
      return
    }
    setMapError(null)

    const initMap = () => {
      if (!mapRef.current) return
      if (!mapInstanceRef.current) {
        mapInstanceRef.current = new google.maps.Map(mapRef.current, {
          center: { lat: 39.4897, lng: -88.1826 },
          zoom: 10,
          mapTypeId: 'satellite',
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          gestureHandling: mapLocked ? 'none' : 'auto',
          zoomControl: false
        })
      } else {
        mapInstanceRef.current.setOptions({
          gestureHandling: mapLocked ? 'none' : 'auto',
          zoomControl: false
        })
      }

      if (pendingFlyToRef.current) {
        const { lat, lng } = pendingFlyToRef.current
        pendingFlyToRef.current = null
        mapInstanceRef.current.setCenter({ lat, lng })
        mapInstanceRef.current.setZoom(14)
      }

      markerRefs.current.forEach((marker) => {
        marker.setMap(null)
      })
      markerRefs.current = []

      const bounds = new google.maps.LatLngBounds()
      devices.forEach((device) => {
        const marker = new google.maps.Marker({
          position: { lat: device.lat, lng: device.lng },
          map: mapInstanceRef.current,
          title: device.name,
          icon: {
            url: '/device-marker.svg',
            scaledSize: new google.maps.Size(28, 38),
            anchor: new google.maps.Point(14, 38)
          },
          label: {
            text: device.name?.charAt(0).toUpperCase() ?? '',
            color: '#E2E8F0',
            fontSize: '10px',
            fontWeight: '600'
          }
        })
        markerRefs.current.push(marker)
        bounds.extend(marker.getPosition())
      })
      if (!bounds.isEmpty()) {
        mapInstanceRef.current.fitBounds(bounds)
      }
    }

    if (window.google?.maps) {
      initMap()
      return
    }
    const existingScript = document.getElementById(mapScriptId) as HTMLScriptElement | null
    if (existingScript) {
      existingScript.addEventListener('load', initMap, { once: true })
      return
    }

    const script = document.createElement('script')
    script.id = mapScriptId
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`
    script.async = true
    script.defer = true
    script.onload = initMap
    script.onerror = () => setMapError('Google Maps failed to load.')
    document.head.appendChild(script)

    return () => {
      script.onload = null
      script.onerror = null
    }
  }, [devices, mapLocked, viewMode])

  const fetchDevices = async () => {
    if (radarDotTimerRef.current) {
      window.clearTimeout(radarDotTimerRef.current)
    }
    setShowRadarDots(true)
    radarDotTimerRef.current = window.setTimeout(() => {
      setShowRadarDots(false)
      radarDotTimerRef.current = null
    }, 1800)
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setCenter({ lat: 39.4897, lng: -88.1826 })
      mapInstanceRef.current.setZoom(10)
    }
    try {
      const response = await fetch('/api/devices', { cache: 'no-store' })
      if (!response.ok) return
      const payload = await response.json()
      const list = Array.isArray(payload) ? payload : payload?.devices ?? []
      const normalized = list
        .map((item: any) => ({
          id: String(item.id ?? item.uuid ?? ''),
          name: String(item.name ?? ''),
          lat: Number(item.lat ?? item.latitude),
          lng: Number(item.lng ?? item.lon ?? item.longitude),
          last_timestamp: item.last_timestamp ?? item.lastTimestamp ?? item.last_ts
        }))
        .filter((item: any) => item.id && Number.isFinite(item.lat) && Number.isFinite(item.lng))
        .sort((a: any, b: any) => {
          const aTime = a.last_timestamp ? Date.parse(a.last_timestamp) : 0
          const bTime = b.last_timestamp ? Date.parse(b.last_timestamp) : 0
          return bTime - aTime
        })
      if (normalized.length) {
        setDevices(normalized)
      }
    } catch {
      // ignore fetch errors for now
    }
  }

  const flyToDevice = (lat: number, lng: number) => {
    if (!mapInstanceRef.current) {
      pendingFlyToRef.current = { lat, lng }
      return
    }
    const map = mapInstanceRef.current
    const target = new google.maps.LatLng(lat, lng)
    const bounds = map.getBounds()

    if (bounds && !bounds.contains(target)) {
      const nextBounds = new google.maps.LatLngBounds()
      const center = map.getCenter()
      if (center) {
        nextBounds.extend(center)
      }
      nextBounds.extend(target)
      map.fitBounds(nextBounds)
      google.maps.event.addListenerOnce(map, 'idle', () => {
        map.panTo(target)
        window.setTimeout(() => {
          map.setZoom(14)
        }, 300)
      })
      return
    }

    map.panTo(target)
    window.setTimeout(() => {
      map.setZoom(14)
    }, 300)
  }


  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {viewMode === 'overview' && (
          <>
            <Card className="lg:col-span-8 bg-neutral-900 border-neutral-700">
              <CardHeader className="pb-3">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <CardTitle className="text-sm font-medium text-neutral-300 tracking-wider">
                    MISSION OVERVIEW
                  </CardTitle>
                  <div className="flex flex-wrap items-center justify-center gap-6 lg:gap-4">
                    {cameraLabels.map((label, index) => {
                      const agent = agents[index % agents.length]
                      return (
                        <button
                          key={label}
                          type="button"
                          onClick={() => handleAgentSelect(agent)}
                          className="flex flex-col items-center gap-2 rounded-md px-2 py-1 transition-colors hover:bg-neutral-800"
                          aria-label={`Select agent ${agent.id}`}
                        >
                          <span className="text-[10px] text-neutral-500">{label}</span>
                          <Cctv className="h-6 w-6 text-blue-400" />
                        </button>
                      )
                    })}
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-white font-mono">{carCount}</div>
                      <div className="text-xs text-neutral-500">Detected</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-white font-mono">{totalCars}</div>
                      <div className="text-xs text-neutral-500">Total</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-white font-mono">
                        {latencyMs === null ? 'â€”' : latencyMs}
                      </div>
                      <div className="text-xs text-neutral-500">Training</div>
                    </div>
                  </div>
                </div>
              </CardHeader>
          <CardContent>
            <MissionActivityVideo
              onCarCountChange={setCarCount}
              onTotalCarsChange={setTotalCars}
                  onStatusChange={onStatusChange}
                  onResetAgeChange={onResetAgeChange}
                  videoSource={selectedAgentId === agents[1]?.id ? videoSource : null}
                />
              </CardContent>
            </Card>

            <Card className="lg:col-span-4 bg-neutral-900 border-neutral-700">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-neutral-300 tracking-wider">
                  ACTIVITY LOG
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-80 overflow-y-auto scrollbar-none">
                  {[
                    {
                      time: '25/06/2025 09:29',
                      agent: 'gh0st_Fire',
                      action: 'completed mission in',
                      location: 'Berlin',
                      target: 'zer0_Nigh'
                    },
                    {
                      time: '25/06/2025 08:12',
                      agent: 'dr4g0n_V3in',
                      action: 'extracted high-value target in',
                      location: 'Cairo',
                      target: null
                    },
                    {
                      time: '24/06/2025 22:55',
                      agent: 'sn4ke_Sh4de',
                      action: 'lost communication in',
                      location: 'Havana',
                      target: null
                    },
                    {
                      time: '24/06/2025 21:33',
                      agent: 'ph4nt0m_R4ven',
                      action: 'initiated surveillance in',
                      location: 'Tokyo',
                      target: null
                    },
                    {
                      time: '24/06/2025 19:45',
                      agent: 'v0id_Walk3r',
                      action: 'compromised security in',
                      location: 'Moscow',
                      target: 'd4rk_M4trix'
                    }
                  ].map((log, index) => (
                    <div
                      key={index}
                      className="text-xs border-l-2 border-blue-500 pl-3 hover:bg-neutral-800 p-2 rounded transition-colors"
                    >
                      <div className="text-neutral-500 font-mono">{log.time}</div>
                      <div className="text-white">
                        Agent <span className="text-blue-500 font-mono">{log.agent}</span>{' '}
                        {log.action} <span className="text-white font-mono">{log.location}</span>
                        {log.target && (
                          <span>
                            {' '}
                            with agent{' '}
                            <span className="text-blue-500 font-mono">{log.target}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {viewMode === 'overwatch' && (
          <>
            <Card className="lg:col-span-4 bg-neutral-900 border-neutral-700">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-neutral-300 tracking-wider">
                  ENCRYPTED LOCATION
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center">
                <button
                  type="button"
                  onClick={fetchDevices}
                  className="relative w-32 h-32 mb-4 focus:outline-none cursor-pointer"
                  aria-label="Refresh device data"
                >
                  <div className="radar-sweep"></div>
                  <div className="radar-glow"></div>
                  {showRadarDots && (
                    <>
                      {radarDotPositions.map((positionClass) => (
                        <span key={positionClass} className={`radar-dot ${positionClass}`} />
                      ))}
                    </>
                  )}
                  <div className="absolute inset-0 border-2 border-white rounded-full opacity-60 animate-pulse"></div>
                  <div className="absolute inset-2 border border-white rounded-full opacity-40"></div>
                  <div className="absolute inset-4 border border-white rounded-full opacity-20"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-full h-px bg-white opacity-30"></div>
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-px h-full bg-white opacity-30"></div>
                  </div>
                </button>

                <div className="mt-4 w-full">
                  <div className="space-y-3">
                    {devices.map((device) => (
                      <button
                        key={device.id}
                        onClick={() => flyToDevice(device.lat, device.lng)}
                        className="w-full text-left text-xs text-blue-400 transition-colors font-mono border-l-2 border-blue-500 pl-3 hover:bg-neutral-800 p-2 rounded"
                      >
                        <div className="flex items-start gap-3">
                          <div className="text-xs whitespace-nowrap min-w-28">
                            <span className="text-white">{'> '}</span>
                            <span className="text-blue-400">[</span>
                            <span className="text-white">{device.name.toUpperCase()}</span>
                            <span className="text-blue-400">]</span>
                          </div>
                          <div className="flex flex-col gap-1 text-left">
                            <div className="text-[10px] text-neutral-500">
                              <span className="text-blue-400">[</span>
                              <span className="text-neutral-500">
                                {device.lat.toFixed(2)}, {device.lng.toFixed(2)}
                              </span>
                              <span className="text-blue-400">]</span>
                            </div>
                            {device.last_timestamp && (
                              <div className="text-[10px] text-neutral-500">
                                {new Date(device.last_timestamp).toLocaleString()}
                              </div>
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-8 bg-neutral-900 border-neutral-700">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-neutral-300 tracking-wider">
                  MISSION OVERWATCH
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="aspect-video w-full overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950 relative">
                  <div ref={mapRef} className="h-full w-full" />
                  <button
                    type="button"
                    onClick={() => setMapLocked((prev) => !prev)}
                    className="absolute right-3 top-3 text-xs px-3 py-1 rounded border border-neutral-700 bg-neutral-900/80 text-neutral-200 hover:text-white"
                    disabled={Boolean(mapError)}
                  >
                    {mapLocked ? 'Unlock Map' : 'Lock Map'}
                  </button>
                  {mapError && (
                    <div className="absolute inset-0 flex items-center justify-center bg-neutral-950/80 text-xs text-neutral-300">
                      {mapError}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </>
        )}
<Card className="lg:col-span-4 bg-neutral-900 border-neutral-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-neutral-300 tracking-wider">
              DETECTIONS
            </CardTitle>
          </CardHeader>
          <CardContent>
            

            <div className="space-y-2">
              {agents.map((agent) => (
                <button
                  key={agent.id}
                  onClick={() => handleAgentSelect(agent)}
                  disabled={agent.disabled}
                  className={`flex w-full items-center justify-between p-2 rounded transition-colors ${
                    agent.disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
                  } ${
                    videoSource === agent.source
                      ? 'bg-neutral-700'
                      : 'bg-neutral-800 hover:bg-neutral-700'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${agent.dotClass}`}></div>
                    <div>
                      <div className="text-xs text-white font-mono">{agent.id}</div>
                      <div className="text-xs text-neutral-500">{agent.name}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-4 bg-neutral-900 border-neutral-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-neutral-300 tracking-wider">
              MISSION INFORMATION
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                  <span className="text-xs text-white font-medium">Successful Missions</span>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-neutral-400">High Risk Mission</span>
                    <span className="text-white font-bold font-mono">190</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-neutral-400">Medium Risk Mission</span>
                    <span className="text-white font-bold font-mono">426</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-neutral-400">Low Risk Mission</span>
                    <span className="text-white font-bold font-mono">920</span>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                  <span className="text-xs text-red-500 font-medium">Failed Missions</span>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-neutral-400">High Risk Mission</span>
                    <span className="text-white font-bold font-mono">190</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-neutral-400">Medium Risk Mission</span>
                    <span className="text-white font-bold font-mono">426</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-neutral-400">Low Risk Mission</span>
                    <span className="text-white font-bold font-mono">920</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        
      </div>
    </div>
  )
}
