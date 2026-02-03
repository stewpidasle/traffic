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

    const baseHeaders = {
      'user-agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      accept: '*/*',
      'accept-language': 'en-US,en;q=0.9',
      referer: 'https://wetmet.net/',
      origin: 'https://wetmet.net'
    } as const

    let response = await fetch(target, {
      headers: baseHeaders,
      redirect: 'follow',
      cache: 'no-store'
    })

    if (response.status === 403 && target.includes('wetmet.net')) {
      response = await fetch(target, {
        headers: {
          ...baseHeaders,
          referer:
            'https://api.wetmet.net/widgets/stream/frame.php?uid=73078bd38a6f267f388473b67316baab',
          origin: 'https://api.wetmet.net'
        },
        redirect: 'follow',
        cache: 'no-store'
      })
    }
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
    res.setHeader('x-proxy-upstream-status', String(response.status))
    if (contentType) {
      res.setHeader('content-type', contentType)
    }
    res.end(buffer)
  } catch {
    res.statusCode = 502
    res.end('Proxy error')
  }
}
