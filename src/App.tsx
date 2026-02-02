import { useEffect, useState } from 'react'
import { ChevronRight, Monitor, Settings, Shield, Target, Users, Bell, RefreshCw } from 'lucide-react'
import { Button } from './components/ui/button'
import CommandCenterPage from './sections/CommandCenterPage'
import AgentNetworkPage from './sections/AgentNetworkPage'
import OperationsPage from './sections/OperationsPage'
import IntelligencePage from './sections/IntelligencePage'
import SystemsPage from './sections/SystemsPage'

export default function App() {
  const [activeSection, setActiveSection] = useState('overview')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [streamStatus, setStreamStatus] = useState('Connecting')
  const [totalCarsStartedAt, setTotalCarsStartedAt] = useState(() => Date.now())
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const formattedNow = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(now)

  const formatUptime = (ms: number) => {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000))
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60
    return [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':')
  }

  const uptime = formatUptime(now.getTime() - totalCarsStartedAt)

  return (
    <div className="flex h-screen">
      <div
        className={`${sidebarCollapsed ? 'w-16' : 'w-70'} bg-neutral-900 border-r border-neutral-700 transition-all duration-300 fixed md:relative z-50 md:z-auto h-full md:h-auto ${!sidebarCollapsed ? 'md:block' : ''}`}
      >
        <div className="p-4">
          <div className="flex items-center justify-between mb-8">
            <div className={`${sidebarCollapsed ? 'hidden' : 'block'}`}>
              <h1 className="text-blue-500 font-bold text-lg tracking-wider">TACTICAL OPS</h1>
              <p className="text-neutral-500 text-xs">v2.1.7 CLASSIFIED</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="text-neutral-400 hover:text-blue-500"
            >
              <ChevronRight
                className={`w-4 h-4 sm:w-5 sm:h-5 transition-transform ${sidebarCollapsed ? '' : 'rotate-180'}`}
              />
            </Button>
          </div>

          <nav className="space-y-2">
            {[
              { id: 'overview', icon: Monitor, label: 'COMMAND CENTER' },
              { id: 'agents', icon: Users, label: 'CONTACTS' },
              { id: 'operations', icon: Target, label: 'OPERATIONS' },
              { id: 'intelligence', icon: Shield, label: 'INTELLIGENCE' },
              { id: 'systems', icon: Settings, label: 'SYSTEMS' }
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={`w-full flex items-center gap-3 p-3 rounded transition-colors ${
                  activeSection === item.id
                    ? 'bg-blue-500 text-white'
                    : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
                }`}
              >
                <item.icon className="w-5 h-5 md:w-5 md:h-5 sm:w-6 sm:h-6" />
                {!sidebarCollapsed && (
                  <span className="text-sm font-medium">
                    {item.id === 'overview' ? (
                      <>
                        COMMAND <span className="hidden xl:inline">CENTER</span>
                      </>
                    ) : (
                      item.label
                    )}
                  </span>
                )}
              </button>
            ))}
          </nav>

          {!sidebarCollapsed && (
            <div className="mt-8 p-4 bg-neutral-800 border border-neutral-700 rounded">
              <div className="flex items-center gap-2 mb-2">
                <div
                  className={`w-2 h-2 rounded-full animate-pulse ${
                    streamStatus === 'Live'
                      ? 'bg-green-500'
                      : streamStatus === 'Buffering'
                        ? 'bg-yellow-400'
                        : streamStatus === 'Playback error' || streamStatus === 'Stream unavailable'
                          ? 'bg-red-500'
                          : 'bg-white'
                  }`}
                ></div>
                <span className="text-xs text-white">{streamStatus}</span>
              </div>
              <div className="text-xs text-neutral-500">
                <div>UPTIME: {uptime}</div>
                <div>AGENTS: 847 ACTIVE</div>
                <div>MISSIONS: 23 ONGOING</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {!sidebarCollapsed && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setSidebarCollapsed(true)} />
      )}

      <div className={`flex-1 flex flex-col ${!sidebarCollapsed ? 'md:ml-0' : ''}`}>
        <div className="h-16 bg-neutral-800 border-b border-neutral-700 flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <div className="text-sm text-neutral-400">
              TACTICAL COMMAND / <span className="text-blue-500">OVERVIEW</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-xs text-neutral-500">LAST UPDATE: {formattedNow}</div>
            <Button variant="ghost" size="icon" className="text-neutral-400 hover:text-blue-500">
              <Bell className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="text-neutral-400 hover:text-blue-500">
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          {activeSection === 'overview' && (
            <CommandCenterPage
              onStatusChange={setStreamStatus}
              onResetAgeChange={setTotalCarsStartedAt}
              streamStatus={streamStatus}
            />
          )}
          {activeSection === 'agents' && <AgentNetworkPage />}
          {activeSection === 'operations' && <OperationsPage />}
          {activeSection === 'intelligence' && <IntelligencePage />}
          {activeSection === 'systems' && <SystemsPage />}
        </div>
      </div>
    </div>
  )
}

