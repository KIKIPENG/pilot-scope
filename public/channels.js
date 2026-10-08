import { CHANNELS, noteName } from './parser.js'
import { PRESETS } from './presets.js'

export const channelColor = (channel, alpha = 1) => `hsla(${channel * 22.5}, 75%, 62%, ${alpha})`

export function createChannels (root, { selected, onSelect }) {
  const cells = [...CHANNELS].map((hex, i) => {
    const cell = document.createElement('button')
    cell.className = 'channel'
    cell.style.setProperty('--color', channelColor(i))
    cell.innerHTML = `<span class="hex">${hex}</span><span class="note"></span><span class="preset">${PRESETS[i].label}</span>`
    cell.addEventListener('click', () => onSelect(i))
    root.appendChild(cell)
    return { cell, note: cell.querySelector('.note'), preset: cell.querySelector('.preset'), timer: null }
  })

  function select (channel) {
    cells.forEach(({ cell }, i) => cell.classList.toggle('selected', i === channel))
  }

  // 亮度 = 力度;亮的時間跟著音長
  function flash ({ channel, octave, note, velocity }, seconds) {
    const c = cells[channel]
    c.note.textContent = `${noteName(note)}${octave}`
    c.cell.style.setProperty('--glow', String(0.25 + 0.75 * ((velocity ?? 10) / 15)))
    c.cell.classList.add('lit')
    clearTimeout(c.timer)
    c.timer = setTimeout(() => c.cell.classList.remove('lit'), Math.max(200, seconds * 1000))
  }

  function setLabel (channel, text) {
    cells[channel].preset.textContent = text
  }

  select(selected)
  return { select, flash, setLabel }
}
