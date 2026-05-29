//! Log scanning and error categorization

mod patterns;

pub use patterns::{match_pattern, ErrorPattern, CLANG_ERROR_PATTERNS};

/// A finding extracted from a build log
#[derive(Debug, Clone)]
pub struct Finding {
    /// Error category key
    pub category: String,
    /// Human-readable description
    pub description: String,
    /// Log excerpt with context
    pub excerpt: String,
    /// Line number in the log (1-indexed)
    pub line_number: usize,
}

/// Scan a build log and extract error findings
///
/// Returns a list of findings, deduplicated by category (only first occurrence kept)
pub fn scan_log(log: &str) -> Vec<Finding> {
    let lines: Vec<&str> = log.lines().collect();
    let mut findings = Vec::new();
    let mut seen_categories = std::collections::HashSet::new();

    for (idx, line) in lines.iter().enumerate() {
        if let Some(pattern) = match_pattern(line) {
            // Only keep first occurrence of each category
            if seen_categories.insert(pattern.key) {
                let excerpt = extract_context(&lines, idx, 2);
                findings.push(Finding {
                    category: pattern.key.to_string(),
                    description: pattern.description.to_string(),
                    excerpt,
                    line_number: idx + 1,
                });
            }
        }
    }

    findings
}

/// Extract context lines around a given line
fn extract_context(lines: &[&str], line_idx: usize, context: usize) -> String {
    let start = line_idx.saturating_sub(context);
    let end = (line_idx + context + 1).min(lines.len());
    lines[start..end].join("\n")
}

/// Determine build status from log content
///
/// Looks for common success/failure indicators in the log
pub fn infer_status_from_log(log: &str) -> crate::models::BuildStatus {
    // Check for dependency wait indicators
    if log.contains("unsatisfiable build-dependencies")
        || log.contains("build-dependency not installable")
    {
        return crate::models::BuildStatus::DepWait;
    }

    // Check for timeout
    if log.contains("Build killed with signal") || log.contains("Timed out") {
        return crate::models::BuildStatus::Timeout;
    }

    // Check for success indicators (dpkg-buildpackage, sbuild, etc.)
    if log.contains("dpkg-buildpackage: info: binary-only upload")
        || log.contains("Build finished successfully")
        || log.contains("dpkg-deb: building package")
            && !log.contains("error:")
            && !log.contains("FAILED")
    {
        return crate::models::BuildStatus::Succeeded;
    }

    // Default to failed if we can't determine success
    crate::models::BuildStatus::Failed
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_scan_log_finds_errors() {
        let log = r#"
Building package foo
In file included from main.c:1:
fatal error: 'omp.h' file not found
#include <omp.h>
         ^~~~~~~
1 error generated.
make: *** [Makefile:10: main.o] Error 1
"#;
        let findings = scan_log(log);
        assert_eq!(findings.len(), 1);
        assert_eq!(findings[0].category, "OPENMP_NOT_AVAILABLE");
    }

    #[test]
    fn test_scan_log_deduplicates() {
        let log = r#"
error: undefined reference to `foo'
error: undefined reference to `bar'
error: undefined reference to `baz'
"#;
        let findings = scan_log(log);
        // Should only have one finding even though pattern matches 3 times
        assert_eq!(findings.len(), 1);
        assert_eq!(findings[0].category, "LINKER_UNDEFINED_REF");
    }

    #[test]
    fn test_infer_status_depwait() {
        let log = "E: unsatisfiable build-dependencies for package";
        assert_eq!(
            infer_status_from_log(log),
            crate::models::BuildStatus::DepWait
        );
    }

    #[test]
    fn test_infer_status_timeout() {
        let log = "Build killed with signal TERM";
        assert_eq!(
            infer_status_from_log(log),
            crate::models::BuildStatus::Timeout
        );
    }
}
