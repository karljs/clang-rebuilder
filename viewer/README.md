# Rebuild Experiments — Viewer

Static HTML/JS UI for browsing rebuild results.

## Setup

```bash
# Export data from the pipeline
cd ../pipeline
./target/release/rebuild-pipeline export --output-dir ../viewer/data

# Serve
python3 -m http.server 8000 --directory ../viewer
# Open http://localhost:8000
```

## Data layout

```
data/
├── index.json          — batch list with summary stats
├── batches/<id>.json   — per-batch build list and finding summary
├── builds/<id>.json    — per-build metadata and findings
└── logs/<id>.log       — full build log (loaded on demand)
```

## Features

- Batch selector and side-by-side batch comparison
- Sortable, filterable build table with status breakdown
- Error finding categories with drill-down
- Full build logs on demand
