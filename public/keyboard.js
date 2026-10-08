import { NOTES, solfege } from './parser.js'

// 電腦鍵盤 → 第一個八度的音(K 是下一個八度的 C)
const KEYMAP = {
  a: ['C', 0], w: ['c', 0], s: ['D', 0], e: ['d', 0], d: ['E', 0],
  f: ['F', 0], t: ['f', 0], g: ['G', 0], y: ['g', 0], h: ['A', 0],
  u: ['a', 0], j: ['B', 0], k: ['C', 1]
}
const LETTER_FOR = Object.fromEntries(Object.entries(KEYMAP).map(([k, [n, o]]) => [`${n}${o}`, k.toUpperCase()]))

const isBlack = (note) => note !== note.toUpperCase()

// 兩個八度的鋼琴鍵;octave 超過 8 的鍵停用
export function createKeyboard (root, { onPlay, onOctave }) {
  let base = 4
  const keys = []

  let white = 0 // 目前是第幾個白鍵;每個白鍵佔 2 欄,黑鍵騎在兩個白鍵中間
  for (let o = 0; o < 2; o++) {
    for (const note of NOTES) {
      const key = document.createElement('button')
      key.className = isBlack(note) ? 'key black' : 'key white'
      key.style.gridColumn = isBlack(note) ? `${white * 2} / span 2` : `${white * 2 + 1} / span 2`
      if (!isBlack(note)) white++
      const letter = LETTER_FOR[`${note}${o}`]
      key.innerHTML = `<span class="solfege">${isBlack(note) ? '升 #' : solfege(note)}</span>` +
        (letter ? `<kbd>${letter}</kbd>` : '')
      key.addEventListener('pointerdown', (ev) => {
        ev.preventDefault()
        press(note, o)
      })
      root.appendChild(key)
      keys.push({ key, note, offset: o })
    }
  }

  function keyFor (note, offset) {
    return keys.find(k => k.note === note && k.offset === offset)?.key
  }

  function press (note, offset) {
    const octave = base + offset
    if (octave > 8) return
    const key = keyFor(note, offset)
    key.classList.add('down')
    setTimeout(() => key.classList.remove('down'), 150)
    onPlay(note, octave)
  }

  function setOctave (o) {
    base = Math.min(8, Math.max(0, o))
    for (const { key, offset } of keys) key.disabled = base + offset > 8
    onOctave(base)
  }

  window.addEventListener('keydown', (ev) => {
    if (ev.metaKey || ev.ctrlKey || ev.altKey || ev.repeat) return
    if (ev.target instanceof HTMLInputElement && ev.target.type !== 'range') return
    if (ev.target instanceof HTMLSelectElement) return
    const k = ev.key.toLowerCase()
    if (k === 'z') setOctave(base - 1)
    else if (k === 'x') setOctave(base + 1)
    else if (KEYMAP[k]) press(...KEYMAP[k])
    else return
    ev.preventDefault()
  })

  setOctave(base)
  return { setOctave, get octave () { return base } }
}
