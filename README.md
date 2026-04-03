# anchovy-edit

A browser-based video editor — trim, arrange, preview, and export clips without uploading anything to a server. All processing runs locally using [ffmpeg.wasm](https://ffmpegwasm.netlify.app/).

---

## Table of contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Architecture overview](#architecture-overview)
- [Local development](#local-development)
- [Docker](#docker)
- [Coolify deployment](#coolify-deployment)
- [Project structure](#project-structure)

---

## Features

| Feature | Description |
|---------|-------------|
| **Single-clip editor** | Upload a video, set in/out trim points on an interactive timeline, and export the trimmed clip. |
| **AI Auto-Edit** | Upload multiple clips and an audio track; the app detects beats and assembles an edit automatically. |
| **Storyboard** | Visual drag-and-drop panel for arranging and trimming clips into a narrative sequence. |
| **Sequence Editor** | Non-linear timeline with nested sequences, ripple trim, clip splitting, and playhead navigation. |
| **100% client-side** | Nothing is ever sent to a server. Files stay in your browser. |

---

## Tech stack

| Layer | Library / Tool |
|-------|---------------|
| UI framework | [React 18](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) |
| Build tool | [Vite 5](https://vitejs.dev/) |
| Styling | [Tailwind CSS 3](https://tailwindcss.com/) |
| Animations | [Framer Motion](https://www.framer.com/motion/) |
| State management | [Zustand](https://zustand-demo.pmnd.rs/) + [Immer](https://immerjs.github.io/immer/) |
| Drag & drop | [@dnd-kit](https://dndkit.com/) |
| Video processing | [@ffmpeg/ffmpeg](https://github.com/ffmpegwasm/ffmpeg.wasm) (WASM, runs in-browser) |
| Container / serve | [nginx](https://nginx.org/) (Alpine) |

---

## Architecture overview

```
src/
├── components/       # React UI components
│   ├── VideoUploader.tsx     – drag-and-drop file picker
│   ├── VideoPreview.tsx      – video player with playhead sync
│   ├── Timeline.tsx          – trim handle timeline for single-clip mode
│   ├── ExportButton.tsx      – triggers ffmpeg encode + download
│   ├── AutoEditPanel.tsx     – multi-clip + audio upload for AI mode
│   ├── ProcessingOverlay.tsx – full-screen progress indicator
│   ├── Storyboard.tsx        – visual clip arrangement panel
│   ├── StoryboardPreview.tsx – stitched playback preview for storyboard
│   ├── SequenceView.tsx      – non-linear sequence / timeline editor
│   └── TrimModal.tsx         – per-clip in/out point modal
├── hooks/
│   ├── useAutoEdit.ts        – beat detection + edit map generation
│   └── useTrim.ts            – trim state helpers
├── store/
│   ├── videoStore.ts         – single-clip & auto-edit state (Zustand)
│   ├── storyboardStore.ts    – storyboard clips (Zustand + Immer)
│   └── sequenceStore.ts      – sequence/timeline state (Zustand + Immer)
└── utils/
    └── sequenceUtils.ts      – pure helpers for sequence calculations
```

**Important browser requirement:** ffmpeg.wasm uses `SharedArrayBuffer`, which requires the page to be served with two security headers:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

Both the Vite dev server (`vite.config.ts`) and the production nginx config (`nginx.conf`) set these headers automatically.

---

## Local development

### Prerequisites

- [Node.js](https://nodejs.org/) ≥ 20
- npm ≥ 10 (ships with Node 20)

### Steps

```bash
# 1. Install dependencies
npm ci

# 2. Start the dev server (http://localhost:5173)
npm run dev

# 3. (Optional) Type-check and lint
npm run build   # tsc + vite build
npm run lint    # ESLint, zero warnings allowed
```

The dev server hot-reloads on file changes and already sets the required COOP/COEP headers.

---

## Docker

### Build and run locally

```bash
# Build the image
docker build -t anchovy-edit .

# Run on port 3000
docker run -p 3000:80 anchovy-edit
```

Open [http://localhost:3000](http://localhost:3000).

### docker compose

```bash
docker compose up --build
```

This starts the app on [http://localhost:3000](http://localhost:3000) and restarts it automatically unless explicitly stopped.

### What the image does

1. **Builder stage** – Uses `node:20-alpine` to run `npm ci && npm run build`, producing optimized static files in `/app/dist`.
2. **Runner stage** – Copies the static files into `nginx:1.27-alpine` and applies `nginx.conf`, which:
   - Sets the mandatory `Cross-Origin-Opener-Policy` and `Cross-Origin-Embedder-Policy` headers.
   - Falls back to `index.html` for any unknown path (SPA routing).
   - Enables gzip compression.
   - Caches JS/CSS/WASM assets with a 1-year `immutable` header.

Final image size is ~30 MB.

---

## Coolify deployment

[Coolify](https://coolify.io/) is a self-hosted PaaS that can build and deploy Docker-based applications directly from a Git repository.

### Prerequisites

- A running Coolify instance (v4+).
- The repository accessible to Coolify (GitHub/GitLab/Gitea, or a public URL).

### Step-by-step

1. **Add a new resource** in the Coolify dashboard → **Application**.
2. **Connect your repository** (GitHub App, deploy key, or public clone URL).
3. **Select the branch** you want to deploy (e.g. `main`).
4. Coolify will auto-detect the `Dockerfile`. Confirm **Build Pack → Dockerfile**.
5. Set the **Exposed Port** to `80` (the port nginx listens on inside the container).
6. (Optional) Set a custom domain and enable **Let's Encrypt SSL** in the domain settings.
7. Click **Deploy**. Coolify builds the image, starts the container, and routes traffic to it.

### Environment variables

This application has **no server-side secrets** — all processing is client-side. No environment variables are required for a basic deployment.

### Automatic deployments

In Coolify's repository settings you can enable **webhook-based auto-deploy**: every push to the configured branch triggers a rebuild and zero-downtime redeploy automatically.

### Health check

The `Dockerfile` includes a `HEALTHCHECK` that pings `http://localhost/` every 30 s. Coolify surfaces this status in its dashboard under the resource's **Logs** tab.

---

## Project structure

```
anchovy-edit/
├── src/                  # Application source (React + TypeScript)
├── public/               # Static assets copied verbatim to dist/
├── index.html            # SPA entry point
├── vite.config.ts        # Vite configuration (dev server headers)
├── tailwind.config.js    # Tailwind CSS configuration
├── tsconfig.json         # TypeScript configuration
├── Dockerfile            # Multi-stage Docker build
├── docker-compose.yml    # Local Docker Compose setup
├── nginx.conf            # nginx config for production container
├── package.json
└── README.md
```
