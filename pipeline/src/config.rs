//! Experiment configuration loading

use serde::Deserialize;
use std::path::PathBuf;

#[derive(Debug, Deserialize)]
pub struct ExperimentConfig {
    pub name: String,
    pub clang_version: String,
    pub series: String,
    pub package_filter: PackageFilter,
    pub builder: BuilderConfig,
    pub metrics: Vec<MetricType>,
    pub baseline: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct PackageFilter {
    pub build_depends_any: Vec<String>,
    #[serde(default)]
    pub exclude: Vec<String>,
    #[serde(default)]
    pub include_only: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
#[serde(tag = "backend")]
pub enum BuilderConfig {
    #[serde(rename = "sbuild")]
    Sbuild {
        chroot_setup_script: PathBuf,
        #[serde(default = "default_parallel")]
        parallel: usize,
    },
    #[serde(rename = "launchpad")]
    Launchpad {
        team: String,
        intervention_ppa: String,
        baseline_ppa: Option<String>,
        intervention_dependency: Option<String>,
    },
    #[serde(rename = "external")]
    External {
        log_directory: PathBuf,
        metadata_file: Option<PathBuf>,
    },
}

#[derive(Debug, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum MetricType {
    BuildSuccess,
    BuildDuration,
    BinarySize,
    MemoryUsage,
    DiskUsage,
}

fn default_parallel() -> usize {
    4
}

impl ExperimentConfig {
    pub fn load(path: &std::path::Path) -> anyhow::Result<Self> {
        let content = std::fs::read_to_string(path)?;
        let config: ExperimentConfig = serde_yaml::from_str(&content)?;
        Ok(config)
    }
}
