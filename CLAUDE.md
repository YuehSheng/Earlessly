# CLAUDE.md

此檔案提供 Claude Code（claude.ai/code）在此專案中運作時所需的指引。

## 常用指令

```bash
npm install        # 安裝相依套件
npm run dev        # 啟動開發伺服器（http://localhost:3000，綁定所有主機）
npm run build      # 建置正式版
npm run preview    # 預覽正式版建置結果
```

專案**無測試、lint 或型別檢查指令**。TypeScript 型別由 Vite 建置時隱式驗證。

## 環境變數

在專案根目錄建立 `.env.local`：
```
GEMINI_API_KEY=your_key_here
```

`vite.config.ts` 在建置時將此值注入為 `process.env.GEMINI_API_KEY` 與 `process.env.API_KEY`。`index.tsx` 以 `window.process = { env: {} }` 提供執行期存取的 polyfill。

## 架構概觀

**單頁應用程式（SPA）**，以 Tab 切換頁面，無路由函式庫。
進入點：`index.html` → `index.tsx` → `App.tsx` → 四個功能元件之一。

**Tab**（定義於 `types.ts` 的 `Tab` 列舉）：`TUNER`、`METRONOME`、`EAR_TRAINING`、`KEYBOARD`。
切換 Tab 會卸載並重新掛載元件，藉由 `useEffect` 清理函式自動停止音訊並釋放麥克風串流。

**EarTraining 子元件**，依 `EarTrainingSettings.mode` 渲染：
- `FrequencyTraining` — EQ 曲線配對遊戲（SVG Bode 圖）
- `ScaleTraining` — 音階辨識測驗
- `RhythmTraining` — 節奏敲擊 / 聽寫練習
- `ProgressionTraining` — 和弦進行辨識
- `PitchMatchingTraining` — 音高匹配測驗（滑桿調整音高後提交計分）

### 音訊引擎（`utils/audioEngine.ts`）

所有 Web Audio API 邏輯集中於此。元件以 `useRef` 持有引擎實例，**絕不放入 React state**。

**單例 Context：** 任何音訊操作前必須先呼叫 `getAudioContext()`，已含 webkit 降級處理。

**`MetronomeEngine` 類別：**
- 使用 Web Audio API lookahead 排程（25 ms lookahead，100 ms 預排視窗）
- 拍型為一維 `BeatIntensity[]` 陣列；複節拍（polyrhythm）以 LCM 計算 grid
- `BeatIntensity`：`MUTE | WEAK | STRONG | POLY_A | POLY_B | POLY_BOTH`

**`PolySynth` 類別：**
- 三角波振盪器 + 指數衰減包絡
- 以 `Map<number, AudioNode[]>`（key 為 MIDI 音符編號）追蹤發音中的音符
- 支援 `decay`（類鋼琴）與 `sustain` 兩種模式

**模組層級函式：**
- `autoCorrelate(buffer, sampleRate, threshold)` — 自相關音高偵測；靜音或不可靠時回傳 -1
- `getNoteFromFrequency(hz)` → `TunerData`（音名、八度、音分偏移）
- `playNotes(midiNotes, duration, type)` — 同時或琶音播放（供聽音訓練使用）
- `playScale(rootMidi, intervals[], speed, direction)` — 依序播放音階
- `playChordProgression(progression, rootMidi, tempo)` — 播放完整和弦進行
- `playRhythmClick(pattern, bpm)` — 節奏聽寫播放
- `generateQuestion(settings)` → `Question` — 依設定隨機產生題目

### 型別定義（`types.ts`）

所有共用列舉與介面：
- **列舉：** `Tab`、`NoteName`、`BeatIntensity`、`ChordQuality`、`IntervalQuality`、`ScaleType`、`RhythmDifficulty`、`RhythmMode`
- **介面：** `TunerData`、`MetronomeState`、`SpeedTrainerSettings`、`EarTrainingSettings`、`Question`、`ProgressionDef`、`RhythmCell`、`RhythmPattern`
- **常數：** `SCALE_INTERVALS`（`ScaleType` → 音程陣列的對應）、`PROGRESSIONS`（12 個 `ProgressionDef` 組成的陣列）
- MIDI ↔ 頻率公式：`freq = 440 * 2^((midi - 69) / 12)`

### 樣式系統

**無獨立 CSS 檔。** 所有樣式皆為 Tailwind utility class，加上直接定義在 `index.html` 中的自訂 CSS。

`index.html` 包含：
- Tailwind CSS（CDN，`cdn.tailwindcss.com`）
- React 19 與 Lucide React 透過 importmap 從 CDN 載入 — **非來自 `node_modules`**
- 完整主題的 CSS 自訂屬性（顏色、元件樣式、動畫）
- `<html>` 上的 `data-theme` 屬性驅動深色/淺色模式；以 `earlessly-theme` 儲存於 `localStorage`

**CSS 變數命名：** `--bg`、`--tx`、`--primary`、`--accent`、`--bd`（邊框）、`--input-bg`、`--gauge-track`、`--kbd-white`、`--kbd-black`。
自訂元件 class：`.card`、`.card-inner`、`.glass`、`.btn-primary`、`.btn-ghost`、`.chip`、`.label`、`.toggle-track`。

新增元件樣式或修改色盤時，**編輯 `index.html`**，而非其他設定檔。

### 關鍵元件模式

**Tuner（`components/Tuner.tsx`）：**
- 音高偵測以 80 ms RAF throttle 執行（非每幀）
- 套用 EMA 平滑（α = 0.15）+ 穩定計數器（連續 4 次相同才更新顯示）
- Canvas 音高歷史上限 360 點（約 6 秒緩衝）；繪製函式以 `useCallback` 記憶化

**Metronome（`components/Metronome.tsx`）：**
- 檔案內含 `AnalogKnob` 與 `VerticalPicker` 兩個自訂元件
- 速度訓練模式每 N 小節後透過 `MetronomeEngine` callback 自動增加 BPM

**Keyboard（`components/Keyboard.tsx`）：**
- 48 組 QWERTY → MIDI 對應（`KEY_BINDINGS` 陣列）；`keydown`/`keyup` 監聽在 `window` 上
- 和弦測驗最高分存於 `localStorage`

### 部署

Vite base path 為 `/Earlessly/`（GitHub Pages）。開發伺服器綁定 `0.0.0.0`，允許所有主機（含 ngrok 與 `yuehsheng.github.io`）。
