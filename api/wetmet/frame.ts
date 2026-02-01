export default async function handler(_req: any, res: any) {
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
}
