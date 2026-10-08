// 「音色設定」(選中 channel 的 ENV / OSC)與「效果器」(全部 channel 共用)兩區。
// 每次調整都組成一個指令物件交給 onCommand,由 app.js 決定送去哪。
import { CHANNELS } from './parser.js'
import { WAVES, EFFECTS, ENV_PARTS, envAmount, waveText, hasEnvelope, hasModulation } from './commands.js'
import { PRESETS } from './presets.js'

const HEX = CHANNELS
const KIND_ZH = { AMSynth: 'AM 合成', FMSynth: 'FM 合成', MonoSynth: '單音合成', MembraneSynth: '鼓' }

function slider (min, max) {
  const input = document.createElement('input')
  input.type = 'range'
  input.min = min
  input.max = max
  input.step = 1
  return input
}

function waveSelect () {
  const select = document.createElement('select')
  for (const { code } of WAVES) {
    const opt = document.createElement('option')
    opt.value = code
    opt.textContent = `${code} · ${waveText(code)}`
    select.appendChild(opt)
  }
  return select
}

function row (label, hint, control, output) {
  const el = document.createElement('label')
  el.className = 'setting'
  el.innerHTML = `<span class="name">${label}</span>`
  el.appendChild(control)
  if (output) el.appendChild(output)
  if (hint) {
    const h = document.createElement('small')
    h.textContent = hint
    el.appendChild(h)
  }
  return el
}

export function createSettings ({ voiceRoot, fxRoot, settings, onCommand }) {
  let channel = 0

  // ── 音色設定 ──
  const title = document.createElement('p')
  title.className = 'voice-title'
  voiceRoot.appendChild(title)

  const envBox = document.createElement('div')
  envBox.className = 'group'
  envBox.innerHTML = '<h3>包絡 ENV <small>聲音怎麼出現、怎麼消失</small></h3>'
  const envNote = document.createElement('p')
  envNote.className = 'note'
  envNote.textContent = '鼓(channel c–f)Pilot 不吃包絡設定'
  envBox.appendChild(envNote)

  const env = ENV_PARTS.map((part) => {
    const input = slider(0, 15)
    const out = document.createElement('output')
    input.addEventListener('input', () => {
      settings.env[channel][part.key] = Number(input.value)
      showEnvValue(part, input, out)
      onCommand({ type: 'env', channel, ...settings.env[channel] })
    })
    envBox.appendChild(row(part.zh, part.hint, input, out))
    return { part, input, out }
  })

  function showEnvValue (part, input, out) {
    const v = Number(input.value)
    out.textContent = part.key === 'sustain'
      ? `${HEX[v]}(${Math.round(envAmount(v) * 100)}%)`
      : `${HEX[v]}(${envAmount(v).toFixed(2)} 秒)`
  }

  const oscBox = document.createElement('div')
  oscBox.className = 'group'
  oscBox.innerHTML = '<h3>波形 OSC <small>音色的質感</small></h3>'
  const wave = waveSelect()
  const mod = waveSelect()
  const modNote = document.createElement('small')
  oscBox.appendChild(row('主波形', null, wave))
  const modRow = row('調變波形', null, mod)
  modRow.appendChild(modNote)
  oscBox.appendChild(modRow)

  function sendOsc () {
    const o = settings.osc[channel]
    onCommand({ type: 'osc', channel, wave: o.wave, mod: hasModulation(channel) ? o.mod : null })
  }
  wave.addEventListener('change', () => { settings.osc[channel].wave = wave.value; sendOsc() })
  mod.addEventListener('change', () => { settings.osc[channel].mod = mod.value; sendOsc() })

  voiceRoot.append(envBox, oscBox)

  function showChannel (c) {
    channel = c
    const p = PRESETS[c]
    title.textContent = `channel ${HEX[c]} · ${KIND_ZH[p.synth]}`

    const hasEnv = hasEnvelope(c)
    envNote.hidden = hasEnv
    for (const { part, input, out } of env) {
      input.disabled = !hasEnv
      input.value = hasEnv ? settings.env[c][part.key] : 0
      if (hasEnv) showEnvValue(part, input, out)
      else out.textContent = '—'
    }

    const o = settings.osc[c]
    wave.value = o.wave
    mod.disabled = !hasModulation(c)
    mod.value = o.mod ?? 'si'
    modNote.textContent = hasModulation(c)
      ? '用另一個波形去改變主波形,AM / FM 合成才有'
      : '只有 AM / FM 合成(channel 0–9)才有'
  }

  // ── 效果器 ──
  const fxRows = EFFECTS.map((fx) => {
    const box = document.createElement('div')
    box.className = 'fx'
    box.innerHTML = `<h3>${fx.code.toUpperCase()} <span>${fx.zh}</span> <small>${fx.name}</small></h3>`

    const wet = slider(0, 15)
    const wetOut = document.createElement('output')
    box.appendChild(row('wet', '效果比例,0 = 關', wet, wetOut))

    const value = slider(0, 15)
    const valueOut = document.createElement('output')
    if (fx.value) box.appendChild(row('數值', fx.value, value, valueOut))
    else box.insertAdjacentHTML('beforeend', '<p class="note">這個效果器只看 wet</p>')
    if (fx.note) box.insertAdjacentHTML('beforeend', `<p class="note">${fx.note}</p>`)

    const update = () => {
      const s = settings.fx[fx.code]
      s.wet = Number(wet.value)
      s.value = Number(value.value)
      show()
      onCommand({ type: 'fx', code: fx.code, wet: s.wet, value: s.value })
    }
    const show = () => {
      const s = settings.fx[fx.code]
      wet.value = s.wet
      value.value = s.value
      wetOut.textContent = HEX[s.wet]
      valueOut.textContent = HEX[s.value]
      box.classList.toggle('on', s.wet > 0)
    }
    wet.addEventListener('input', update)
    value.addEventListener('input', update)
    fxRoot.appendChild(box)
    return { show }
  })

  function refresh (newSettings) {
    settings = newSettings
    showChannel(channel)
    fxRows.forEach(r => r.show())
  }

  refresh(settings)
  return { showChannel, refresh }
}
