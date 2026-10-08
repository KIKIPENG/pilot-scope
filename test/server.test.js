import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import dgram from 'node:dgram'
import { once } from 'node:events'
import WebSocket from 'ws'
import { startServer } from '../server.js'

let udp, received, server, ws

// 假的 Pilot:收下所有 UDP 訊息
beforeAll(async () => {
  received = []
  udp = dgram.createSocket('udp4')
  udp.on('message', (msg) => received.push(`${msg}`))
  udp.bind(0, '127.0.0.1')
  await once(udp, 'listening')

  server = await startServer({ port: 0, pilotHost: '127.0.0.1', pilotPort: udp.address().port })
  ws = new WebSocket(`ws://127.0.0.1:${server.port}/`)
  await once(ws, 'open')
})

afterAll(async () => {
  ws?.close()
  await server?.close()
  udp?.close()
})

const nextReply = async () => JSON.parse(`${(await once(ws, 'message'))[0]}`)
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

describe('WebSocket → UDP bridge', () => {
  it('合法字串原樣轉送給 Pilot', async () => {
    received.length = 0
    ws.send('04Cf8')
    expect(await nextReply()).toEqual({ ok: true, sent: '04Cf8' })
    await wait(50)
    expect(received).toEqual(['04Cf8'])
  })

  it('帶 Orca 的 ; 也接受,但送出時去掉', async () => {
    received.length = 0
    ws.send(';a3g')
    expect(await nextReply()).toEqual({ ok: true, sent: 'a3g' })
    await wait(50)
    expect(received).toEqual(['a3g'])
  })

  it('非法字串:UDP 收不到,WebSocket 回錯誤', async () => {
    received.length = 0
    ws.send('04e')
    const reply = await nextReply()
    expect(reply.ok).toBe(false)
    expect(reply.error).toMatch(/04e/)
    await wait(100)
    expect(received).toEqual([])
  })

  it('音色設定、效果器、reset 也轉送(效果數值轉成小寫)', async () => {
    received.length = 0
    for (const msg of ['0ENV056f', '1OSCsisq', 'BITFA', 'reset']) {
      ws.send(msg)
      expect((await nextReply()).ok).toBe(true)
    }
    await wait(50)
    expect(received).toEqual(['0ENV056f', '1OSCsisq', 'BITfa', 'reset'])
  })

  it('其他 Pilot 指令(如 bpm)擋下', async () => {
    received.length = 0
    ws.send('bpm120')
    expect((await nextReply()).ok).toBe(false)
    await wait(100)
    expect(received).toEqual([])
  })
})

describe('靜態檔', () => {
  const base = () => `http://127.0.0.1:${server.port}`

  it('提供 index.html', async () => {
    const res = await fetch(`${base()}/`)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toMatch(/text\/html/)
    expect(await res.text()).toContain('pilot-scope')
  })

  it('提供 parser.js 為 JavaScript', async () => {
    const res = await fetch(`${base()}/parser.js`)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toMatch(/javascript/)
  })

  it('不存在的檔案 404', async () => {
    expect((await fetch(`${base()}/nope.js`)).status).toBe(404)
  })

  it('不能跳出 public/', async () => {
    expect((await fetch(`${base()}/..%2fpackage.json`)).status).toBe(404)
  })
})

describe('port 被佔用', () => {
  it('startServer 以 EADDRINUSE 失敗', async () => {
    await expect(startServer({ port: server.port })).rejects.toMatchObject({ code: 'EADDRINUSE' })
  })
})
