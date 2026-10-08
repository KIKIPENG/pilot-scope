import { format, describe, breakdown, seconds } from './parser.js'
import { createChannels } from './channels.js'
import { createRoll } from './roll.js'
import { createKeyboard } from './keyboard.js'
import { createSynth } from './synth.js'
import { createSettings } from './settings.js'
import { formatCommand, breakdownCommand, describeCommand, hasEnvelope, hasModulation } from './commands.js'
import { defaultSettings, channelLabel } from './presets.js'
import { createOrcaCard } from './orca.js'

const $ = (id) => document.getElementById(id)
const HEX = '0123456789abcdef'

// output:'browser' = 瀏覽器自己模擬發聲;'pilot' = 經 server.js 送給真正的 Pilot
const state = { channel: 0, velocity: 12, length: 4, output: 'browser', outputChosen: false }

const synth = createSynth()

// ── 發聲方式 ──
function setOutput (output, chosen = false) {
  state.output = output
  if (chosen) state.outputChosen = true
  $('out-browser').classList.toggle('active', output === 'browser')
  $('out-pilot').classList.toggle('active', output === 'pilot')
  $('hint').textContent = output === 'pilot'
    ? '沒聲音?確認 Pilot 有開'
    : '瀏覽器模擬 Pilot 的預設音色,聲音近似,不是 Pilot 本身'
}
$('out-browser').addEventListener('click', () => { synth.unlock(); setOutput('browser', true) })
$('out-pilot').addEventListener('click', () => setOutput('pilot', true))

// ── WebSocket(只有在本機用 npm start 時才有 server 可連;斷線自動重連)──
let ws = null
const hasServer = location.protocol === 'http:'
function connect () {
  ws = new WebSocket(`ws://${location.host}/`)
  ws.addEventListener('open', () => {
    setStatus(true)
    if (!state.outputChosen) setOutput('pilot')
  })
  ws.addEventListener('close', () => {
    setStatus(false)
    if (!state.outputChosen) setOutput('browser')
    setTimeout(connect, 1000)
  })
  ws.addEventListener('message', (ev) => {
    const reply = JSON.parse(ev.data)
    $('error').hidden = reply.ok
    if (!reply.ok) $('error').textContent = reply.error
  })
}
function setStatus (on) {
  $('out-pilot').disabled = !on
  $('out-pilot').title = on ? '' : '要在本機用 npm start 開、且連上 server 才能用'
  $('status').textContent = on ? 'Pilot 已連線' : 'Pilot 未連線'
  $('status').className = `status ${on ? 'on' : 'off'}`
}
setOutput('browser')
setStatus(false)
if (hasServer) connect()
else $('status').hidden = true

// ── 各區 ──
const channels = createChannels($('channels'), {
  selected: state.channel,
  onSelect: (c) => {
    state.channel = c
    channels.select(c)
    settings.showChannel(c)
    showVoice(c)
  }
})

const roll = createRoll($('roll'))

const keyboard = createKeyboard($('keyboard'), {
  onPlay: play,
  onOctave: (o) => { $('octave').textContent = o }
})
$('oct-down').addEventListener('click', () => keyboard.setOctave(keyboard.octave - 1))
$('oct-up').addEventListener('click', () => keyboard.setOctave(keyboard.octave + 1))

function bindSlider (name, show) {
  const input = $(name)
  input.value = state[name]
  const update = () => {
    state[name] = Number(input.value)
    $(`${name}-out`).textContent = show(state[name])
  }
  input.addEventListener('input', update)
  update()
}
bindSlider('velocity', (v) => `${HEX[v]}(${v}/15)`)
bindSlider('length', (v) => `${HEX[v]}(約 ${seconds(v).toFixed(2)} 秒)`)

// ── 送出 ──
function send (msg) {
  if (ws?.readyState === WebSocket.OPEN) ws.send(msg)
}

// Pilot 對同一個 channel / 效果器 100ms 內的第二個設定會忽略:
// 拉滑桿時每個項目最多 120ms 送一次,而且最後一個值一定會送到
const throttle = { timers: {}, last: {} }
function sendThrottled (key, msg) {
  clearTimeout(throttle.timers[key])
  const wait = 120 - (performance.now() - (throttle.last[key] ?? -Infinity))
  const go = () => { throttle.last[key] = performance.now(); send(msg) }
  if (wait <= 0) go()
  else throttle.timers[key] = setTimeout(go, wait)
}

// ── 發聲 ──
function play (note, octave) {
  const values = { channel: state.channel, octave, note, velocity: state.velocity, length: state.length }
  const msg = format(values)
  if (state.output === 'pilot') send(msg)
  else synth.play(values)

  const dur = seconds(values.length)
  channels.flash(values, dur)
  roll.add(values, dur)
  orca.note.show(msg, describe(values), breakdown(values))
}

// ── Orca 寫法:發音 / ENV / OSC / 效果器 各一張卡,互不覆蓋 ──
const orca = {
  note: createOrcaCard($('orca'), { title: '發音', hint: '最後彈的音', placeholder: '彈一個音後會出現在這裡' }),
  env: createOrcaCard($('orca'), { title: '包絡 ENV', hint: '選中 channel 目前的包絡', placeholder: '' }),
  osc: createOrcaCard($('orca'), { title: '波形 OSC', hint: '選中 channel 目前的波形', placeholder: '' }),
  fx: createOrcaCard($('orca'), { title: '效果器', hint: '最後調整的效果器', placeholder: '調整效果器後會出現在這裡' })
}

function showCommand (card, cmd) {
  card.show(formatCommand(cmd), describeCommand(cmd), breakdownCommand(cmd))
}

// ENV / OSC 卡片永遠顯示選中 channel 現在的設定,彈這個 channel 聽到的就是它
function showVoice (c) {
  if (hasEnvelope(c)) showCommand(orca.env, { type: 'env', channel: c, ...current.env[c] })
  else orca.env.clear(`channel ${HEX[c]} 是鼓,Pilot 不吃 ENV 設定`)
  const o = current.osc[c]
  showCommand(orca.osc, { type: 'osc', channel: c, wave: o.wave, mod: hasModulation(c) ? o.mod : null })
}

// ── 音色設定 / 效果器 ──
// 兩種發聲方式都套用,切換時聲音才會一致
function command (cmd) {
  const msg = formatCommand(cmd)
  if (state.output === 'pilot') {
    const key = cmd.type === 'fx' ? `fx${cmd.code}` : `${cmd.type}${cmd.channel ?? ''}`
    sendThrottled(key, msg)
  }
  synth.apply(cmd)
  if (cmd.type === 'osc') channels.setLabel(cmd.channel, channelLabel(cmd.channel, cmd.wave))

  if (cmd.type === 'env') showCommand(orca.env, cmd)
  else if (cmd.type === 'osc') showCommand(orca.osc, cmd)
  else if (cmd.type === 'fx') showCommand(orca.fx, cmd)
  else if (cmd.type === 'reset') {
    showVoice(state.channel)
    orca.fx.clear('已重設:效果器全部關閉(wet 0)')
  }
}

let current = defaultSettings()
const settings = createSettings({
  voiceRoot: $('voice'),
  fxRoot: $('effects'),
  settings: current,
  onCommand: command
})
showVoice(state.channel)

$('reset').addEventListener('click', () => {
  current = defaultSettings()
  settings.refresh(current)
  current.osc.forEach((o, i) => channels.setLabel(i, channelLabel(i, o.wave)))
  command({ type: 'reset' })
})
