// Pilot 音符訊息:channel · 八度 · 音名 · [力度] · [音長]
// 格式對照 Pilot 的 sources/scripts/interface.channel.js

export const CHANNELS = '0123456789abcdef'
const HEX = CHANNELS

// 一個八度內的 12 個音,由低到高。大寫 = 自然音,小寫 = 升記號。
export const NOTES = ['C', 'c', 'D', 'd', 'E', 'F', 'f', 'G', 'g', 'A', 'a', 'B']

const SOLFEGE = { C: 'Do', D: 'Re', E: 'Mi', F: 'Fa', G: 'Sol', A: 'La', B: 'Si' }

const isNatural = (note) => note === note.toUpperCase()

export function noteName (note) {
  return isNatural(note) ? note : `${note.toUpperCase()}#`
}

export function solfege (note) {
  return isNatural(note) ? SOLFEGE[note] : `升 ${SOLFEGE[note.toUpperCase()]}`
}

// 0–107 的音高編號,給 piano roll 當縱軸用
export function pitch ({ octave, note }) {
  return octave * 12 + NOTES.indexOf(note)
}

// Pilot:音長 = 值/15 秒,再夾在 0.1–0.9;省略時 0.1
export function seconds (length) {
  if (length == null) return 0.1
  return Math.min(0.9, Math.max(0.1, length / 15))
}

const isInt = (v, min, max) => Number.isInteger(v) && v >= min && v <= max
const present = (v) => v !== null && v !== undefined

export function format ({ channel, octave, note, velocity = null, length = null }) {
  if (!isInt(channel, 0, 15)) throw new RangeError(`channel 必須是 0–15,收到 ${channel}`)
  if (!isInt(octave, 0, 8)) throw new RangeError(`八度必須是 0–8,收到 ${octave}`)
  if (!NOTES.includes(note)) throw new RangeError(`未知音名 ${note}`)
  if (present(velocity) && !isInt(velocity, 0, 15)) throw new RangeError(`力度必須是 0–15,收到 ${velocity}`)
  if (present(length) && !isInt(length, 0, 15)) throw new RangeError(`音長必須是 0–15,收到 ${length}`)
  if (present(length) && !present(velocity)) throw new RangeError('有音長時必須也有力度')

  let out = `${HEX[channel]}${octave}${note}`
  if (present(velocity)) out += HEX[velocity]
  if (present(length)) out += HEX[length]
  return out
}

export function parse (input) {
  if (typeof input !== 'string') return null
  const s = input.startsWith(';') ? input.slice(1) : input
  if (s.length < 3 || s.length > 5) return null

  const channel = HEX.indexOf(s[0].toLowerCase())
  const octave = '012345678'.indexOf(s[1])
  const note = s[2]
  if (channel < 0 || octave < 0 || !NOTES.includes(note)) return null

  const velocity = s.length >= 4 ? HEX.indexOf(s[3].toLowerCase()) : null
  const length = s.length === 5 ? HEX.indexOf(s[4].toLowerCase()) : null
  if (velocity === -1 || length === -1) return null

  return { channel, octave, note, velocity, length }
}

function velocityText (velocity) {
  if (!present(velocity)) return '預設'
  const tag = velocity === 0 ? '(無聲)' : velocity === 15 ? '(最大)' : ''
  return `${HEX[velocity]}${tag}`
}

export function describe ({ channel, octave, note, velocity = null, length = null }) {
  return [
    `channel ${HEX[channel]}`,
    `第 ${octave} 八度`,
    `${noteName(note)}(${solfege(note)})`,
    `力度 ${velocityText(velocity)}`,
    `音長 ${present(length) ? HEX[length] : '預設'}`
  ].join(' · ').split(') · ').join(')· ')
}

const round2 = (n) => Math.round(n * 100) / 100

// 逐位說明,給「Orca 寫法」區塊用
export function breakdown (values) {
  const { channel, octave, note, velocity = null, length = null } = values
  const rows = [
    { char: HEX[channel], label: 'channel', meaning: `第 ${HEX[channel]} 號樂器(音色)` },
    { char: String(octave), label: '八度', meaning: `第 ${octave} 八度,數字越大越高` },
    {
      char: note,
      label: '音名',
      meaning: isNatural(note)
        ? `${note} = ${SOLFEGE[note]}(大寫 = 自然音)`
        : `${noteName(note)} = ${solfege(note)}(小寫 = 升半音)`
    }
  ]
  if (present(velocity)) {
    rows.push({
      char: HEX[velocity],
      label: '力度',
      meaning: `大小聲 ${velocity}/15${velocity === 0 ? ',聽不到' : velocity === 15 ? ',最大聲' : ''}`
    })
  }
  if (present(length)) {
    rows.push({
      char: HEX[length],
      label: '音長',
      meaning: `${length}/15 秒 → 實際約 ${round2(seconds(length))} 秒(Pilot 夾在 0.1–0.9 秒)`
    })
  }
  return rows
}
