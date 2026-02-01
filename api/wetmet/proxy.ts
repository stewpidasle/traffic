const allowedHosts = ['wetmet.net', 'amazonaws.com']

const isAllowedTarget = (target: string) => {
  try {
    const url = new URL(target)
    return allowedHosts.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`))
  } catch {
    return false
  }
}

export default async function handler(req: any, res: any) {
  try {
    const url = new URL(req.url ?? '', 'http://localhost')
    const target = url.searchParams.get('url')
    if (!target) {
      res.statusCode = 400
      res.end('Missing url')
      return
    }
    if (!isAllowedTarget(target)) {
      res.statusCode = 403
      res.end('Blocked target')
      return
    }

    const response = await fetch(target)
    const contentType = response.headers.get('content-type') ?? ''
    const isPlaylist =
      contentType.includes('application/vnd.apple.mpegurl') || target.endsWith('.m3u8')

    if (isPlaylist) {
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
}
