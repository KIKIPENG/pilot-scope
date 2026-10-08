# pilot-scope

點一下就發出聲音,用耳朵搞懂 [Pilot](https://github.com/hundredrabbits/Pilot) 的
**channel(音色)/ 音高 / 力度(大小聲)/ 音長**,並看到每個聲音在 Orca 裡怎麼寫。

兩種發聲方式(畫面右上角切換):

- **瀏覽器發聲**:不用裝 Pilot,用 Tone.js(Pilot 內部也是用它)照 Pilot 的預設音色模擬。聲音近似,不是 Pilot 本身。
- **送到 Pilot**:本機跑 `npm start` 時可用,音符經 server 送給真正的 Pilot。連上時會自動切過去。

```
瀏覽器 ──WebSocket──▶ server.js ──UDP 127.0.0.1:49161──▶ Pilot
   └─ 或直接在瀏覽器裡用 Tone.js 發聲
```

## 桌面 app(不用終端機)

到 [Releases](https://github.com/KIKIPENG/pilot-scope/releases/latest) 下載對應的檔案:

| 電腦 | 檔案 |
|---|---|
| Mac(M1 以後,Apple 晶片) | `pilot-scope-0.1.0-mac-arm64.dmg` |
| Mac(Intel) | `pilot-scope-0.1.0-mac-x64.dmg` |
| Windows | `pilot-scope-0.1.0-win.exe` |

不確定是哪一種 Mac:點左上角蘋果選單 →「關於這台 Mac」,寫「晶片 Apple M…」就是 Apple 晶片,寫「處理器 … Intel …」就是 Intel。

**Mac**:打開 `.dmg`,把 pilot-scope 拖進「應用程式」,再從「應用程式」打開。
第一次打開如果跳出「無法驗證開發者」:按「完成」,到「系統設定 → 隱私權與安全性」最下面按「強制打開」,之後就能直接開。

**Windows**:雙擊 `.exe` 就會開(不用安裝,第一次會花幾秒)。
如果跳出藍色的「Windows 已保護您的電腦」:按「其他資訊」→「仍要執行」。

app 裡兩種發聲方式都能用:有開 Pilot 就會自動「送到 Pilot」,沒開就用「瀏覽器發聲」。

自己打包:`npm run dist`(或 `dist:mac` / `dist:win`),檔案會放在 `dist/`;開發時直接開 app:`npm run app`。

## 線上版(只有瀏覽器發聲)

`public/` 是純靜態檔,可以直接放到 Netlify(`netlify.toml` 已設定 publish 目錄)或任何靜態網站空間。
https 的線上版不會去連 server,只用瀏覽器發聲。

## 本機使用(可送到 Pilot)

需要 [Node.js](https://nodejs.org/) 22 以上。先打開 Pilot,然後:

```bash
git clone https://github.com/KIKIPENG/pilot-scope.git
cd pilot-scope
npm install
npm start
```

瀏覽器會自動開 `http://localhost:4000`。

- **channel**:點一格選樂器。發聲時那一格會亮(越亮 = 越大聲)並顯示音名。
- **piano roll**:最近 20 秒彈過的音。越高 = 音越高、顏色 = channel、越淡 = 越小聲、越長 = 音越長。
- **試聽台**:點鋼琴鍵或用電腦鍵盤——`A S D F G H J K` 白鍵、`W E T Y U` 黑鍵、`Z` / `X` 降 / 升八度。
- **Orca 寫法**:分成四張卡,互不覆蓋,都可複製,並逐位說明每一碼的意思:
  - **發音**:最後彈的音(如 `;04Cc4`)
  - **包絡 ENV**、**波形 OSC**:選中 channel 現在的設定(如 `;0ENV0d00`、`;0OSC8isi`),換 channel 會跟著換
  - **效果器**:最後調整的效果器(如 `;REVf8`)

## 音色設定與效果器

- **音色設定**(選中的 channel):包絡 ENV(起音 / 衰減 / 延音 / 釋放)和波形 OSC(主波形、調變波形)。
- **效果器**(全部 channel 共用):BIT、DIS、WAH、CHE、FEE、DEL、TRE、REV、PHA、VIB、CHO、STE,各有 wet(效果比例)和數值。
- **全部重設**:送出 Pilot 的 `reset`,回到預設。

每次調整都會在「Orca 寫法」對應的卡片顯示指令,例如 `;0ENV056f`、`;1OSCsisq`、`;REVf8`。

## Pilot 音符格式

| 位置 | 意義 | 值 |
|---|---|---|
| 1 | channel | `0`–`f` |
| 2 | 八度 | `0`–`8` |
| 3 | 音名 | 大寫 = 自然音 `C D E F G A B`;小寫 = 升記號 `c d f g a` |
| 4(選填) | 力度 | `0`–`f`(值/15);省略時 0.66 |
| 5(選填) | 音長 | `0`–`f`(值/15 秒,夾在 0.1–0.9 秒);省略時 0.1 秒 |

在 Orca 裡前面加 `;`(UDP 運算子)就會送到 Pilot,例如 `;04Cf8`。

## Pilot 設定指令格式

| 指令 | 例子 | 意思 |
|---|---|---|
| ENV | `0ENV056f` | channel 0 的起音 / 衰減 / 延音 / 釋放,各 `0`–`f`(值/15,夾在 0.01–1) |
| OSC | `1OSCsisq` | channel 1 主波形 `si`、調變波形 `sq`(調變波形可省略) |
| 效果器 | `REVf8` | 效果名稱 + wet(`0`–`f`)+ 數值(`0`–`f`),數值一定要小寫 |
| reset | `reset` | 包絡、波形、效果器全部回到預設 |

波形代碼:`si` 正弦、`tr` 三角、`sq` 方波、`sw` 鋸齒;前面加 `2` / `4` / `8`(如 `4i`、`8w`)= 疊幾層泛音。

## 已知行為(不是 bug)

- **ENV 對鼓(channel c–f)沒有作用,調變波形只有 AM / FM(channel 0–9)有。** Pilot 本身就是這樣。
- **Pilot README 列的 EQU / COM / VOL / LIM 沒放進來。** 這四個在 Pilot 程式裡沒有作用(不吃 wet 也不吃數值)。
- **TRE(顫音)可能聽不出變化。** Pilot 沒有啟動它的週期振盪,瀏覽器發聲也照做。
- **WAH、PHA 在 Pilot 的 reset 預設值裡寫成大寫 `0F`,Pilot 會讀錯成 0。** 所以這裡的預設值也是 0。
- **畫面上的設定值只記得在這裡改過的。** 在 Orca 或 Pilot 裡改的,這裡看不到。
- **拉滑桿時同一個項目最多每 120ms 送一次。** Pilot 對同一個 channel / 效果器 100ms 內的第二個設定會忽略,這樣才不會漏掉最後的值。
- **同一個 channel 在 100ms 內連按兩個音,第二個會被 Pilot 忽略。** 這是 Pilot 本身的設計。
- **channel 格子上的音色標示是 Pilot 的預設值**(AM / FM / Mono / 鼓 + 波形)。在 Pilot 裡改過音色的話,標示就不準了。
- **沒聲音不會報錯。** UDP 只管送出,沒辦法知道 Pilot 有沒有在聽,所以「送到 Pilot」模式會一直提醒「確認 Pilot 有開」。
- **瀏覽器發聲只是近似。** 合成器種類、波形、包絡、母帶處理都照 Pilot 的 `mixer.js` 預設,但 Pilot 用的是 Tone.js 13,這裡是 Tone.js 15,細節可能不同。瀏覽器發聲同樣會忽略同 channel 100ms 內的第二個音。

## 設定

| 環境變數 | 預設 | 用途 |
|---|---|---|
| `PORT` | `4000` | 網頁的 port |
| `PILOT_HOST` | `127.0.0.1` | Pilot 所在位址 |
| `PILOT_PORT` | `49161` | Pilot 的 UDP port |
| `NO_OPEN` | — | 設了就不自動開瀏覽器 |

## 開發

```bash
npm test
```

- `public/parser.js`:音符的格式化 / 解析 / 中文說明(前端與測試共用)
- `public/commands.js`:ENV / OSC / 效果器 / reset 指令的格式化 / 解析 / 說明;server 用它驗證所有訊息
- `public/settings.js`:「音色設定」和「效果器」兩區
- `public/orca.js`:「Orca 寫法」的卡片(發音 / ENV / OSC / 效果器各一張)
- `server.js`:靜態檔 + WebSocket → UDP bridge,只轉送合法的音符和設定指令
- `public/presets.js`:Pilot 16 個 channel 的預設音色
- `public/synth.js`:瀏覽器發聲(Tone.js)
- `public/vendor/Tone.js`:Tone.js 15 的打包檔,更新用 `npm run vendor`
- `public/{app,channels,roll,keyboard}.js`:畫面各區
- `electron/main.js`:桌面 app,在 app 裡啟動同一個 server 再開視窗;`build/icon.png` 是 app 圖示
