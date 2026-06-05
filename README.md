# Rebuild Experiments

Runs instrumented Ubuntu archive rebuilds with alternative compilers (Clang or GCC) to produce comparative data for toolchain decisions.

## Layout

```
profiles/   — compiler profiles (TOML)
pipeline/   — Rust CLI: fetches sources, drives sbuild, stores results
viewer/     — static HTML/JS report UI
tests/      — integration tests
```

## Setup

```bash
sudo apt install sbuild ubuntu-dev-tools
sbuild-adduser $USER   # then log out and back in
```

The pipeline uses `--chroot-mode=unshare`, so no persistent chroot setup is needed.

## Usage

```bash
cd pipeline
cargo build --release
BIN=./target/release/rebuild-pipeline

# Run a batch
$BIN build --profile ../profiles/clang-18-noble.toml --packages packages-smoke.txt

# Check progress
$BIN status --latest

# Export for the viewer
$BIN export --output-dir ../viewer/data

# Serve the viewer
python3 -m http.server 8000 --directory ../viewer
```

## Profiles

A profile is a TOML file declaring the compiler and any flag overrides:

```toml
[compiler]
type = "clang"   # "clang" or "gcc"
version = "18"

[target]
series = "noble"

[[flags]]
var = "DEB_CFLAGS_APPEND"
flag = "-gdwarf-4"
reason = "Noble's dwz 0.15 doesn't support DWARF5"
```

Each `[[flags]]` entry includes a `reason` field to track why the workaround exists. Profiles are snapshotted into the database at build time, so results are always tied to the exact configuration used.

| Profile | Description |
|---|---|
| `clang-18-noble.toml` | Clang 18, `-gdwarf-4` (dwz workaround) |
| `clang-18-noble-vanilla.toml` | Clang 18, no extra flags |
| `gcc-13-noble.toml` | GCC 13 baseline |

## How it works

For each package in a batch the pipeline:

1. Fetches source from the Ubuntu archive via `pull-lp-source`.
2. Runs `sbuild --chroot-mode=unshare` with the profile's compiler and flags.
3. For Clang profiles: installs the target Clang version inside the ephemeral chroot and replaces `/usr/bin/gcc` (and `g++`, `cpp`) with thin wrapper scripts that exec Clang. A verification step confirms `gcc --version` reports Clang before the build starts.
4. For GCC profiles: uses the stock compiler as-is.
5. Scans failed build logs for ~40 known error patterns (incompatible extensions, inline assembly issues, missing builtins, etc.) and records findings.
6. Stores everything in a local SQLite database.

## CLI

```
rebuild-pipeline build   --profile FILE --packages FILE
                         [--timeout SECS] [-j JOBS] [--run-tests]
rebuild-pipeline list
rebuild-pipeline status  [--id ID_OR_NAME | --latest]
rebuild-pipeline export  --output-dir DIR [--batch ID_OR_NAME]
```

## Package list format

One source package name per line; blank lines and `#` comments are ignored.
