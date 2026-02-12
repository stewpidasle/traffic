import {
  Bike,
  Cannabis,
  Cctv,
  Clover,
  Crown,
  FishingHook,
  HandMetal,
  MapPin,
  Pizza,
  Radar,
  Rose,
  Wrench
} from 'lucide-react'

const importedIcons = {
  Radar,
  MapPin,
  Rose,
  Pizza,
  HandMetal,
  Crown,
  Clover,
  Cannabis,
  Wrench,
  FishingHook,
  Cctv,
  Bike
}

const App = () => {
  return (
    <div className="p-6">
      <div className="text-sm text-neutral-400 mb-4">ICONS PREVIEW</div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
        {Object.entries(importedIcons).map(([name, Icon]) => (
          <div
            key={name}
            className="flex items-center gap-3 rounded-lg border border-neutral-800 bg-neutral-950/40 px-4 py-3"
          >
            <Icon className="w-8 h-8 text-blue-400" />
            <span className="text-xs text-neutral-300 font-mono">{name}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default App
