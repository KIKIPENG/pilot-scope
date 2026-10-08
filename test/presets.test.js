import { describe, it, expect } from 'vitest'
import { PRESETS, defaultSettings } from '../public/presets.js'

describe('Pilot 預設音色', () => {
  it('16 個 channel', () => {
    expect(PRESETS).toHaveLength(16)
  })

  it('0–5 AM、6–9 FM、a–b Mono、c–f 鼓', () => {
    expect(PRESETS.map(p => p.synth)).toEqual([
      ...Array(6).fill('AMSynth'), ...Array(4).fill('FMSynth'),
      ...Array(2).fill('MonoSynth'), ...Array(4).fill('MembraneSynth')
    ])
  })

  it('波形照 reset 的 OSC 指令', () => {
    expect(PRESETS[0]).toMatchObject({ wave: 'sine8', mod: 'sine' })
    expect(PRESETS[5]).toMatchObject({ wave: 'triangle4', mod: 'sawtooth8' })
    expect(PRESETS[10]).toMatchObject({ wave: 'sawtooth4', mod: null })
    expect(PRESETS[15]).toMatchObject({ wave: 'square', mod: null })
  })

  it('包絡照 reset 公式', () => {
    expect(PRESETS[0].envelope).toEqual({ attack: 0.01, decay: 0.9, sustain: 0.01, release: 0.01 })
    expect(PRESETS[3].envelope).toEqual({ attack: 0.01, decay: 5 / 8, sustain: 0.75, release: 0.5 })
    expect(PRESETS[11].envelope).toEqual({ attack: 0.01, decay: 5 / 8, sustain: 0.75, release: 5 / 6 })
  })

  it('鼓沒有被 reset 改包絡', () => {
    expect(PRESETS.slice(12).every(p => p.envelope === null)).toBe(true)
  })

  it('標籤', () => {
    expect(PRESETS[0].label).toBe('AM · sine8')
    expect(PRESETS[10].label).toBe('Mono · saw4')
    expect(PRESETS[13].label).toBe('鼓 · saw')
  })
})

describe('defaultSettings', () => {
  const d = defaultSettings()

  it('包絡換成 0–15', () => {
    expect(d.env[0]).toEqual({ attack: 0, decay: 13, sustain: 0, release: 0 })
    expect(d.env[11]).toEqual({ attack: 0, decay: 9, sustain: 11, release: 12 })
    expect(d.env[12]).toBeNull()
  })

  it('波形換成代碼', () => {
    expect(d.osc[0]).toEqual({ wave: '8i', mod: 'si' })
    expect(d.osc[10]).toEqual({ wave: '4w', mod: null })
  })

  it('效果器全部 wet 0', () => {
    expect(Object.keys(d.fx)).toHaveLength(12)
    expect(Object.values(d.fx).every(f => f.wet === 0)).toBe(true)
    expect(d.fx.bit.value).toBe(7)
  })

  it('每次都是新物件', () => {
    defaultSettings().osc[0].wave = 'sq'
    expect(defaultSettings().osc[0].wave).toBe('8i')
  })
})
