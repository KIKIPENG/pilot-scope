// Pilot 重置後 16 個 channel 的預設音色,照抄 Pilot 的 mixer.js:
// 合成器種類與參數(install)、波形(reset 的 OSC)、包絡(reset 的 env)。
// 在 Pilot 裡改過音色的話,真正的 Pilot 就不會是這個聲音了。
import { WAVES, EFFECTS } from './commands.js'

const SYNTHS = [
  ['AMSynth', { harmonicity: 1.25 }],
  ['AMSynth', { harmonicity: 1.5 }],
  ['AMSynth', { harmonicity: 1.75 }],
  ['AMSynth', { harmonicity: 2 }],
  ['AMSynth', { harmonicity: 1.25 }],
  ['AMSynth', { harmonicity: 1.5 }],
  ['FMSynth', { harmonicity: 1.75, modulationIndex: 10 }],
  ['FMSynth', { harmonicity: 2, modulationIndex: 20 }],
  ['FMSynth', { harmonicity: 0.5, modulationIndex: 30 }],
  ['FMSynth', { harmonicity: 2.5, modulationIndex: 40 }],
  ['MonoSynth', { volume: -20 }],
  ['MonoSynth', { volume: -20 }],
  ['MembraneSynth', { octaves: 5 }],
  ['MembraneSynth', { octaves: 10 }],
  ['MembraneSynth', { octaves: 15 }],
  ['MembraneSynth', { octaves: 20 }]
]

// reset 的 '0OSC8ISI;1OSC8RSW;…':[主波形, 調變波形]
const OSC = [
  ['sine8', 'sine'], ['triangle8', 'sawtooth'], ['sawtooth8', 'triangle'], ['square8', 'square'],
  ['sine4', 'square8'], ['triangle4', 'sawtooth8'], ['triangle', 'triangle8'], ['triangle', 'sine8'],
  ['triangle', 'sawtooth4'], ['triangle', 'triangle8'], ['sawtooth4', null], ['sine4', null],
  ['sine', null], ['sawtooth', null], ['triangle', null], ['square', null]
]

const KIND = { AMSynth: 'AM', FMSynth: 'FM', MonoSynth: 'Mono', MembraneSynth: '鼓' }

const clamp = (v, min, max) => Math.min(max, Math.max(min, v))

// reset 的包絡公式;Pilot 的 setEnv 對 channel 12 以上(鼓)不作用
function envelope (id) {
  if (id > 11) return null
  return {
    attack: 0.01, // Pilot 寫 0.001,但 setEnv 會夾到最小 0.01
    decay: clamp((8 - (id % 8)) / 8, 0.01, 0.9),
    sustain: clamp((id % 4) / 4, 0.01, 0.9),
    release: clamp((id % 6) / 6, 0.01, 0.9)
  }
}

export const PRESETS = SYNTHS.map(([synth, options], id) => {
  const [wave, mod] = OSC[id]
  return {
    synth,
    options,
    wave,
    mod,
    envelope: envelope(id),
    label: labelFor(synth, wave)
  }
})

function labelFor (synth, wave) {
  return `${KIND[synth]} · ${wave.replace('sawtooth', 'saw')}`
}

// channel 格子上的小字:改了波形就跟著變
export function channelLabel (channel, waveCode) {
  return labelFor(PRESETS[channel].synth, WAVES.find(w => w.code === waveCode).name)
}

const codeOf = (name) => WAVES.find(w => w.name === name).code
const toHex = (v) => Math.floor(v * 15) // 同 Pilot 的 to16

// reset 的效果器指令 'BIT07;DIS00;WAH0F;CHE07;FEE00;TRE07;REV00;PHA0F;VIB01;CHO07':
// wet 全部 0(等於關掉)。WAH0F / PHA0F 的大寫 F 在 Pilot 會讀成 -1,實際效果是 0。
// DEL、STE 不在 reset 裡,維持建立時的 wet 0。
const FX_VALUES = { bit: 7, dis: 0, wah: 0, che: 7, fee: 0, del: 0, tre: 7, rev: 0, pha: 0, vib: 1, cho: 7, ste: 0 }

// 畫面上「音色設定」的初始值(16 進位 0–15),等於 Pilot 剛 reset 完的狀態
export function defaultSettings () {
  return {
    env: PRESETS.map(p => p.envelope && {
      attack: toHex(p.envelope.attack),
      decay: toHex(p.envelope.decay),
      sustain: toHex(p.envelope.sustain),
      release: toHex(p.envelope.release)
    }),
    osc: PRESETS.map(p => ({ wave: codeOf(p.wave), mod: p.mod && codeOf(p.mod) })),
    fx: Object.fromEntries(EFFECTS.map(e => [e.code, { wet: 0, value: FX_VALUES[e.code] }]))
  }
}
