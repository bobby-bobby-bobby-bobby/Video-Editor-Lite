# Video Editor Lite

A minimal, fast, file-based desktop video editor built with **Tauri** (Rust backend) + **React + TypeScript + Vite** frontend.

## Features

- 📁 **Folder import** — recursive media file scanning
- 🗂️ **File browser** — left-panel asset manager with search/filter
- 🎬 **Media grid** — thumbnail grid view; double-click to add to timeline
- 👁️ **Video preview** — plays original or proxy files with scrub bar
- 🎞️ **Timeline** — basic clip placement, trimming, drag-to-move
- ✨ **Effects stack** — per-clip layered effects (brightness, contrast, blur, speed…)
- 💾 **Autosave** — project state saved every 8 s when a file path exists
- 🔄 **Proxy system** — on import, FFmpeg generates low-res proxy for smooth preview
- 📤 **Export** — uses original media (not proxy) via FFmpeg concat pipeline

## Prerequisites

| Tool | Version | Purpose |
|---|---|---|
| [Node.js](https://nodejs.org/) | ≥ 18 | Frontend toolchain |
| [Rust](https://rustup.rs/) | stable | Tauri backend |
| [FFmpeg](https://ffmpeg.org/download.html) | any recent | Proxy generation & export |

### macOS (Homebrew)

```bash
brew install node rust ffmpeg
```

### Ubuntu / Debian

```bash
sudo apt install nodejs npm ffmpeg
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

### Windows

Install [Node.js](https://nodejs.org/), [Rust](https://rustup.rs/), and [FFmpeg](https://ffmpeg.org/download.html) (ensure `ffmpeg`/`ffprobe` are on your `PATH`).

You also need the [WebView2 runtime](https://developer.microsoft.com/microsoft-edge/webview2/) (usually pre-installed on Windows 11).

## Setup & Running

```bash
# 1. Install JS dependencies
npm install

# 2. Generate Tauri icons (only needed for production builds)
#    npx tauri icon path/to/icon.png

# 3. Start the dev server (Vite + Tauri in dev mode)
npm run tauri dev
```

> **Note:** First run will compile the Rust crate which may take a few minutes.

## Build for Production

```bash
npm run tauri build
```

The installer / app bundle will be in `src-tauri/target/release/bundle/`.

## Project Structure

```
Video-Editor-Lite/
├── src/                         # React + TypeScript frontend
│   ├── components/
│   │   ├── FileBrowser/         # Left sidebar: imported assets
│   │   ├── MediaGrid/           # Centre: asset thumbnail grid
│   │   ├── VideoPreview/        # Centre/right: video player
│   │   ├── Timeline/            # Bottom: clip timeline
│   │   ├── EffectsPanel/        # Right sidebar: effects stack
│   │   └── Layout/              # Root layout & menu bar
│   ├── hooks/
│   │   ├── useAutosave.ts       # Periodic project autosave
│   │   └── useKeyboard.ts       # Global keyboard shortcuts
│   ├── store/
│   │   ├── projectStore.ts      # Project metadata & save/load
│   │   ├── mediaStore.ts        # Imported media assets
│   │   ├── timelineStore.ts     # Timeline clips & tracks
│   │   └── effectsStore.ts      # Effects instances & catalogue
│   ├── types/index.ts           # All TypeScript types
│   └── utils/
│       ├── formatTime.ts        # Time & byte formatting helpers
│       └── id.ts                # Unique ID generator
├── src-tauri/                   # Rust / Tauri backend
│   ├── src/
│   │   ├── commands/
│   │   │   ├── media.rs         # scan_folder, get_video_metadata
│   │   │   ├── proxy.rs         # generate_proxy (FFmpeg)
│   │   │   ├── project.rs       # save_project, load_project
│   │   │   └── export.rs        # export_video (FFmpeg concat)
│   │   ├── models/types.rs      # Shared Rust structs
│   │   └── main.rs              # Tauri setup & command registration
│   ├── Cargo.toml
│   └── tauri.conf.json
├── package.json
├── vite.config.ts
└── tsconfig.json
```

## Keyboard Shortcuts

| Key | Action |
|---|---|
| `Ctrl/Cmd + S` | Save project |
| `Delete` / `Backspace` | Remove selected clip |
| `←` / `→` | Nudge playhead ±1 s |

## Architecture Notes

### State Management (Zustand + Immer)
Four orthogonal stores communicate through direct store references (no context or providers needed):
- **projectStore** — metadata, save/load/autosave
- **mediaStore** — asset list, proxy status, import
- **timelineStore** — clips, tracks, playhead
- **effectsStore** — effect instances, catalogue

### Proxy System
When a video asset is imported the frontend immediately calls `generate_proxy` on the Tauri side. The Rust command spawns an `ffmpeg` process that produces a `640px` wide H.264 copy stored in the app data directory (`~/Library/Application Support/com.vel.videoeditorlite/proxies/` on macOS). The asset's `proxyStatus` field tracks `pending → generating → ready | failed`. The VideoPreview component automatically switches to the proxy URL once ready.

### Autosave
`useAutosave` runs a timer every 8 seconds. It only triggers if `isDirty === true` **and** a `filePath` is already set (to avoid popping a Save-As dialog automatically). On startup `App.tsx` calls `loadProject()` which checks `localStorage` for the last saved path.

### Export Pipeline
`export_video` in Rust extracts each clip as a separate trimmed MP4 segment, writes an ffmpeg concat list, then does a final pass to produce the output file. The original (non-proxy) files are always used for export.
Lite Video Editor
