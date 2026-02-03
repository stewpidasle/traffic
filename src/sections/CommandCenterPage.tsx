import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import MissionActivityVideo from '../components/MissionActivityVideo'

type CommandCenterPageProps = {
  onStatusChange?: (status: string) => void
  onResetAgeChange?: (startedAt: number) => void
  streamStatus?: string
}

export default function CommandCenterPage({
  onStatusChange,
  onResetAgeChange,
  streamStatus
}: CommandCenterPageProps) {
  const [carCount, setCarCount] = useState(0)
  const [totalCars, setTotalCars] = useState(0)
  const [videoSource, setVideoSource] = useState<string | null>(null)
  const [latencyMs, setLatencyMs] = useState<number | null>(null)

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

  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-4 bg-neutral-900 border-neutral-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-neutral-300 tracking-wider">
              LOCATIONS
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 mb-6">
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
                  {latencyMs === null ? '—' : latencyMs}
                </div>
                <div className="text-xs text-neutral-500">Training</div>
              </div>
            </div>

            <div className="space-y-2">
              {[
                {
                  id: 'G-078W',
                  name: 'VENGEFUL SPIRIT',
                  status: 'active',
                  source: 'wetmet-iframe',
                  dotClass:
                    streamStatus === 'Live'
                      ? 'bg-green-500'
                      : streamStatus === 'Buffering'
                        ? 'bg-yellow-400'
                        : streamStatus === 'Playback error' ||
                            streamStatus === 'Stream unavailable'
                          ? 'bg-red-500'
                          : 'bg-white',
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
                  id: 'G-080Y',
                  name: 'GHOSTLY FURY',
                  status: 'active',
                  source: encodeURI('/videos/Screenshot 2026-02-02 011440.png'),
                  dotClass: 'bg-red-500',
                  disabled: true,
                },
                {
                  id: 'G-081Z',
                  name: 'CURSED REVENANT',
                  status: 'compromised',
                  source: null,
                  dotClass: 'bg-green-500',
                  disabled: false
                }
              ].map((agent) => (
                <button
                  key={agent.id}
                  onClick={() => setVideoSource(agent.source)}
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
                    <div
                      className={`w-2 h-2 rounded-full ${agent.dotClass}`}
                    ></div>
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

        <Card className="lg:col-span-8 bg-neutral-900 border-neutral-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-neutral-300 tracking-wider">
              MISSION ACTIVITY OVERVIEW
            </CardTitle>
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
              ENCRYPTED CHAT ACTIVITY
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            <div className="relative w-32 h-32 mb-4">
              <div className="absolute inset-0 border-2 border-white rounded-full opacity-60 animate-pulse"></div>
              <div className="absolute inset-2 border border-white rounded-full opacity-40"></div>
              <div className="absolute inset-4 border border-white rounded-full opacity-20"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-full h-px bg-white opacity-30"></div>
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-px h-full bg-white opacity-30"></div>
              </div>
            </div>

            <div className="text-xs text-neutral-500 space-y-1 w-full font-mono">
              <div className="flex justify-between">
                <span># 2025-06-17 14:23 UTC</span>
              </div>
              <div className="text-white">{'> [AGT:gh0stfire] ::: INIT >> ^^^ loading secure channel'}</div>
              <div className="text-blue-500">{'> CH#2 | 1231.9082464.500...xR3'}</div>
              <div className="text-white">{'> KEY LOCKED'}</div>
              <div className="text-neutral-400">
                {'> MSG >> "...mission override initiated... awaiting delta node clearance"'}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-4 bg-neutral-900 border-neutral-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-neutral-300 tracking-wider">
              ACTIVITY LOG
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-80 overflow-y-auto">
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

