import { describe, it, expect } from 'vitest'
import { parseCommand, formatCommand, breakdownCommand, describeCommand, WAVES, EFFECTS } from '../public/commands.js'

describe('ENV', () => {
  const env = { type: 'env', channel: 0, attack: 0, decay: 5, sustain: 6, release: 15 }

  it('照 Pilot README 的例子 0ENV056f', () => {
    expect(formatCommand(env)).toBe('0ENV056f')
    expect(parseCommand('0ENV056f')).toEqual(env)
  })

  it('大小寫都接受', () => {
    expect(parseCommand('Benv056F')).toEqual({ ...env, channel: 11 })
  })

  it('非法值', () => {
    expect(parseCommand('0ENV05')).toBeNull()
    expect(parseCommand('0ENV05zf')).toBeNull()
    expect(() => formatCommand({ ...env, release: 16 })).toThrow()
  })
})

describe('OSC', () => {
  it('照 Pilot README 的例子 1OSCsisq', () => {
    const osc = { type: 'osc', channel: 1, wave: 'si', mod: 'sq' }
    expect(formatCommand(osc)).toBe('1OSCsisq')
    expect(parseCommand('1OSCsisq')).toEqual(osc)
  })

  it('只給主波形', () => {
    expect(parseCommand('aOSC4w')).toEqual({ type: 'osc', channel: 10, wave: '4w', mod: null })
    expect(formatCommand({ type: 'osc', channel: 10, wave: '4w', mod: null })).toBe('aOSC4w')
  })

  it('16 種波形都能來回', () => {
    for (const { code } of WAVES) {
      expect(parseCommand(formatCommand({ type: 'osc', channel: 0, wave: code, mod: code })).wave).toBe(code)
    }
  })

  it('未知波形', () => {
    expect(parseCommand('1OSCxx')).toBeNull()
    expect(() => formatCommand({ type: 'osc', channel: 1, wave: 'xx' })).toThrow()
  })
})

describe('效果器', () => {
  it('送出的數值一定是小寫(Pilot 讀效果數值時不轉小寫)', () => {
    expect(formatCommand({ type: 'fx', code: 'bit', wet: 15, value: 10 })).toBe('BITfa')
  })

  it('12 個效果器都能來回', () => {
    for (const { code } of EFFECTS) {
      const fx = { type: 'fx', code, wet: 3, value: 12 }
      expect(parseCommand(formatCommand(fx))).toEqual(fx)
    }
  })

  it('Pilot 沒作用的 EQU / COM / VOL / LIM 擋下', () => {
    for (const s of ['EQUff', 'COMff', 'VOLff', 'LIMff']) expect(parseCommand(s)).toBeNull()
  })

  it('要剛好兩個值', () => {
    expect(parseCommand('BITf')).toBeNull()
    expect(parseCommand('BITzz')).toBeNull()
  })
})

describe('其他', () => {
  it('reset', () => {
    expect(parseCommand('reset')).toEqual({ type: 'reset' })
    expect(formatCommand({ type: 'reset' })).toBe('reset')
  })

  it('音符照樣解析', () => {
    expect(parseCommand(';04Cf8')).toEqual({ type: 'note', channel: 0, octave: 4, note: 'C', velocity: 15, length: 8 })
  })

  it('Pilot 其他指令(bpm、隨機)不接受', () => {
    for (const s of ['bpm120', 'renv', 'rosc', 'refx', '0REN', '0ROS', '']) expect(parseCommand(s)).toBeNull()
  })

  it('逐位說明拼回原字串', () => {
    for (const s of ['0ENV056f', '1OSCsisq', 'aOSC4w', 'REVf8', 'reset', '04Cf8']) {
      expect(breakdownCommand(parseCommand(s)).map(r => r.char).join('')).toBe(s)
    }
  })
})

describe('describeCommand', () => {
  it('ENV 換成秒數和百分比', () => {
    expect(describeCommand(parseCommand('0ENV056f')))
      .toBe('channel 0 · 起音 0.01 秒 · 衰減 0.33 秒 · 延音 40% · 釋放 1 秒')
  })

  it('OSC 換成中文波形名', () => {
    expect(describeCommand(parseCommand('1OSCsisq'))).toBe('channel 1 · 主波形 正弦波 · 調變波形 方波')
    expect(describeCommand(parseCommand('aOSC4w'))).toBe('channel a · 主波形 鋸齒波,疊 4 層泛音')
  })

  it('效果器', () => {
    expect(describeCommand(parseCommand('REVf8'))).toBe('殘響 Reverb · wet f(全開)· 數值 8')
    expect(describeCommand(parseCommand('DEL00'))).toBe('乒乓延遲 Ping Pong Delay · wet 0(關)')
  })

  it('音符沿用 parser 的說明', () => {
    expect(describeCommand(parseCommand('04Cf8'))).toBe('channel 0 · 第 4 八度 · C(Do)· 力度 f(最大)· 音長 8')
  })
})
