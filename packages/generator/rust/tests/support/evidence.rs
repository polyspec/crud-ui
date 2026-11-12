//! Record the actual result of a generator fixture trial through the shared Rust evidence recorder.

#[path = "../../../../validator/rust/tests/common/mod.rs"]
mod conformance;

use libtest_mimic::Failed;

/// Run one trial, retaining its failure and recording a panic before it resumes.
#[allow(
    dead_code,
    reason = "each test crate of the package uses the recorders that its fixtures need"
)]
pub fn prove(
    feature: &str,
    fixture: &str,
    case: &str,
    run: impl FnOnce() -> Result<(), Failed>,
) -> Result<(), Failed> {
    let mut result = Ok(());
    let _: Vec<String> = conformance::prove_case(feature, fixture, case, || {
        result = run();
        if result.is_err() {
            vec!["fixture trial failed".to_string()]
        } else {
            Vec::new()
        }
    });
    result
}

/// Run one trial of a case that proves several features, and record its result for each of them.
#[allow(
    dead_code,
    reason = "each test crate of the package uses the recorders that its fixtures need"
)]
pub fn prove_all(
    features: &[&str],
    fixture: &str,
    case: &str,
    run: impl FnOnce() -> Result<(), Failed>,
) -> Result<(), Failed> {
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(run));
    let passed = matches!(result, Ok(Ok(())));
    for feature in features {
        conformance::record_conformance(feature, fixture, case, passed);
    }
    match result {
        Ok(result) => result,
        Err(panic) => std::panic::resume_unwind(panic),
    }
}
