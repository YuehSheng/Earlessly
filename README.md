# Earlessly 🎵

一個專為音樂學習者設計的網頁應用程式，提供調音、節拍、聽音訓練和鍵盤練習等功能。

## 功能特色

- **調音器 (Tuner)** - 即時音高偵測，精確到音分
- **節拍器 (Metronome)** - 支援標準拍號與複節拍（polyrhythm）
- **聽音訓練 (Ear Training)** - 頻率、和弦、音程識別練習
- **鍵盤 (Keyboard)** - 虛擬鍵盤練習，支援和弦測驗

## 技術棧

- **React 19** - UI 框架
- **TypeScript** - 型別安全
- **Vite** - 建置工具
- **Tailwind CSS** - 樣式系統（CDN 載入）
- **Web Audio API** - 音訊處理核心
- **Lucide React** - 圖標庫

## 快速開始

### 前置需求
- Node.js 16+

### 安裝與執行

1. 複製專案
   ```bash
   git clone https://github.com/YuehSheng/Earlessly.git
   cd Earlessly
   ```

2. 安裝依賴
   ```bash
   npm install
   ```

3. 設定環境變數
   在專案根目錄建立 `.env.local`：
   ```
   GEMINI_API_KEY=your_gemini_api_key
   ```

4. 啟動開發伺服器
   ```bash
   npm run dev
   ```
   打開 http://localhost:3000

## 常用指令

```bash
npm run dev       # 啟動開發伺服器
npm run build     # 建置正式版
npm run preview   # 預覽正式版
```

## 專案結構

```
src/
├── components/          # React 元件
│   ├── Tuner.tsx       # 調音器
│   ├── Metronome.tsx   # 節拍器
│   ├── EarTraining.tsx # 聽音訓練
│   ├── Keyboard.tsx    # 鍵盤練習
│   └── FrequencyTraining.tsx
├── utils/
│   └── audioEngine.ts  # 音訊引擎核心
├── types.ts            # TypeScript 型別定義
├── App.tsx             # 主應用程式
├── index.tsx           # 進入點
└── index.html          # HTML 模板
```

## 核心模組

### Audio Engine (`utils/audioEngine.ts`)

應用程式的音訊核心，主要功能：

- **MetronomeEngine** - Web Audio API 節拍排程（25ms lookahead）
- **PolySynth** - 多聲部合成器（支援 decay 與 sustain 模式）
- **autoCorrelate()** - 自相關演算法音高偵測
- **playNotes()** - 音符播放（同時或琶音）

## 開發協助

如有問題或建議，歡迎開 issue 或提交 PR！

## 授權

MIT
