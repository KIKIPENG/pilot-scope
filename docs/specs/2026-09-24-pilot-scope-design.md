# pilot-scope 設計

日期:2026-09-24 · 狀態:待使用者審閱

## 目的

使用者裝了 Hundred Rabbits 的 UDP 合成器 **Pilot**,但對音樂沒有概念。
pilot-scope 是一個**個人學習 / 探索用**的本機小工具:用點擊發出聲音,
直觀感受 **channel(音色)/ 音高 / 力度(大小聲)/ 音長** 的差別,
並把每個聲音對應到「在 Orca 裡怎麼寫」,讓試聽變成寫 Orca 的能力。

非目標:演出視覺、接收 Orca 的輸出、錄音 / 存檔、調整 Pilot 音色參數(osc/env/效果)、和弦。

## Pilot 訊息格式(已對照 `/Applications/Pilot.app/…/sources/scripts/interface.channel.js` 確認)

UDP 送到 `127.0.0.1:49161`,訊息為 ASCII 字串:

| 位置 | 意義 | 值 |
|---|---|---|
| 1 | channel | `0`–`f`(16 個) |
| 2 | 八度 | `0`–`8` |
| 3 | 音名 | 大寫 = 自然音 `C D E F G A B`;小寫 = 升記號 `c d f g a`(C# D# F# G# A#) |
| 4(選填) | 力度 | `0`–`f`,Pilot 換算為 值/15;省略時預設 0.66 |
| 5(選填) | 音長 | `0`–`f`,換算為 值/15 秒,Pilot 再夾在 0.1–0.9 秒;省略時 0.1 |

- 例:`04Cf8` = channel 0 · 第 4 八度 · C · 力度 f(最大)· 音長 8。
- Orca 寫法 = 前面加 UDP 運算子 `;`,即 `;04Cf8`。
- Pilot 對**同一 channel** 在 100ms 內的第二個音會忽略(UI 不需處理,但 README 註明,以免誤判為 bug)。
- Pilot 預設每個 channel 音色不同(`mixer.js` 的 reset preset,如 0 = sine、1 = sawtooth…),UI 在 channel 格子上以小字標示預設波形,幫助理解「channel = 音色」。使用者若在 Pilot 內改過音色,標示會不準,README 註明。

## 架構

```
瀏覽器畫面 ──WebSocket──▶ server.js(Node)──UDP:49161──▶ Pilot
```

工具只送不收。三個單元:

1. **`public/parser.js`(純函式,前端與測試共用)**
   - `format({channel, octave, note, velocity, length}) → string`
   - `parse(string) → {channel, octave, note, velocity, length} | null`
   - `describe(values) → 中文白話說明`(如「channel 0 · 第 4 八度 · C(Do)· 力度 f(最大)· 音長 8」)
   - 非法值(channel 超出 0–f、八度超出 0–8、未知音名)→ `format` 丟錯、`parse` 回 `null`。
2. **`server.js`(bridge)**
   - 提供 `public/` 靜態檔(預設 `http://localhost:4000`),啟動時自動開瀏覽器。
   - WebSocket 收到字串 → 以 `parser.parse` 驗證 → 合法才用 `dgram` 送 UDP 到 Pilot;不合法回錯誤訊息給網頁。
   - port 被佔用時印出清楚錯誤並結束。
   - Pilot 的 host/port 可用環境變數覆寫(`PILOT_HOST`、`PILOT_PORT`),預設 `127.0.0.1:49161`。
3. **`public/` UI**:`app.js` 組裝;`channels.js`、`roll.js`、`keyboard.js` 各管一區。
   - WebSocket 斷線自動重連,期間畫面顯示「未連線」。

## 畫面

由上到下四區:

1. **16 個 channel 燈號**:點擊選取 channel;發聲時該格亮起(亮度 = 力度)並顯示音名(如 `C4`),小字標預設波形。
2. **piano roll**(`<canvas>`):最近約 20 秒內點過的音,往左捲動;縱軸音高、顏色 = channel、透明度 = 力度、長條長度 = 音長。
3. **試聽台**:八度切換(0–8)、力度滑桿(1–f,最小為 1 避免誤以為沒聲音)、音長滑桿(0–f);兩個八度的鋼琴鍵盤,白鍵標 Do Re Mi…,黑鍵標「升 #」。
   - 電腦鍵盤:`A S D F G H J K` = 白鍵、`W E T Y U` = 黑鍵(對應第一個八度);`Z` / `X` 降 / 升八度。
4. **Orca 寫法**:顯示最後一個音的 `;04Cf8` + 複製按鈕 + 逐位中文說明。

常駐小提示:「沒聲音?確認 Pilot 有開」(UDP 送出不會報錯,無法偵測 Pilot 是否在線)。

## 技術選擇

- Node ≥ 22,純 JavaScript ES modules,無打包步驟。
- 依賴:`ws`、`vitest`(dev)。UDP 用內建 `dgram`,開瀏覽器用 macOS `open`。
- 指令:`npm start`、`npm test`。

```
pilot-scope/
├─ package.json
├─ server.js
├─ public/{index.html, parser.js, app.js, channels.js, roll.js, keyboard.js, style.css}
├─ test/{parser.test.js, server.test.js}
└─ README.md
```

## 測試

- `parser`:TDD。涵蓋 16 個 channel、八度邊界 0/8、升記號大小寫、力度 / 音長邊界與省略、非法值、`format`↔`parse` 來回一致。
- `server`:整合測試——起 server 指向測試用假 UDP 接收端,經 WebSocket 送字串,驗證 UDP 收到內容正確;送非法字串時 UDP 不收到且 WebSocket 回錯誤。
- UI:開發者以瀏覽器實際點擊驗證;最終「聽起來對不對」由使用者開 Pilot 真機試聽確認。
