# Rebuild Experiments Report Viewer

A static HTML/JS viewer for rebuild experiment results.

## Setup

1. Export data from the pipeline:
   ```bash
   cd ../pipeline
   ./target/debug/rebuild-pipeline export --output-dir ../viewer/data
   ```

2. Serve the viewer directory with any HTTP server:
   ```bash
   # Python
   python3 -m http.server 8000

   # Node.js
   npx serve .

   # Or use any web server (nginx, Apache, etc.)
   ```

3. Open http://localhost:8000 in your browser.

## Data Structure

The viewer expects data in the following structure:

```
data/
├── index.json            # List of all batches with summary stats
├── batches/
│   └── <batch-id>.json   # Per-batch: builds list + finding summary
├── builds/
│   └── <build-id>.json   # Per-build: metadata + findings array
└── logs/
    └── <build-id>.log    # Full build logs (loaded on demand)
```

## Features

- **Batch selection**: Switch between different build batches
- **Build table**: Sortable, filterable list of all builds
- **Status filtering**: Filter by succeeded/failed/timeout/dep-wait
- **Error findings**: View error categories and detailed findings
- **Build logs**: View full build logs on demand
- **Comparison**: Compare two batches side-by-side to see status changes

## Configuration

Edit `app.js` to change the data directory path:

```javascript
const DATA_BASE_URL = './data';  // Change this if needed
```
