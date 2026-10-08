import { NOTES, pitch, noteName } from './parser.js'
import { channelColor } from './channels.js'

const WINDOW = 20 // 秒
const MIN_SPAN = 24 // 至少顯示兩個八度

export function createRoll (canvas) {
  const ctx = canvas.getContext('2d')
  const notes = [] // { t, pitch, channel, velocity, seconds }

  function resize () {
    const ratio = window.devicePixelRatio || 1
    const { width, height } = canvas.getBoundingClientRect()
    canvas.width = Math.round(width * ratio)
    canvas.height = Math.round(height * ratio)
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
  }

  // 縱軸跟著最近的音自動縮放
  function range () {
    if (!notes.length) return [48, 48 + MIN_SPAN - 1]
    let lo = Math.min(...notes.map(n => n.pitch))
    let hi = Math.max(...notes.map(n => n.pitch))
    if (hi - lo + 1 < MIN_SPAN) {
      const pad = (MIN_SPAN - (hi - lo + 1)) / 2
      lo = Math.floor(lo - pad)
      hi = lo + MIN_SPAN - 1
    }
    return [lo - 1, hi + 1]
  }

  function draw () {
    const now = performance.now() / 1000
    while (notes.length && now - notes[0].t > WINDOW + 1) notes.shift()

    const { width: w, height: h } = canvas.getBoundingClientRect()
    const labelW = 32
    const plotW = w - labelW
    const [lo, hi] = range()
    const row = h / (hi - lo + 1)
    const yOf = (p) => h - (p - lo + 1) * row
    const pxPerSec = plotW / WINDOW

    ctx.clearRect(0, 0, w, h)

    // 每個 C 畫一條線、標上八度
    ctx.font = '11px ui-monospace, monospace'
    ctx.textBaseline = 'middle'
    for (let p = lo; p <= hi; p++) {
      const name = NOTES[((p % 12) + 12) % 12]
      if (name === name.toLowerCase()) {
        ctx.fillStyle = 'rgba(255,255,255,0.03)'
        ctx.fillRect(labelW, yOf(p), plotW, row)
      }
      if (p % 12 === 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.12)'
        ctx.fillRect(labelW, yOf(p) + row, plotW, 1)
        ctx.fillStyle = 'rgba(255,255,255,0.45)'
        ctx.fillText(`${noteName('C')}${p / 12}`, 4, yOf(p) + row / 2)
      }
    }

    for (const n of notes) {
      const x = labelW + plotW - (now - n.t) * pxPerSec
      const len = Math.max(3, n.seconds * pxPerSec)
      if (x + len < labelW) continue
      ctx.fillStyle = channelColor(n.channel, 0.15 + 0.85 * (n.velocity / 15))
      ctx.fillRect(Math.max(labelW, x), yOf(n.pitch) + 1, len, Math.max(2, row - 2))
    }

    requestAnimationFrame(draw)
  }

  window.addEventListener('resize', resize)
  resize()
  requestAnimationFrame(draw)

  return {
    add ({ channel, octave, note, velocity }, seconds) {
      notes.push({ t: performance.now() / 1000, pitch: pitch({ octave, note }), channel, velocity: velocity ?? 10, seconds })
    }
  }
}
