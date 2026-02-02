import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

const wetmetProxy = () => ({
  name: 'wetmet-proxy',
  configureServer(server: { middlewares: any }) {
    server.middlewares.use('/api/wetmet/frame', async (_req: any, res: any) => {
      try {
        const response = await fetch(
          'https://api.wetmet.net/widgets/stream/frame.php?uid=73078bd38a6f267f388473b67316baab'
        )
        const body = await response.text()
        res.statusCode = 200
        res.setHeader('content-type', 'text/html; charset=utf-8')
        res.end(body)
      } catch {
        res.statusCode = 502
        res.end('Failed to load stream frame')
      }
    })

    server.middlewares.use('/api/wetmet/proxy', async (req: any, res: any) => {
      try {
        const url = new URL(req.url ?? '', 'http://localhost')
        const target = url.searchParams.get('url')
        if (!target) {
          res.statusCode = 400
          res.end('Missing url')
          return
        }

        const response = await fetch(target)
        const contentType = response.headers.get('content-type') ?? ''
        if (contentType.includes('application/vnd.apple.mpegurl') || target.endsWith('.m3u8')) {
          const playlist = await response.text()
          const rewritten = playlist
            .split('\n')
            .map((line) => {
              const trimmed = line.trim()
              if (!trimmed || trimmed.startsWith('#')) {
                return line
              }
              const resolved = new URL(trimmed, target).toString()
              return `/api/wetmet/proxy?url=${encodeURIComponent(resolved)}`
            })
            .join('\n')
          res.statusCode = 200
          res.setHeader('content-type', 'application/vnd.apple.mpegurl')
          res.end(rewritten)
          return
        }

        const buffer = Buffer.from(await response.arrayBuffer())
        res.statusCode = response.status
        if (contentType) {
          res.setHeader('content-type', contentType)
        }
        res.end(buffer)
      } catch {
        res.statusCode = 502
        res.end('Proxy error')
      }
    })
  }
})

export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          tfjs: ['@tensorflow/tfjs', '@tensorflow-models/coco-ssd'],
          hls: ['hls.js'],
          ui: ['lucide-react', 'class-variance-authority', '@radix-ui/react-slot', '@radix-ui/react-progress']
        }
      }
    }
  },
  plugins: [
    wetmetProxy(),
    tailwindcss(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['dodo-icon-192.png', 'dodo-icon-512.png'],
      manifest: {
        name: 'Eyes PWA',
        short_name: 'Eyes',
        description: 'A bold, offline-ready single-page app built with React + Vite.',
        theme_color: '#0f1324',
        background_color: '#0f1324',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: '/dodo-icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/dodo-icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: '/dodo-icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      }
    })
  ]
})
