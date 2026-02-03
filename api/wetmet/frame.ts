export default async function handler(_req: any, res: any) {
  try {
    const response = await fetch(
      'https://api.wetmet.net/widgets/stream/frame.php?uid=73078bd38a6f267f388473b67316baab',
      {
        headers: {
          'user-agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'accept-language': 'en-US,en;q=0.9',
          referer: 'https://wetmet.net/',
          origin: 'https://wetmet.net'
        },
        redirect: 'follow',
        cache: 'no-store'
      }
    )
    if (!response.ok) {
      res.statusCode = response.status
      res.end(`Upstream error: ${response.status}`)
      return
    }
    const body = await response.text()
    res.statusCode = 200
    res.setHeader('content-type', 'text/html; charset=utf-8')
    res.end(body)
  } catch {
    res.statusCode = 502
    res.end('Failed to load stream frame')
  }
}
