import { useCallback, useEffect, useRef, useState } from 'react'
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
}

export default function CommandCenterPage({
  onStatusChange,
  onResetAgeChange
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
    },
    {
      id: 'G-088Q',
      name: 'EYE SKY',
      status: 'active',
      source: '/eyssky.png',
      dotClass: 'bg-blue-500',
      disabled: false
    }
  ]
  const [carCount, setCarCount] = useState(0)
  const [totalCars, setTotalCars] = useState(0)
  const [videoSource, setVideoSource] = useState<string | null>(null)
  const [latencyMs, setLatencyMs] = useState<number | null>(null)
  const [mapLocked, setMapLocked] = useState(true)
  const [mapError, setMapError] = useState<string | null>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const mapRef = useRef<HTMLDivElement | null>(null)
  const mapInstanceRef = useRef<any>(null)
  const pendingFlyToRef = useRef<any>(null)
  const flyToTimerRef = useRef<number | null>(null)
  const markerRefs = useRef<any[]>([])
  const mapScriptId = 'google-maps-sdk'
  const handleAgentSelect = (agent: (typeof agents)[number]) => {
    setVideoSource(agent.source ?? null)
  }

  const [devices, setDevices] = useState<
    { id: string; name: string; lat: number; lng: number; last_timestamp?: string }[]
  >([])
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
        mapInstanceRef.current.setZoom(18)
      }

      markerRefs.current.forEach((marker) => {
        marker.setMap(null)
      })
      markerRefs.current = []

      const bounds = new google.maps.LatLngBounds()
      devices.forEach((device) => {
        const deviceName = device.name?.toLowerCase() ?? ''
        const isFavorite = deviceName === 'favorite'
        const isTransport = deviceName === 'transport'
        const isStashhouse = deviceName === 'stashhouse' || deviceName === 'outpost'
        const isDevOps = deviceName === 'devops'
        const isRemote = deviceName === 'crew'
        const isComms = deviceName === 'comms'
        const markerUrl = isTransport
          ? '/four.png'
          : isFavorite
            ? '/favorite.png'
            : isStashhouse
              ? '/cook.png'
            : isStashhouse
              ? '/cook.png'
              : isDevOps
                ? '/dodo.png'
                : isRemote
                  ? '/wutang.png'
                  : isComms
                    ? '/comms.png'
                    : '/device-marker.svg'
        const markerSize =
          isComms || isFavorite || isStashhouse || isDevOps || isRemote || isTransport
            ? new google.maps.Size(40, 40)
            : new google.maps.Size(40, 54)
        const markerAnchor =
          isComms || isFavorite || isStashhouse || isDevOps || isRemote || isTransport
            ? new google.maps.Point(20, 20)
            : new google.maps.Point(20, 54)
        const marker = new google.maps.Marker({
          position: { lat: device.lat, lng: device.lng },
          map: mapInstanceRef.current,
          title: device.name,
          icon: {
            url: markerUrl,
            scaledSize: markerSize,
            anchor: markerAnchor
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
  }, [devices, mapLocked])

  const fetchDevices = useCallback(async () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setCenter({ lat: 39.4897, lng: -88.1826 })
      mapInstanceRef.current.setZoom(10)
    }
    try {
      const response = await fetch('/api/devices', { cache: 'no-store' })
      if (!response.ok) {
        setFetchError(`Request failed: ${response.status}`)
        return
      }
      const payload = await response.json()
      setFetchError(null)
      const list = Array.isArray(payload) ? payload : payload?.devices ?? []
      const normalized = list
        .map((item: any) => ({
          id: String(item.id ?? item.uuid ?? ''),
          name: String(item.name ?? '') || '',
          lat: Number(item.lat ?? item.latitude),
          lng: Number(item.lng ?? item.lon ?? item.longitude),
          last_timestamp: item.last_timestamp ?? item.lastTimestamp ?? item.last_ts
        }))
        .map((item: any) => ({
          ...item,
          name:
            item.name.toLowerCase() === 'burner'
              ? 'Comms'
              : item.name.toLowerCase() === 'umbrella'
                ? 'Stashhouse'
                : item.name.toLowerCase() === 'outpost'
                  ? 'Stashhouse'
                  : item.name.toLowerCase() === 'outcast'
                    ? 'Stashhouse'
                    : item.name.toLowerCase() === 'remote'
                      ? 'Crew'
                  : item.name.toLowerCase() === 'jessica'
                    ? 'Transport'
                  : item.name.toLowerCase() === 'phone'
                    ? 'DevOps'
                      : item.name
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
      setFetchError('Failed to fetch devices.')
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const handleRefresh = () => {
      void fetchDevices()
    }
    window.addEventListener('pytile:refresh', handleRefresh)
    return () => window.removeEventListener('pytile:refresh', handleRefresh)
  }, [fetchDevices])

  useEffect(() => {
    if (typeof window === 'undefined') return
    void fetchDevices()
  }, [fetchDevices])

  const flyToDevice = (lat: number, lng: number) => {
    if (!mapInstanceRef.current) {
      pendingFlyToRef.current = { lat, lng }
      return
    }
    const map = mapInstanceRef.current
    const target = new google.maps.LatLng(lat, lng)
    if (flyToTimerRef.current) {
      window.clearTimeout(flyToTimerRef.current)
      flyToTimerRef.current = null
    }

    const targetZoom = 18
    const minZoom = 10
    const zoomDelayMs = 120

    const smoothZoomOut = () => {
      const current = map.getZoom() ?? minZoom
      const bounds = map.getBounds()
      if (bounds && bounds.contains(target)) {
        map.panTo(target)
        flyToTimerRef.current = window.setTimeout(smoothZoomIn, 200)
        return
      }
      if (current <= minZoom) {
        map.panTo(target)
        flyToTimerRef.current = window.setTimeout(smoothZoomIn, 200)
        return
      }
      map.setZoom(current - 1)
      flyToTimerRef.current = window.setTimeout(smoothZoomOut, zoomDelayMs)
    }

    const smoothZoomIn = () => {
      const current = map.getZoom() ?? minZoom
      if (current >= targetZoom) {
        flyToTimerRef.current = null
        return
      }
      map.setZoom(current + 1)
      flyToTimerRef.current = window.setTimeout(smoothZoomIn, zoomDelayMs)
    }

    smoothZoomOut()
  }


  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-8 bg-neutral-900 border-neutral-700">
              <CardHeader className="pb-3">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <CardTitle className="text-sm font-medium text-neutral-300 tracking-wider">
                    MISSION OVERVIEW
                  </CardTitle>
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
                        {latencyMs === null ? '--' : latencyMs}
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
                  videoSource={videoSource}
                />
              </CardContent>
        </Card>

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
                  ENCRYPTED LOCATION
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center">
                <div className="w-full">
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
                {fetchError && (
                  <div className="mt-4 w-full text-[10px] text-red-400 font-mono">{fetchError}</div>
                )}
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
