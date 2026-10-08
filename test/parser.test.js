import { describe as group, it, expect } from 'vitest'
import { format, parse, describe, breakdown, NOTES, CHANNELS } from '../public/parser.js'

const base = { channel: 0, octave: 4, note: 'C', velocity: 15, length: 8 }

group('format', () => {
  it('組出完整五碼', () => {
    expect(format(base)).toBe('04Cf8')
  })

  it('16 個 channel 用 0–f 表示', () => {
    const out = CHANNELS.split('').map((_, i) => format({ ...base, channel: i })[0])
    expect(out.join('')).toBe('0123456789abcdef')
  })

  it('八度邊界 0 與 8', () => {
    expect(format({ ...base, octave: 0 })).toBe('00Cf8')
    expect(format({ ...base, octave: 8 })).toBe('08Cf8')
  })

  it('升記號用小寫音名', () => {
    expect(format({ ...base, note: 'c' })).toBe('04cf8')
    expect(format({ ...base, note: 'a' })).toBe('04af8')
  })

  it('力度 / 音長邊界 0 與 f', () => {
    expect(format({ ...base, velocity: 0, length: 0 })).toBe('04C00')
    expect(format({ ...base, velocity: 15, length: 15 })).toBe('04Cff')
  })

  it('省略音長 → 四碼;省略力度與音長 → 三碼', () => {
    expect(format({ ...base, length: null })).toBe('04Cf')
    expect(format({ channel: 0, octave: 4, note: 'C' })).toBe('04C')
  })

  it('有音長卻沒力度 → 丟錯(位置會錯位)', () => {
    expect(() => format({ ...base, velocity: null })).toThrow()
  })

  it.each([
    ['channel 16', { channel: 16 }],
    ['channel -1', { channel: -1 }],
    ['八度 9', { octave: 9 }],
    ['八度 -1', { octave: -1 }],
    ['八度 小數', { octave: 4.5 }],
    ['未知音名 e(E 沒有升記號)', { note: 'e' }],
    ['未知音名 H', { note: 'H' }],
    ['力度 16', { velocity: 16 }],
    ['音長 16', { length: 16 }]
  ])('非法值丟錯:%s', (_, patch) => {
    expect(() => format({ ...base, ...patch })).toThrow()
  })
})

group('parse', () => {
  it('解析完整五碼', () => {
    expect(parse('04Cf8')).toEqual(base)
  })

  it('channel 與十六進位大小寫都接受,並正規化', () => {
    expect(parse('F4CF8')).toEqual({ ...base, channel: 15 })
    expect(parse('a4Ca0')).toEqual({ ...base, channel: 10, velocity: 10, length: 0 })
  })

  it('音名大小寫有意義:大寫自然音、小寫升記號', () => {
    expect(parse('04c').note).toBe('c')
    expect(parse('04C').note).toBe('C')
  })

  it('省略力度 / 音長 → null', () => {
    expect(parse('04C')).toEqual({ ...base, velocity: null, length: null })
    expect(parse('04C7')).toEqual({ ...base, velocity: 7, length: null })
  })

  it('八度邊界', () => {
    expect(parse('00C').octave).toBe(0)
    expect(parse('08C').octave).toBe(8)
    expect(parse('09C')).toBeNull()
  })

  it.each(['', '0', '04', '04Cf8x', 'g4C', '0xC', '04e', '04H', '04Cg', '04Cfz', ' 04C', 42, null, undefined])(
    '非法字串回 null:%j',
    (s) => { expect(parse(s)).toBeNull() }
  )

  it('容許前面帶 Orca 的 ; 運算子', () => {
    expect(parse(';04Cf8')).toEqual(base)
  })
})

group('format ↔ parse 來回一致', () => {
  it('所有 channel × 八度 × 音名', () => {
    for (let channel = 0; channel < 16; channel++) {
      for (let octave = 0; octave <= 8; octave++) {
        for (const note of NOTES) {
          const v = { channel, octave, note, velocity: (channel + octave) % 16, length: octave }
          expect(parse(format(v))).toEqual(v)
        }
      }
    }
  })

  it('字串 → 值 → 字串', () => {
    for (const s of ['04C', '14c7', 'f8Bff', 'a0a00']) {
      expect(format(parse(s))).toBe(s)
    }
  })
})

group('describe / breakdown', () => {
  it('白話說明', () => {
    expect(describe(base)).toBe('channel 0 · 第 4 八度 · C(Do)· 力度 f(最大)· 音長 8')
  })

  it('升記號與省略值', () => {
    expect(describe({ channel: 10, octave: 3, note: 'f', velocity: null, length: null }))
      .toBe('channel a · 第 3 八度 · F#(升 Fa)· 力度 預設 · 音長 預設')
  })

  it('逐位說明:每一碼一列', () => {
    const rows = breakdown(base)
    expect(rows.map(r => r.char).join('')).toBe('04Cf8')
    expect(rows[0].label).toBe('channel')
    expect(rows[4].meaning).toContain('0.53 秒')
  })

  it('音長換算會夾在 0.1–0.9 秒', () => {
    expect(breakdown({ ...base, length: 0 })[4].meaning).toContain('0.1 秒')
    expect(breakdown({ ...base, length: 15 })[4].meaning).toContain('0.9 秒')
  })
})
