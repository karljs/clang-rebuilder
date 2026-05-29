//! Error pattern definitions for Clang build failures
//!
//! These patterns are used to categorize build failures by root cause.
//! Inspired by Debian's clang.debian.net project.

/// An error pattern definition
pub struct ErrorPattern {
    /// Unique key for this error category
    pub key: &'static str,
    /// Human-readable description
    pub description: &'static str,
    /// Substring patterns to match (any match triggers this category)
    pub patterns: &'static [&'static str],
}

/// All known Clang error patterns, ordered by specificity
/// More specific patterns should come first to avoid false matches
pub static CLANG_ERROR_PATTERNS: &[ErrorPattern] = &[
    // OpenMP issues
    ErrorPattern {
        key: "OPENMP_NOT_AVAILABLE",
        description: "OpenMP header not found (not installed by default with Clang)",
        patterns: &[
            "'omp.h' file not found",
            "Could not find omp.h",
            "missing omp.h",
            "We need OpenMP",
            "know how to enable OpenMP",
            "seem to have a C compiler with OpenMP support installed",
        ],
    },
    // GCC extensions not supported
    ErrorPattern {
        key: "VLA_IN_STRUCT",
        description: "Variable-length array in struct (GCC extension not supported)",
        patterns: &["variable length array in structure"],
    },
    ErrorPattern {
        key: "GLOBAL_REGISTER_VAR",
        description: "Global register variables not supported",
        patterns: &["global register variables are not supported"],
    },
    ErrorPattern {
        key: "NESTED_FUNCTION",
        description: "Nested functions not supported (GCC extension)",
        patterns: &["function definition is not allowed here"],
    },
    // Builtin issues
    ErrorPattern {
        key: "MISSING_BUILTIN",
        description: "Missing GCC builtin function",
        patterns: &["use of undeclared identifier '__builtin_"],
    },
    // Command line option issues
    ErrorPattern {
        key: "UNSUPPORTED_OPTION",
        description: "Compiler option not supported by Clang",
        patterns: &[
            "the clang compiler does not support",
            "unknown argument:",
            "Unknown argument:",
            "unsupported option",
            "error: unsupported argument",
        ],
    },
    ErrorPattern {
        key: "UNKNOWN_WARNING_OPTION",
        description: "Unknown warning option",
        patterns: &["unknown warning option"],
    },
    ErrorPattern {
        key: "IGNORED_OPTIMIZATION",
        description: "Optimization flag not supported",
        patterns: &["ignored-optimization-argument"],
    },
    // Werror issues (must check before generic errors)
    ErrorPattern {
        key: "WERROR_WARNING",
        description: "Build fails due to -Werror on warning",
        patterns: &[
            "-Werror,-W",
            "-Werror,",
            "error: -Werror",
        ],
    },
    // Linker issues
    ErrorPattern {
        key: "LINKER_UNDEFINED_REF",
        description: "Undefined reference at link time",
        patterns: &["undefined reference to"],
    },
    ErrorPattern {
        key: "LINKER_MULTIPLE_DEF",
        description: "Multiple definition at link time",
        patterns: &["multiple definition of"],
    },
    ErrorPattern {
        key: "LINKER_FAILED",
        description: "Linker command failed",
        patterns: &[
            "linker command failed",
            "ld returned 1 exit status",
            "collect2: error: ld",
        ],
    },
    ErrorPattern {
        key: "CANNOT_FIND_LIB",
        description: "Library not found during linking",
        patterns: &["ld: cannot find -l"],
    },
    // C++ specific issues
    ErrorPattern {
        key: "CXX_NO_MATCHING_FUNCTION",
        description: "No matching function for call",
        patterns: &["no matching function for call"],
    },
    ErrorPattern {
        key: "CXX_NO_MATCHING_MEMBER",
        description: "No matching member function or constructor",
        patterns: &[
            "no matching member function for call",
            "no matching constructor",
        ],
    },
    ErrorPattern {
        key: "CXX_PRIVATE_MEMBER",
        description: "Access to private member",
        patterns: &["is a private member of"],
    },
    ErrorPattern {
        key: "CXX_PROTECTED_MEMBER",
        description: "Access to protected member",
        patterns: &["is a protected member of"],
    },
    ErrorPattern {
        key: "CXX_IMPLICIT_INSTANTIATION",
        description: "Implicit instantiation of undefined template",
        patterns: &["implicit instantiation of undefined template"],
    },
    ErrorPattern {
        key: "CXX_DEPENDENT_NAME",
        description: "Use of dependent template name requires 'template' keyword",
        patterns: &["as a dependent template name"],
    },
    ErrorPattern {
        key: "CXX11_REQUIRED",
        description: "C++11 or later required",
        patterns: &[
            "enabled with the -std=c++11",
            "enabled with the -std=gnu++11",
            "C++11 extension",
        ],
    },
    ErrorPattern {
        key: "CXX11_NARROWING",
        description: "C++11 narrowing conversion error",
        patterns: &["Wc++11-narrowing"],
    },
    // Type errors
    ErrorPattern {
        key: "UNKNOWN_TYPE_NAME",
        description: "Unknown type name",
        patterns: &["unknown type name"],
    },
    ErrorPattern {
        key: "CONFLICTING_TYPES",
        description: "Conflicting type declarations",
        patterns: &["error: conflicting types for"],
    },
    ErrorPattern {
        key: "REDEFINITION",
        description: "Redefinition error",
        patterns: &["redefinition of", "macro redefined"],
    },
    ErrorPattern {
        key: "INCOMPLETE_TYPE",
        description: "Incomplete type definition",
        patterns: &["incomplete definition of type"],
    },
    // Declaration/identifier issues
    ErrorPattern {
        key: "UNDECLARED_IDENTIFIER",
        description: "Use of undeclared identifier",
        patterns: &["use of undeclared identifier"],
    },
    ErrorPattern {
        key: "NO_MEMBER_NAMED",
        description: "No member with given name in struct/class",
        patterns: &["no member named"],
    },
    // Build system issues
    ErrorPattern {
        key: "BUILD_SYSTEM_MISDETECT",
        description: "Build system incorrectly detects compiler",
        patterns: &[
            "g++ was not found",
            "gcc >= 3.0 is needed",
            "could not configure a C compiler",
            "clang: not found",
            "clang++: not found",
            "Gcc version error",
            "GCC too old",
        ],
    },
    ErrorPattern {
        key: "CONFIGURE_FAILED",
        description: "Configure script failed",
        patterns: &[
            "compiler cannot create executables",
            "configure: error:",
            "fatal error: 'ac_nonexistent.h' file not found",
        ],
    },
    // Dependency issues
    ErrorPattern {
        key: "DEP_WAIT",
        description: "Build dependencies could not be installed",
        patterns: &[
            "unsatisfiable build-dependencies",
            "build-dependency not installable",
        ],
    },
    ErrorPattern {
        key: "FILE_NOT_FOUND",
        description: "Required file or header not found",
        patterns: &["file not found", "No such file or directory"],
    },
    // Build infrastructure issues
    ErrorPattern {
        key: "BUILD_TIMEOUT",
        description: "Build killed due to timeout",
        patterns: &["Build killed with signal"],
    },
    ErrorPattern {
        key: "SEGFAULT",
        description: "Segmentation fault during build",
        patterns: &["Segmentation fault"],
    },
    ErrorPattern {
        key: "OUT_OF_MEMORY",
        description: "Out of memory during build",
        patterns: &[
            "Cannot allocate memory",
            "out of memory",
            "memory exhausted",
        ],
    },
    // Test failures
    ErrorPattern {
        key: "TESTSUITE_FAILED",
        description: "Test suite failed",
        patterns: &["dh_auto_test:"],
    },
    // Symbol/ABI issues  
    ErrorPattern {
        key: "SYMBOL_CHANGES",
        description: "Library symbol changes detected",
        patterns: &[
            "dh_makeshlibs: dpkg-gensymbols",
            "some new symbols appeared",
            "some symbols or patterns disappeared",
        ],
    },
    // Misc warnings promoted to errors
    ErrorPattern {
        key: "RETURN_TYPE_ERROR",
        description: "Return type issues",
        patterns: &[
            "must return 'int'",
            "should return a value",
            "control may reach end of non-void function",
        ],
    },
    ErrorPattern {
        key: "FORMAT_STRING_ERROR",
        description: "Format string security warning",
        patterns: &[
            "format string is not a string literal",
            "format string discouraged",
        ],
    },
    ErrorPattern {
        key: "UNUSED_ERROR",
        description: "Unused variable/function/parameter error",
        patterns: &[
            "-Wunused-parameter",
            "-Wunused-variable",
            "-Wunused-function",
            "-Wunused-private-field",
        ],
    },
    // Assembly issues
    ErrorPattern {
        key: "ASM_ERROR",
        description: "Assembly code error",
        patterns: &[
            "invalid instruction mnemonic",
            "'asm goto' constructs are not supported",
            ".code16 not supported",
        ],
    },
];

/// Find the first matching error pattern for a log line
pub fn match_pattern(line: &str) -> Option<&'static ErrorPattern> {
    for pattern in CLANG_ERROR_PATTERNS {
        for needle in pattern.patterns {
            if line.contains(needle) {
                return Some(pattern);
            }
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_openmp_detection() {
        let pattern = match_pattern("fatal error: 'omp.h' file not found");
        assert!(pattern.is_some());
        assert_eq!(pattern.unwrap().key, "OPENMP_NOT_AVAILABLE");
    }

    #[test]
    fn test_vla_detection() {
        let pattern = match_pattern("error: variable length array in structure extension");
        assert!(pattern.is_some());
        assert_eq!(pattern.unwrap().key, "VLA_IN_STRUCT");
    }

    #[test]
    fn test_undefined_ref() {
        let pattern = match_pattern("undefined reference to `some_function'");
        assert!(pattern.is_some());
        assert_eq!(pattern.unwrap().key, "LINKER_UNDEFINED_REF");
    }

    #[test]
    fn test_no_match() {
        let pattern = match_pattern("Build succeeded");
        assert!(pattern.is_none());
    }
}
