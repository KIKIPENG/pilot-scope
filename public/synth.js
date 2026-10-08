// 在瀏覽器裡模擬 Pilot 發聲。Pilot 內部也是用 Tone.js(vendor/Tone.js,全域 Tone)。
// 合成器、效果器串接順序、各指令的換算都照 Pilot 的 mixer.js / interface.*.js。
import { PRESETS, defaultSettings } from './presets.js'
import { noteName, seconds } from './parser.js'
import { waveName, envAmount, hasEnvelope, hasModulation } from './commands.js'

const clamp = (v, min, max) => Math.min(max, Math.max(min, v))

// 效果器第二碼(0–1)在 Pilot 裡設定到哪個參數
const FX_VALUE = {
  bit: (n, v) => set(n, 'bits', clamp(parseInt(v * 8), 1, 8)),
  dis: (n, v) => set(n, 'distortion', v),
  wah: (n, v) => set(n, 'octaves', clamp(parseInt(v * 6), 0, 8)),
  che: (n, v) => set(n, 'order', clamp(parseInt(v * 100), 1, 8)), // Tone 15 的 order 最小 1
  fee: (n, v) => set(n, 'delayTime', v),
  tre: (n, v) => set(n, 'depth', v),
  rev: (n, v) => set(n, 'roomSize', v),
  pha: (n, v) => set(n, 'octaves', clamp(parseInt(v * 3), 0, 8)),
  vib: (n, v) => set(n, 'depth', v),
  cho: (n, v) => set(n, 'depth', v)
}

// Tone 15 有些參數是 Param(要設 .value),有些是一般數字
function set (node, key, v) {
  const p = node[key]
  if (p && typeof p === 'object' && 'value' in p) p.value = v
  else node[key] = v
}

export function createSynth () {
  const Tone = window.Tone
  let channels = null
  let effects = null
  const lastNote = []
  const pending = [] // 還沒建好合成器前收到的設定,建好後補上

  function build () {
    // 順序同 Pilot:bit → dis → wah → che → fee → del → tre → rev → pha → vib → cho → ste → 母帶
    effects = {
      bit: new Tone.BitCrusher(4),
      dis: new Tone.Distortion(0.05),
      wah: new Tone.AutoWah(100, 6, 0),
      che: new Tone.Chebyshev(50),
      fee: new Tone.FeedbackDelay(0),
      del: new Tone.PingPongDelay('4n', 0.2),
      tre: new Tone.Tremolo(), // Pilot 沒呼叫 start(),這裡也不呼叫
      rev: new Tone.JCReverb(0),
      pha: new Tone.Phaser(0.5, 3, 350),
      vib: new Tone.Vibrato(),
      cho: new Tone.Chorus(4, 2.5, 0.5).start(), // Pilot 用的 Tone 13 會自動 start
      ste: new Tone.StereoWidener(0.5)
    }
    const master = [new Tone.EQ3(5, 0, 5), new Tone.Compressor(-6, 4), new Tone.Volume(6), new Tone.Limiter(-2)]
    Tone.connectSeries(...Object.values(effects), ...master, Tone.getDestination())

    channels = PRESETS.map((p) => new Tone[p.synth](p.options).connect(effects.bit))
    reset()
    pending.splice(0).forEach(apply)
  }

  // 同 Pilot 的 reset:包絡、波形、效果器回到預設
  function reset () {
    PRESETS.forEach((p, i) => {
      const node = channels[i]
      node.oscillator.type = p.wave
      if (p.mod && node.modulation) node.modulation.type = p.mod
      if (p.envelope) node.envelope.set(p.envelope)
    })
    for (const [code, { wet, value }] of Object.entries(defaultSettings().fx)) {
      effects[code].wet.value = wet / 15
      FX_VALUE[code]?.(effects[code], value / 15)
    }
  }

  // 瀏覽器規定要在使用者點擊 / 按鍵當下才能開聲音
  function unlock () {
    if (!channels) build()
    if (Tone.context.state !== 'running') Tone.start()
  }

  // 套用 ENV / OSC / 效果器 / reset 指令(物件格式同 commands.js 的 parseCommand)
  function apply (cmd) {
    if (!channels) { pending.push(cmd); return }
    if (cmd.type === 'env') {
      if (!hasEnvelope(cmd.channel)) return // Pilot 對鼓不作用
      channels[cmd.channel].envelope.set({
        attack: envAmount(cmd.attack),
        decay: envAmount(cmd.decay),
        sustain: envAmount(cmd.sustain),
        release: envAmount(cmd.release)
      })
    } else if (cmd.type === 'osc') {
      const node = channels[cmd.channel]
      node.oscillator.type = waveName(cmd.wave)
      if (cmd.mod && hasModulation(cmd.channel)) node.modulation.type = waveName(cmd.mod)
    } else if (cmd.type === 'fx') {
      const fx = effects[cmd.code]
      fx.wet.value = cmd.wet / 15
      FX_VALUE[cmd.code]?.(fx, cmd.value / 15)
    } else if (cmd.type === 'reset') {
      reset()
    }
  }

  // 回傳 false = 跟 Pilot 一樣,同 channel 100ms 內的第二個音被忽略
  function play ({ channel, octave, note, velocity, length }) {
    unlock()
    const now = performance.now()
    if (lastNote[channel] && now - lastNote[channel] < 100) return false
    lastNote[channel] = now
    channels[channel].triggerAttackRelease(
      `${noteName(note)}${octave}`,
      seconds(length),
      undefined,
      velocity == null ? 0.66 : velocity / 15
    )
    return true
  }

  return { play, apply, unlock }
}
