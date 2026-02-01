const getRawBody = async (req: any) => {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return Buffer.concat(chunks)
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.statusCode = 405
    res.setHeader('allow', 'POST')
    res.end('Method not allowed')
    return
  }

  const target = process.env.GPU_DETECT_URL
  if (!target) {
    res.statusCode = 500
    res.end('GPU_DETECT_URL not configured')
    return
  }

  try {
    const body = await getRawBody(req)
    const form = new FormData()
    form.append('file', new Blob([body], { type: 'image/jpeg' }), 'frame.jpg')

    const headers: Record<string, string> = {}
    if (process.env.GPU_DETECT_TOKEN) {
      headers['x-api-key'] = process.env.GPU_DETECT_TOKEN
    }

    const response = await fetch(target, {
      method: 'POST',
      body: form,
      headers
    })

    const payload = await response.text()
    res.statusCode = response.status
    res.setHeader('content-type', response.headers.get('content-type') ?? 'application/json')
    res.end(payload)
  } catch {
    res.statusCode = 502
    res.end('GPU detect error')
  }
}
