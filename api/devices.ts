import { spawn } from 'node:child_process'
import { resolve } from 'node:path'

const runPytile = () =>
  new Promise<{ stdout: string; stderr: string; code: number }>((resolvePromise) => {
    const python = process.env.PYTILE_PYTHON ?? process.env.PYTHON ?? 'python'
    const repoRoot = process.cwd()
    const scriptPath = resolve(repoRoot, 'backend', 'pytile', 'examples', 'get_locations.py')
    const cwd = resolve(repoRoot, 'backend', 'pytile')

    const child = spawn(python, [scriptPath], {
      cwd,
      env: process.env
    })

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString()
    })
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })
    child.on('error', (error) => {
      stderr += error instanceof Error ? error.message : String(error)
    })
    child.on('close', (code) => {
      resolvePromise({ stdout, stderr, code: code ?? 1 })
    })
  })

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    res.statusCode = 405
    res.setHeader('allow', 'GET')
    res.end('Method not allowed')
    return
  }

  const result = await runPytile()
  if (result.code !== 0) {
    res.statusCode = 500
    res.setHeader('content-type', 'application/json')
    res.end(
      JSON.stringify({
        error: 'pytile failed',
        detail: result.stderr || result.stdout || 'Unknown error'
      })
    )
    return
  }

  res.statusCode = 200
  res.setHeader('content-type', 'application/json')
  res.end(result.stdout || '{"devices": []}')
}
