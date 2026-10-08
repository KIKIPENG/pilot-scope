// 「Orca 寫法」的一張卡片:發音 / 包絡 ENV / 波形 OSC / 效果器 各一張,互不覆蓋。
export function createOrcaCard (root, { title, hint, placeholder }) {
  const card = document.createElement('div')
  card.className = 'orca-card'
  card.innerHTML = `
    <h3>${title} <small>${hint}</small></h3>
    <div class="orca-line">
      <code class="orca-code">—</code>
      <button class="copy" disabled>複製</button>
      <span class="copy-msg"></span>
    </div>
    <p class="desc"></p>
    <table class="breakdown"></table>`
  root.appendChild(card)

  const code = card.querySelector('.orca-code')
  const copy = card.querySelector('.copy')
  const copyMsg = card.querySelector('.copy-msg')
  const desc = card.querySelector('.desc')
  const table = card.querySelector('.breakdown')

  copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(code.textContent)
      copyMsg.textContent = '已複製'
    } catch {
      copyMsg.textContent = '複製失敗,請手動選取'
    }
    setTimeout(() => { copyMsg.textContent = '' }, 1500)
  })

  // msg:不含 ; 的指令字串;rows:breakdownCommand 的逐位說明
  function show (msg, summary, rows) {
    card.classList.remove('empty')
    code.textContent = `;${msg}`
    copy.disabled = false
    desc.textContent = summary
    table.innerHTML = rows
      .map(r => `<tr><td><code>${r.char}</code></td><th>${r.label}</th><td>${r.meaning}</td></tr>`)
      .join('')
  }

  // 沒有指令可顯示時(還沒操作過、或這個 channel 不適用)
  function clear (text = placeholder) {
    card.classList.add('empty')
    code.textContent = '—'
    copy.disabled = true
    desc.textContent = text
    table.innerHTML = ''
  }

  clear()
  return { show, clear }
}
