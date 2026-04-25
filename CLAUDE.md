# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install        # install dependencies
npm run dev        # start dev server at http://localhost:3000 (all hosts bound)
npm run build      # production build
npm run preview    # preview production build
```

There is no linting, type-checking, or test script. TypeScript is checked implicitly by Vite during build.

## Environment Variables

Create `.env.local` in the project root:
```
GEMINI_API_KEY=your_key_here
```

`vite.config.ts` injects this at build time as both `process.env.GEMINI_API_KEY` and `process.env.API_KEY`. `index.tsx` polyfills `window.process = { env: {} }` for runtime access.

## Architecture

Single-page app with tab-based navigation (no router). Entry chain: `index.html` → `index.tsx` → `App.tsx` → one of four tab components.

**Tabs** (defined as `Tab` enum in `types.ts`): `TUNER`, `METRONOME`, `EAR_TRAINING`, `KEYBOARD`. Switching tabs unmounts/remounts the component, which stops audio and releases mic streams via `useEffect` cleanup.

**EarTraining sub-components** rendered based on `EarTrainingSettings.mode`:
- `FrequencyTraining` — EQ curve matching game with SVG Bode plot
- `ScaleTraining` — scale identification quiz
- `RhythmTraining` — tap/dictation rhythm exercises
- `ProgressionTraining` — chord progression identification

### Audio Engine (`utils/audioEngine.ts`)

All Web Audio API logic lives here. Components hold engine instances in `useRef` — never in React state.

**Singleton context:** Call `getAudioContext()` before any audio operation. Includes webkit fallback.

**`MetronomeEngine` class:**
- Uses Web Audio API lookahead scheduling (25 ms lookahead, 100 ms schedule-ahead window)
- Beat grid is a flat `BeatIntensity[]` array; polyrhythm support uses LCM-based grid generation
- `BeatIntensity`: `MUTE | WEAK | STRONG | POLY_A | POLY_B | POLY_BOTH`

**`PolySynth` class:**
- Triangle oscillator with exponential decay envelope
- Tracks active voices in `Map<number, AudioNode[]>` keyed by MIDI number
- Supports `decay` (piano-style) and `sustain` modes

**Module-level functions:**
- `autoCorrelate(buffer, sampleRate, threshold)` — autocorrelation pitch detection; returns -1 for silence/unreliable
- `getNoteFromFrequency(hz)` → `TunerData` (note name, octave, cents offset)
- `playNotes(midiNotes, duration, type)` — simultaneous or arpeggio playback for ear training
- `playScale(rootMidi, intervals[], speed, direction)` — sequential scale playback
- `playChordProgression(progression, rootMidi, tempo)` — plays a full chord progression
- `playRhythmClick(pattern, bpm)` — rhythm dictation playback
- `generateQuestion(settings)` → `Question` — randomized ear training question factory

### Types (`types.ts`)

All shared enums and interfaces:
- **Enums:** `Tab`, `NoteName`, `BeatIntensity`, `ChordQuality`, `IntervalQuality`, `ScaleType`, `RhythmDifficulty`, `RhythmMode`
- **Interfaces:** `TunerData`, `MetronomeState`, `SpeedTrainerSettings`, `EarTrainingSettings`, `Question`, `ProgressionDef`, `RhythmCell`, `RhythmPattern`
- **Constants:** `SCALE_INTERVALS` (object mapping `ScaleType` → interval arrays), `PROGRESSIONS` (array of 12 `ProgressionDef` entries)
- MIDI ↔ frequency formula: `freq = 440 * 2^((midi - 69) / 12)`

### Styling

**No CSS files.** All styles are Tailwind utility classes plus custom CSS defined directly in `index.html`.

`index.html` contains:
- Tailwind CSS via CDN (`cdn.tailwindcss.com`)
- React 19 and Lucide React loaded via importmap from CDN — **not from `node_modules`**
- CSS custom properties for the full theme (colors, component styles, animations)
- `data-theme` attribute on `<html>` drives dark/light mode; stored in `localStorage` as `earlessly-theme`

**CSS variable naming:** `--bg`, `--tx`, `--primary`, `--accent`, `--bd` (border), `--input-bg`, `--gauge-track`, `--kbd-white`, `--kbd-black`. Custom component classes: `.card`, `.card-inner`, `.glass`, `.btn-primary`, `.btn-ghost`, `.chip`, `.label`, `.toggle-track`.

To add new component styles or change the color palette, edit `index.html` — not any config file.

### Key Component Patterns

**Tuner (`components/Tuner.tsx`):**
- Pitch detection runs on 80 ms RAF throttle (not every frame)
- Applies EMA smoothing (α = 0.15) + stability counter (4 identical detections before display update)
- Canvas pitch history capped at 360 points (~6 s buffer); drawn via `useCallback`-memoized function

**Metronome (`components/Metronome.tsx`):**
- Contains inline `AnalogKnob` and `VerticalPicker` custom components
- Speed trainer auto-increments BPM every N bars via `MetronomeEngine` callback

**Keyboard (`components/Keyboard.tsx`):**
- 48 QWERTY-to-MIDI bindings (`KEY_BINDINGS` array); `keydown`/`keyup` listeners on `window`
- Chord quiz high score persisted in `localStorage`

### Deployment

Vite base path is `/Earlessly/` (GitHub Pages). Dev server binds `0.0.0.0` and allows all hosts including ngrok and `yuehsheng.github.io`.
