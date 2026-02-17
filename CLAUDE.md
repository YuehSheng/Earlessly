# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 常用指令

```bash
npm install       # 安裝相依套件
npm run dev       # 啟動開發伺服器（http://localhost:3000）
npm run build     # 建置正式版
npm run preview   # 預覽正式版建置結果
```

目前專案**沒有測試框架**，package.json 中無測試相關指令。

## 環境變數

需在專案根目錄建立 `.env.local`：
```
GEMINI_API_KEY=your_key_here
```

Vite 在建置時會將此值注入為 `process.env.API_KEY` 與 `process.env.GEMINI_API_KEY`。

## 架構概觀

**單頁應用程式（SPA）**，以 Tab 切換功能頁面，無路由函式庫。
進入點：`index.html` → `index.tsx` → `App.tsx` → 四個功能元件之一。

**四個 Tab**（定義於 `types.ts` 的 `Tab` 列舉）：Tuner（調音器）、Metronome（節拍器）、EarTraining（聽音訓練）、Keyboard（鍵盤）。

**樣式**：Tailwind CSS 透過 CDN 載入於 `index.html`。自訂色盤（深色主題）與 React 19、Lucide React 的 Import Map 也定義在 `index.html` 中，並非設定檔內。專案無獨立 CSS 檔，所有樣式皆為 Tailwind utility class。

**路徑別名**：`@` 對應專案根目錄，設定於 `vite.config.ts` 及 `tsconfig.json`。

### 音訊引擎（`utils/audioEngine.ts`）

應用程式的核心，主要匯出：

- `getAudioContext()` — 單例 `AudioContext`；進行任何音訊操作前必須先呼叫
- `MetronomeEngine` 類別 — 使用 Web Audio API lookahead 排程（25ms lookahead，100ms 預排）。以一維 `BeatIntensity[]` 陣列（grid）表示拍型，支援標準拍號與複節拍（polyrhythm）
- `PolySynth` 類別 — 鍵盤用多聲部合成器，支援 decay（類鋼琴）與 sustain 兩種模式，以 `Map<number, AudioNode[]>` 追蹤發音中的音符

模組層級函式：
- `autoCorrelate(buffer, sampleRate)` — 自相關演算法音高偵測，靜音或不可靠時回傳 -1
- `getNoteFromFrequency(frequency)` — Hz → `TunerData`（音名、八度、音分偏移）
- `playNotes(midiNotes, duration, type)` — 供聽音訓練播放音符（同時或琶音）
- `generateQuestion(settings)` — 依設定隨機產生 `Question`

### 元件模式

元件以 `useRef` 持有音訊實例（例如 `useRef<MetronomeEngine>(null)`），Web Audio 節點絕不放入 React state。`useEffect` 清理函式負責停止音訊並釋放麥克風串流。

- **Tuner**：以 `requestAnimationFrame` 持續偵測音高
- **Keyboard**：在 `window` 上監聽 `keydown`/`keyup`，將 QWERTY 按鍵（a–z、0–9）對應至 MIDI 音符；和弦測驗最高分存於 `localStorage`

### 型別定義（`types.ts`）

所有共用列舉與介面集中於此：
- `NoteName`、`ChordQuality`、`IntervalQuality` — 音樂領域列舉
- `TunerData`、`MetronomeState`、`EarTrainingSettings`、`Question` — 元件狀態型別
- `BeatIntensity` — MUTE / WEAK / STRONG / POLY_A / POLY_B / POLY_BOTH
