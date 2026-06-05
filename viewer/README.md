# Rebuild Experiments — Viewer

Static HTML/JS UI for browsing rebuild results. Uses [sql.js](https://sql.js.org/) to query a stripped SQLite database directly in the browser.

## Setup

```bash
# Export data from the pipeline
cd ../pipeline
./target/release/rebuild-pipeline export --output-dir ../viewer/data

# Serve
python3 -m http.server 8000 --directory ../viewer
# Open http://localhost:8000
```

The viewer loads `data/rebuild.db` over HTTP and queries it entirely in the browser via WebAssembly. No server-side API is needed.

## Data layout

```
data/
├── rebuild.db          — all batches, builds, and findings (build logs stripped)
└── logs/<id>.log       — one file per build with a non-null log (fetched on demand)
```

The database is produced by `rebuild-pipeline export`. Build logs are stored separately to keep the database file small enough for the browser to load (~2–5 MB per 1000-package batch).

## Features

- Batch selector and side-by-side batch comparison
- Sortable, filterable build table with status breakdown
- Error finding categories with drill-down
- Full build logs on demand
