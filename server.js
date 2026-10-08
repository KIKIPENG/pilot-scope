// pilot-scope bridge:瀏覽器 ──WebSocket──▶ 這裡 ──UDP──▶ Pilot
import http from 'node:http'
import dgram from 'node:dgram'
import { readFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { WebSocketServer } from 'ws'
import { parseCommand, formatCommand } from './public/commands.js'

const PUBLIC_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'public')

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml'
}

async function serveStatic (req, res) {
  let rel
  try {
    rel = decodeURIComponent(new URL(req.url, 'http://x').pathname)
  } catch {
    rel = null
  }
  if (rel === '/') rel = '/index.html'
  const file = rel && path.join(PUBLIC_DIR, rel)
  const type = file && TYPES[path.extname(file)]

  if (!file || !file.startsWith(PUBLIC_DIR + path.sep) || !type) {
    res.writeHead(404).end('not found')
    return
  }
  try {
    const body = await readFile(file)
    res.writeHead(200, { 'content-type': type, 'cache-control': 'no-store' }).end(body)
  } catch {
    res.writeHead(404).end('not found')
  }
}

export function startServer ({
  port = 4000,
  pilotHost = '127.0.0.1',
  pilotPort = 49161,
  log = () => {}
} = {}) {
  const udp = dgram.createSocket('udp4')
  const httpServer = http.createServer(serveStatic)
  // 用 noServer 自己接 upgrade:直接綁 http server 的話,EADDRINUSE 會被 ws 重新丟成未處理的錯誤
  const wss = new WebSocketServer({ noServer: true })
  httpServer.on('upgrade', (req, socket, head) => {
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req))
  })

  wss.on('connection', (ws) => {
    ws.on('message', (data) => {
      const text = `${data}`.trim()
      const cmd = parseCommand(text)
      if (!cmd) {
        ws.send(JSON.stringify({ ok: false, error: `看不懂的訊息:${text}` }))
        return
      }
      const msg = formatCommand(cmd)
      udp.send(msg, pilotPort, pilotHost, (err) => {
        if (err) {
          ws.send(JSON.stringify({ ok: false, error: `UDP 送出失敗:${err.message}` }))
          return
        }
        log(`→ ${msg}`)
        ws.send(JSON.stringify({ ok: true, sent: msg }))
      })
    })
  })

  return new Promise((resolve, reject) => {
    httpServer.once('error', (err) => {
      udp.close()
      reject(err)
    })
    httpServer.listen(port, '127.0.0.1', () => {
      resolve({
        port: httpServer.address().port,
        close: () => new Promise((done) => {
          for (const client of wss.clients) client.terminate()
          wss.close()
          udp.close()
          httpServer.close(() => done())
        })
      })
    })
  })
}

async function main () {
  const port = Number(process.env.PORT ?? 4000)
  const pilotHost = process.env.PILOT_HOST ?? '127.0.0.1'
  const pilotPort = Number(process.env.PILOT_PORT ?? 49161)

  let server
  try {
    server = await startServer({ port, pilotHost, pilotPort, log: (line) => console.log(line) })
  } catch (err) {
    if (err.code === 'EADDRINUSE') {
      console.error(`port ${port} 已被佔用。可能 pilot-scope 已經在跑了,或換一個 port:PORT=4001 npm start`)
    } else {
      console.error(err)
    }
    process.exit(1)
  }

  const url = `http://localhost:${server.port}`
  console.log(`pilot-scope:${url}`)
  console.log(`音符會送到 Pilot(UDP ${pilotHost}:${pilotPort})。沒聲音?確認 Pilot 有開。`)
  if (!process.env.NO_OPEN) spawn('open', [url], { stdio: 'ignore', detached: true }).unref()
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main()
