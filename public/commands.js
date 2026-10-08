// Pilot 的設定指令:ENV(包絡)、OSC(波形)、效果器、reset。
// 格式對照 Pilot 的 interface.channel.js / interface.effect.js / mixer.js。
// 音符的格式在 parser.js;parseCommand / formatCommand 兩種都處理。
import { CHANNELS, parse as parseNote, format as formatNote, breakdown as breakdownNote, describe as describeNote } from './parser.js'

const HEX = CHANNELS

// 波形代碼,順序同 Pilot 的 WAVCODES / WAVNAMES
export const WAVES = [
  ['si', 'sine'], ['tr', 'triangle'], ['sq', 'square'], ['sw', 'sawtooth'],
  ['2i', 'sine2'], ['2r', 'triangle2'], ['2q', 'square2'], ['2w', 'sawtooth2'],
  ['4i', 'sine4'], ['4r', 'triangle4'], ['4q', 'square4'], ['4w', 'sawtooth4'],
  ['8i', 'sine8'], ['8r', 'triangle8'], ['8q', 'square8'], ['8w', 'sawtooth8']
].map(([code, name]) => ({ code, name }))

const WAVE_ZH = { sine: '正弦波', triangle: '三角波', square: '方波', sawtooth: '鋸齒波' }

export function waveName (code) {
  return WAVES.find(w => w.code === code)?.name
}

export function waveText (code) {
  const name = waveName(code)
  const base = name.replace(/\d/, '')
  const n = name.match(/\d/)?.[0]
  return n ? `${WAVE_ZH[base]},疊 ${n} 層泛音` : WAVE_ZH[base]
}

// 12 個效果器(全部 channel 共用)。value 欄 = 第二碼在 Pilot 裡換算成什麼;null = 只有 wet 有作用。
// Pilot README 列的 EQU / COM / VOL / LIM 在 Pilot 程式裡沒有作用(沒有 wet、也不吃數值),所以不列。
export const EFFECTS = [
  { code: 'bit', name: 'Bitcrusher', zh: '位元破壞', value: '位元數 = 值×8/15(1–8),越小越粗糙' },
  { code: 'dis', name: 'Distortion', zh: '失真', value: '失真量' },
  { code: 'wah', name: 'AutoWah', zh: '哇音', value: '掃頻範圍 = 值×6/15 個八度' },
  { code: 'che', name: 'Chebyshev', zh: '諧波失真', value: '階數 = 值×100/15(最多 8)' },
  { code: 'fee', name: 'Feedback', zh: '回授延遲', value: '延遲時間 = 值/15 秒' },
  { code: 'del', name: 'Ping Pong Delay', zh: '乒乓延遲', value: null },
  { code: 'tre', name: 'Tremolo', zh: '顫音', value: '深度', note: 'Pilot 沒有啟動它的週期,可能聽不出變化' },
  { code: 'rev', name: 'Reverb', zh: '殘響', value: '空間大小' },
  { code: 'pha', name: 'Phaser', zh: '相位', value: '掃頻範圍 = 值×3/15 個八度' },
  { code: 'vib', name: 'Vibrato', zh: '抖音', value: '深度' },
  { code: 'cho', name: 'Chorus', zh: '合唱', value: '深度' },
  { code: 'ste', name: 'StereoWidener', zh: '立體聲加寬', value: null }
]
const EFFECT_CODES = EFFECTS.map(e => e.code)

export const ENV_PARTS = [
  { key: 'attack', zh: '起音', hint: '按下後多久到最大聲' },
  { key: 'decay', zh: '衰減', hint: '從最大聲降到延音音量要多久' },
  { key: 'sustain', zh: '延音', hint: '按住時維持的音量' },
  { key: 'release', zh: '釋放', hint: '放開後多久消失' }
]

// Pilot:包絡 = 值/15,夾在 0.01–1
export const envAmount = (v) => Math.min(1, Math.max(0.01, v / 15))

// channel c–f(鼓)Pilot 不吃 ENV;調變波形只有 AM / FM(0–9)有
export const hasEnvelope = (channel) => channel <= 11
export const hasModulation = (channel) => channel <= 9

const isHex = (v) => Number.isInteger(v) && v >= 0 && v <= 15
const hex = (c) => HEX.indexOf(`${c}`.toLowerCase())

export function formatCommand (cmd) {
  switch (cmd?.type) {
    case 'note':
      return formatNote(cmd)
    case 'env': {
      const vals = ENV_PARTS.map(p => cmd[p.key])
      if (!isHex(cmd.channel) || !vals.every(isHex)) throw new RangeError('ENV 的 channel 和四個值都要是 0–15')
      return `${HEX[cmd.channel]}ENV${vals.map(v => HEX[v]).join('')}`
    }
    case 'osc':
      if (!isHex(cmd.channel) || !waveName(cmd.wave) || (cmd.mod != null && !waveName(cmd.mod))) {
        throw new RangeError('OSC 的 channel 或波形不對')
      }
      return `${HEX[cmd.channel]}OSC${cmd.wave}${cmd.mod ?? ''}`
    case 'fx':
      // Pilot 的效果器讀數值時不會轉小寫,所以一定要送小寫
      if (!EFFECT_CODES.includes(cmd.code) || !isHex(cmd.wet) || !isHex(cmd.value)) {
        throw new RangeError('效果器名稱或數值不對')
      }
      return `${cmd.code.toUpperCase()}${HEX[cmd.wet]}${HEX[cmd.value]}`
    case 'reset':
      return 'reset'
    default:
      throw new RangeError('未知指令')
  }
}

export function parseCommand (input) {
  if (typeof input !== 'string') return null
  const s = input.startsWith(';') ? input.slice(1) : input

  if (s.toLowerCase() === 'reset') return { type: 'reset' }

  const fx = s.slice(0, 3).toLowerCase()
  if (s.length === 5 && EFFECT_CODES.includes(fx)) {
    const wet = hex(s[3])
    const value = hex(s[4])
    if (wet < 0 || value < 0) return null
    return { type: 'fx', code: fx, wet, value }
  }

  const channel = hex(s[0])
  const name = s.slice(1, 4).toLowerCase()
  if (channel >= 0 && name === 'env' && s.length === 8) {
    const [attack, decay, sustain, release] = [...s.slice(4)].map(hex)
    if ([attack, decay, sustain, release].some(v => v < 0)) return null
    return { type: 'env', channel, attack, decay, sustain, release }
  }
  if (channel >= 0 && name === 'osc' && (s.length === 6 || s.length === 8)) {
    const wave = s.slice(4, 6).toLowerCase()
    const mod = s.length === 8 ? s.slice(6, 8).toLowerCase() : null
    if (!waveName(wave) || (mod && !waveName(mod))) return null
    return { type: 'osc', channel, wave, mod }
  }

  const note = parseNote(s)
  return note ? { type: 'note', ...note } : null
}

const round2 = (n) => Math.round(n * 100) / 100

// 和 parser.js 的 describe 一樣:括號後面接「· 」不留前面的空格
const joinParts = (parts) => parts.join(' · ').split(') · ').join(')· ')

// 一行白話摘要,給「Orca 寫法」各卡片用
export function describeCommand (cmd) {
  switch (cmd.type) {
    case 'note':
      return describeNote(cmd)
    case 'env':
      return joinParts([
        `channel ${HEX[cmd.channel]}`,
        ...ENV_PARTS.map(p => p.key === 'sustain'
          ? `${p.zh} ${Math.round(envAmount(cmd[p.key]) * 100)}%`
          : `${p.zh} ${round2(envAmount(cmd[p.key]))} 秒`)
      ])
    case 'osc':
      return joinParts([
        `channel ${HEX[cmd.channel]}`,
        `主波形 ${waveText(cmd.wave)}`,
        ...(cmd.mod ? [`調變波形 ${waveText(cmd.mod)}`] : [])
      ])
    case 'fx': {
      const fx = EFFECTS.find(e => e.code === cmd.code)
      const tag = cmd.wet === 0 ? '(關)' : cmd.wet === 15 ? '(全開)' : ''
      return joinParts([
        `${fx.zh} ${fx.name}`,
        `wet ${HEX[cmd.wet]}${tag}`,
        ...(fx.value ? [`數值 ${HEX[cmd.value]}`] : [])
      ])
    }
    case 'reset':
      return '所有 channel 的包絡、波形和效果器回到 Pilot 預設'
  }
}

// 逐位說明,給「Orca 寫法」區塊用
export function breakdownCommand (cmd) {
  const ch = { char: HEX[cmd.channel], label: 'channel', meaning: `第 ${HEX[cmd.channel]} 號樂器` }
  switch (cmd.type) {
    case 'note':
      return breakdownNote(cmd)
    case 'env':
      return [
        ch,
        { char: 'ENV', label: '指令', meaning: '設定包絡(聲音怎麼出現、怎麼消失)' },
        ...ENV_PARTS.map(p => ({
          char: HEX[cmd[p.key]],
          label: p.zh,
          meaning: p.key === 'sustain'
            ? `${p.hint}:最大聲的 ${Math.round(envAmount(cmd[p.key]) * 100)}%`
            : `${p.hint}:約 ${round2(envAmount(cmd[p.key]))} 秒`
        }))
      ]
    case 'osc':
      return [
        ch,
        { char: 'OSC', label: '指令', meaning: '設定波形(音色的質感)' },
        { char: cmd.wave, label: '主波形', meaning: waveText(cmd.wave) },
        ...(cmd.mod ? [{ char: cmd.mod, label: '調變波形', meaning: `${waveText(cmd.mod)}(只有 AM / FM channel 0–9 有作用)` }] : [])
      ]
    case 'fx': {
      const fx = EFFECTS.find(e => e.code === cmd.code)
      return [
        { char: cmd.code.toUpperCase(), label: '效果器', meaning: `${fx.zh}(${fx.name}),全部 channel 共用` },
        { char: HEX[cmd.wet], label: 'wet', meaning: `效果比例 ${cmd.wet}/15${cmd.wet === 0 ? ',等於關掉' : ''}` },
        { char: HEX[cmd.value], label: '數值', meaning: fx.value ? `${fx.value}:${cmd.value}/15` : '這個效果器不吃數值,只看 wet' }
      ]
    }
    case 'reset':
      return [{ char: 'reset', label: '指令', meaning: '所有 channel 的包絡、波形和效果器回到 Pilot 預設' }]
  }
}
