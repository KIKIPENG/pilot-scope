// 桌面 app:在 app 裡啟動同一個 server.js(隨機 port),再用視窗打開它。
// 這樣「送到 Pilot」和「瀏覽器發聲」都跟 npm start 時一模一樣。
import { app, BrowserWindow, shell, dialog } from 'electron'
import { startServer } from '../server.js'

let server

async function open () {
  try {
    server = await startServer({ port: 0 })
  } catch (err) {
    dialog.showErrorBox('pilot-scope 開不起來', String(err?.message ?? err))
    app.quit()
    return
  }

  const win = new BrowserWindow({
    width: 1100,
    height: 900,
    minWidth: 480,
    minHeight: 500,
    title: 'pilot-scope',
    backgroundColor: '#000000',
    autoHideMenuBar: true
  })

  // 外部連結用系統瀏覽器開,不要在 app 視窗裡跳走
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  win.loadURL(`http://127.0.0.1:${server.port}/`)
}

app.whenReady().then(open)

// 關掉視窗就結束(Mac 也一樣),對不熟電腦的人比較直覺
app.on('window-all-closed', () => app.quit())

app.on('will-quit', () => { server?.close() })
