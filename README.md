# Rebuild Experiments

Infrastructure for running instrumented Ubuntu archive rebuilds with Clang
instead of GCC, to produce data that informs compiler toolchain decisions.

## Structure

```
rebuild-experiments/
├── pipeline/       # Rust CLI — builds packages, records results
│   └── src/
├── viewer/         # Static HTML/JS report viewer
└── .gitignore
```

## Prerequisites

- **Rust** (stable toolchain)
- **sbuild** and **ubuntu-dev-tools**:
  ```
  sudo apt install sbuild ubuntu-dev-tools
  ```
- Your user must be in the `sbuild` group (`sbuild-adduser $USER`).
  No chroot setup is needed — the pipeline uses `--chroot-mode=unshare`
  which creates ephemeral chroots automatically.

## Quick start

```bash
# Build the pipeline
cd pipeline
cargo build --release

# Build three small packages with clang-18 targeting noble
./target/release/rebuild-pipeline build \
    --clang-version 18 \
    --series noble \
    --packages packages-smoke.txt

# Check results
./target/release/rebuild-pipeline status --latest

# Export for the viewer
./target/release/rebuild-pipeline export --output-dir ../viewer/data

# Serve the viewer
cd ../viewer
python3 -m http.server 8000
# Open http://localhost:8000
```

## How it works

1. Each `build` invocation creates a **batch** (auto-named, e.g.
   `clang-18-noble-20260529T163445`).
2. For each package, the pipeline fetches the source from the Ubuntu
   archive with `pull-lp-source` and builds it with `sbuild`.
3. Inside the chroot, a setup script installs the target clang version
   and replaces `/usr/bin/gcc` (and friends) with wrappers that exec
   clang.  A verification step confirms `gcc --version` reports clang
   before the build starts — if it doesn't, the build aborts.
4. Resource usage (wall time, peak RSS) is captured via `/usr/bin/time -v`.
5. Failed builds are scanned for ~40 error patterns (incompatible GCC
   extensions, inline assembly issues, missing builtins, etc.).
6. Everything is stored in a local SQLite database.

## CLI reference

```
rebuild-pipeline build  --clang-version 18 --series noble --packages FILE
                        [--timeout 14400] [-j JOBS] [--run-tests]
rebuild-pipeline list
rebuild-pipeline status [--id ID_OR_NAME | --latest]
rebuild-pipeline export --output-dir DIR [--batch ID_OR_NAME]
```

Use `--help` on any subcommand for details.

## Package list format

One source package name per line.  Blank lines and `#` comments are skipped.

```
hello
coreutils
# skip this one
grep
```
