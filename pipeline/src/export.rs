//! Export module — produces a stripped SQLite database and log files for the viewer.
//!
//! The exported `rebuild.db` contains all batches but with `build_log` columns
//! nulled out, keeping the file small enough for the browser to load via sql.js.
//! Build logs are written separately to `logs/<build-id>.log` and fetched on demand.

use anyhow::{Context, Result};
use sqlx::sqlite::SqlitePoolOptions;
use sqlx::{Row, SqlitePool};
use std::path::Path;
use tokio::fs;
use tracing::info;
use uuid::Uuid;

/// Export data to the output directory.
///
/// Always writes a complete `rebuild.db` containing all batches.  Log files
/// are written to `logs/<build-id>.log`; `batch_filter` controls which batches
/// have their logs written — pass `None` to write logs for all batches.
pub async fn export_data(
    pool: &SqlitePool,
    output_dir: &Path,
    batch_filter: Option<&[Uuid]>,
) -> Result<()> {
    fs::create_dir_all(output_dir).await?;
    fs::create_dir_all(output_dir.join("logs")).await?;

    // Write log files from the live DB before the export copy strips them.
    write_logs(pool, output_dir, batch_filter).await?;

    // Create a clean, compacted copy of the live DB.
    let db_path = output_dir.join("rebuild.db");
    if db_path.exists() {
        fs::remove_file(&db_path).await?;
    }
    let db_path_str = db_path.to_string_lossy();
    sqlx::query(&format!("VACUUM INTO '{db_path_str}'"))
        .execute(pool)
        .await
        .context("Failed to create export database")?;

    // Open the export copy, null out build_log, then compact to reclaim the freed pages.
    let export_pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect(&format!("sqlite:{db_path_str}"))
        .await
        .context("Failed to open export database")?;

    sqlx::query("UPDATE builds SET build_log = NULL")
        .execute(&export_pool)
        .await
        .context("Failed to strip build logs")?;

    sqlx::query("VACUUM")
        .execute(&export_pool)
        .await
        .context("Failed to compact export database")?;

    export_pool.close().await;

    info!(path = %db_path.display(), "Wrote export database");
    Ok(())
}

/// Write per-build log files from the live database.
async fn write_logs(
    pool: &SqlitePool,
    output_dir: &Path,
    batch_filter: Option<&[Uuid]>,
) -> Result<()> {
    let logs_dir = output_dir.join("logs");

    let rows = match batch_filter {
        Some(ids) => {
            let mut all = Vec::new();
            for id in ids {
                let batch_rows = sqlx::query(
                    "SELECT id, build_log FROM builds
                     WHERE batch_id = ? AND build_log IS NOT NULL",
                )
                .bind(id.to_string())
                .fetch_all(pool)
                .await
                .context("Failed to fetch build logs")?;
                all.extend(batch_rows);
            }
            all
        }
        None => sqlx::query("SELECT id, build_log FROM builds WHERE build_log IS NOT NULL")
            .fetch_all(pool)
            .await
            .context("Failed to fetch build logs")?,
    };

    let count = rows.len();
    for row in rows {
        let id: String = row.get("id");
        let log: String = row.get("build_log");
        fs::write(logs_dir.join(format!("{id}.log")), log).await?;
    }
    info!(count, "Wrote log files");
    Ok(())
}
