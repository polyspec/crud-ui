//! bench-rust — in-process throughput benchmark for validator-rust.
//!
//! Mirrors bench-js.js / bench-php.php / bench-go: parse the spec once via the
//! same `parse_spec` the CLI uses, build the `Validator` once per spec, then
//! loop `validate(input)` N times. Process startup, spec parse, and fixture I/O
//! all happen BEFORE timing — the measured window is validate-only.
//!
//! stdout: one JSON line per spec (same shape as the other drivers).
//!
//! Build/run with `cargo run --release` (debug codegen would mismeasure).
//! Args: --iters N, --warmup N, --spec NAME, --fixtures DIR. The counts follow
//! the rule of ../arguments.js.

#![allow(
    clippy::disallowed_methods,
    reason = "R-1 holds the library paths of the crudui cores; this program reads its requests with their documented defaults"
)]

use polyspec_crud_ui_validator::validate::Validator;
use serde_json::Value;
use std::fs;
use std::path::Path;
use std::time::Instant;

struct Report {
    spec: String,
    iters: usize,
    ms: f64,
    ops_sec: i64,
    avg_us: f64,
    valid: bool,
    error: Option<String>,
    field: Option<String>,
}

fn load_fixture(dir: &str, name: &str) -> Result<(Value, Value), String> {
    let spec_path = Path::new(dir).join(format!("{}.spec.json", name));
    let input_path = Path::new(dir).join(format!("{}.input.json", name));
    let read = |path: &Path| -> Result<Value, String> {
        let text = fs::read_to_string(path)
            .map_err(|error| format!("read {}: {error}", path.display()))?;
        serde_json::from_str(&text).map_err(|error| format!("parse {}: {error}", path.display()))
    };
    let spec = read(&spec_path)?;
    let input = read(&input_path)?;
    Ok((spec, input))
}

fn bench_spec(dir: &str, name: &str, iters: usize, warmup: usize) -> Result<Report, String> {
    let (spec_value, raw_input) = load_fixture(dir, name)?;
    let validator_input = raw_input;

    // Build the validator once; reuse across iterations.
    let properties = spec_value
        .get("properties")
        .and_then(Value::as_object)
        .cloned()
        .unwrap_or_default();
    let v = Validator::new(properties).expect("declared specification");

    // Warmup.
    for _ in 0..warmup {
        std::hint::black_box(v.validate(&validator_input).is_ok());
    }

    let start = Instant::now();
    for _ in 0..iters {
        std::hint::black_box(v.validate(&validator_input).is_ok());
    }
    let elapsed = start.elapsed();

    let ns = elapsed.as_nanos() as f64;
    let ms = ns / 1e6;
    let ops_sec = ((iters as f64 / ns) * 1e9) as i64;
    let avg_us = ns / 1000.0 / iters as f64;

    let result = v.validate(&validator_input).expect("validation");
    let (error, field) = if !result.valid && !result.errors.is_empty() {
        (
            Some(result.errors[0].rule.clone()),
            Some(result.errors[0].field.clone()),
        )
    } else {
        (None, None)
    };

    Ok(Report {
        spec: name.to_string(),
        iters,
        ms: (ms * 1000.0).round() / 1000.0,
        ops_sec,
        avg_us: (avg_us * 10000.0).round() / 10000.0,
        valid: result.valid,
        error,
        field,
    })
}

fn json_opt(v: &Option<String>) -> String {
    match v {
        Some(s) => format!("{:?}", s),
        None => "null".to_string(),
    }
}

const MAX_COUNT: usize = 10_000_000;

/// The count a flag names, or the exit with the shared message (../arguments.js).
fn count_argument(flag: &str, value: Option<&String>) -> usize {
    let minimum = if flag == "--iters" { 1 } else { 0 };
    let count = value
        .filter(|text| (1..=8).contains(&text.len()) && text.bytes().all(|b| b.is_ascii_digit()))
        // Eight ASCII digits at most always parse as usize (the filter above guarantees it).
        .map(|text| {
            text.parse::<usize>()
                .expect("up to eight ASCII digits parse as usize")
        })
        .filter(|n| (minimum..=MAX_COUNT).contains(n));
    match count {
        Some(n) => n,
        None => {
            eprintln!("{flag} must be a whole number from {minimum} to {MAX_COUNT}");
            std::process::exit(2);
        }
    }
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let mut iters = 50000usize;
    let mut warmup = 5000usize;
    let mut spec: Option<String> = None;
    let mut fixtures = "../fixtures".to_string();
    let mut i = 1;
    while i < args.len() {
        match args[i].as_str() {
            "--iters" => {
                iters = count_argument("--iters", args.get(i + 1));
                i += 1;
            }
            "--warmup" => {
                warmup = count_argument("--warmup", args.get(i + 1));
                i += 1;
            }
            "--spec" => {
                spec = Some(args[i + 1].clone());
                i += 1;
            }
            "--fixtures" => {
                fixtures = args[i + 1].clone();
                i += 1;
            }
            _ => {}
        }
        i += 1;
    }

    let specs: Vec<String> = match spec {
        Some(s) => vec![s],
        None => vec!["contact".to_string(), "large".to_string()],
    };

    for name in &specs {
        let r = match bench_spec(&fixtures, name, iters, warmup) {
            Ok(r) => r,
            // A missing or unparsable fixture stops the bench, as it did before the error was returned.
            Err(message) => panic!("{message}"),
        };
        println!(
            "{{\"lang\":\"rust\",\"spec\":{:?},\"iters\":{},\"ms\":{},\"opsSec\":{},\"avgUs\":{},\"valid\":{},\"error\":{},\"field\":{}}}",
            r.spec,
            r.iters,
            r.ms,
            r.ops_sec,
            r.avg_us,
            r.valid,
            json_opt(&r.error),
            json_opt(&r.field)
        );
    }
}
