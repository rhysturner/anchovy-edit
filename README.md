# anchovy-edit
A video edit web app

## Sharp Studio (SHARP + Three.js standalone app)

This repository now includes a standalone local web app at:

- Backend/API: `sharp-studio/backend`
- Frontend page: `sharp-studio/backend/wwwroot/index.html`

### What it does

- Accepts a 2D photo upload from the browser
- Runs Apple [ml-sharp](https://github.com/apple/ml-sharp) reconstruction via `sharp predict`
- Exports a `.ply` model (`latest.ply`) and serves it from `/models/latest.ply`
- Renders SHARP `.ply` splats with `@mkkellogg/gaussian-splats-3d` using a constrained parallax camera effect
- Frontend polls `/api/latest` and auto-refreshes the scene when a newer `.ply` is available

### Prerequisites

1. Install Apple SHARP CLI:

```bash
conda create -n sharp python=3.13
conda activate sharp
pip install -r requirements.txt
sharp --help
```

2. Install .NET 8 SDK

### Run

```bash
cd sharp-studio/backend
dotnet run
```

Open `http://localhost:5000` (or the URL printed by `dotnet run`).

Use the upload field and click **Reconstruct .ply** to trigger the local SHARP pipeline.
