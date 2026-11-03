//! The log (PLAN 3V.8, Razorcat's C1): every line to stderr, as before, and to a file a tester
//! can send, `logs\vandal.log` in local app data, the last few runs kept. What goes in the file
//! is scrubbed (`scrub.rs`): no paths, no file names, nothing that identifies the user. Never
//! pixels or text from a capture. Panics are logged with a backtrace, and native crashes by
//! `crash.rs`.
//!
//! Lines before the file opens (Tauri's setup) are held and written when it does: a second
//! launch hands over to the first before then, so it never touches the first one's log.
//!
//! Settings › About › Debugging can turn it off: then nothing is written to disk, neither the
//! log nor crash dumps (the terminal in dev still gets every line).

use std::fs::{self, File};
use std::io::{Seek, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Mutex, MutexGuard, OnceLock};
use std::time::Instant;

use crate::scrub;

/// Runs whose logs are kept: `vandal.log`, then `vandal.1.log` (the run before) and on.
const KEEP_RUNS: usize = 5;
/// Lines held before the file opens, at most.
const EARLY_MAX: usize = 500;
/// A run's log stops taking ordinary lines here (a runaway error mustn't fill the disk); its
/// start, which usually explains a crash, is kept, and crashes and panics still get in.
const MAX_BYTES: u64 = 10 * 1024 * 1024;
const FULL: &str = "[log] full: further lines dropped (crashes and panics still logged)";

/// Logs a line: `logln!("[editor] {n} marks")`. Name a module in brackets first.
macro_rules! logln {
    ($($arg:tt)*) => {
        $crate::log::line(&format!($($arg)*))
    };
}

struct Log {
    file: Option<File>,
    early: Vec<String>,
    /// Scrubbed from every line: the user's and computer's names, the files opened and
    /// exported.
    names: Vec<String>,
    /// Bytes in this run's file.
    written: u64,
}

static LOG: Mutex<Log> = Mutex::new(Log {
    file: None,
    early: Vec::new(),
    names: Vec::new(),
    written: 0,
});
static START: OnceLock<Instant> = OnceLock::new();
/// Settings › About › Debugging › Keep a log; on until the settings say otherwise.
static ENABLED: AtomicBool = AtomicBool::new(true);
/// What a notification says once the app is up: the last run crashed.
static NOTICE: Mutex<Option<String>> = Mutex::new(None);

const CRASHED: &str = "Vandal closed unexpectedly last time. A report was saved.";
static DIR: OnceLock<PathBuf> = OnceLock::new();

fn lock() -> MutexGuard<'static, Log> {
    LOG.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
}

/// The folder of logs and crash dumps: `%LOCALAPPDATA%\{identifier}\logs`, Tauri's
/// `app_log_dir`, known before the app is built.
pub fn dir() -> Option<&'static Path> {
    DIR.get().map(PathBuf::as_path)
}

/// First thing at startup: the clock, the folder, the names to scrub, the panic hook and the
/// crash handler. The file opens later, in [`open`].
pub fn init(identifier: &str) {
    START.get_or_init(Instant::now);
    if let Ok(local) = std::env::var("LOCALAPPDATA") {
        let _ = DIR.set(Path::new(&local).join(identifier).join("logs"));
    }
    {
        let mut log = lock();
        // The profile's folder can be named otherwise than the user.
        let profile = std::env::var("USERPROFILE")
            .ok()
            .and_then(|p| Some(Path::new(&p).file_name()?.to_string_lossy().into_owned()));
        let names = ["USERNAME", "COMPUTERNAME"]
            .map(|var| std::env::var(var).ok())
            .into_iter()
            .chain([profile])
            .flatten();
        for name in names {
            // Short ones would eat ordinary words.
            if name.chars().count() >= 3 && !log.names.contains(&name) {
                log.names.push(name);
            }
        }
    }
    std::panic::set_hook(Box::new(|info| {
        let thread = std::thread::current();
        let backtrace = std::backtrace::Backtrace::force_capture();
        // `{:#}`: the addresses too, which with the header's exe address and the build's
        // symbols name the functions.
        urgent_line(&format!(
            "[panic] thread {}: {info}\n{backtrace:#}",
            thread.name().unwrap_or("unnamed")
        ));
        match crate::crash::dump(None) {
            Ok(name) => urgent_line(&format!("[panic] dump written: {name}")),
            Err(e) => urgent_line(&format!("[panic] no dump: {e}")),
        }
    }));
    crate::crash::install();
}

/// Opens this run's file (the older ones moved along, the oldest dropped), with a header
/// naming the build, Windows and the time, then the lines held so far.
pub fn open(product: &str) {
    let mut log = lock();
    if log.file.is_some() || !enabled() {
        return;
    }
    let Some(dir) = dir() else { return };
    if let Err(e) = fs::create_dir_all(dir) {
        eprintln!("[log] can't make the logs folder: {e}");
        return;
    }
    rotate(dir);
    if fs::read(dir.join("vandal.1.log")).is_ok_and(|text| crashed(&String::from_utf8_lossy(&text)))
    {
        set_notice(CRASHED);
    }
    crate::crash::prune(dir);
    let mut file = match File::create(dir.join("vandal.log")) {
        Ok(f) => f,
        Err(e) => {
            eprintln!("[log] can't open the log: {e}");
            return;
        }
    };
    // The header and the held lines count towards the cap.
    let header = crate::crash::header(product);
    let _ = writeln!(file, "{header}");
    let mut written = header.len() as u64 + 1;
    for held in std::mem::take(&mut log.early) {
        let line = scrub::scrub(&held, &log.names);
        let _ = writeln!(file, "{line}");
        written += line.len() as u64 + 1;
    }
    log.written = written;
    let _ = file.flush();
    log.file = Some(file);
}

fn rotate(dir: &Path) {
    let name = |k: usize| match k {
        0 => dir.join("vandal.log"),
        k => dir.join(format!("vandal.{k}.log")),
    };
    let _ = fs::remove_file(name(KEEP_RUNS - 1));
    for k in (0..KEEP_RUNS - 1).rev() {
        let _ = fs::rename(name(k), name(k + 1));
    }
}

/// Writes a line: to stderr as given, to the file scrubbed, with the seconds since startup.
pub fn line(text: &str) {
    eprintln!("{text}");
    let mut log = lock();
    write(&mut log, text, false);
}

/// As [`line`], past the size cap: a panic's report.
fn urgent_line(text: &str) {
    eprintln!("{text}");
    let mut log = lock();
    write(&mut log, text, true);
}

/// What becomes of a line of `len` bytes, `written` already in the file.
#[derive(Debug, PartialEq)]
enum Admit {
    Write,
    /// The cap reached: the note that the log is full goes in instead, once.
    Full,
    Drop,
}

fn admit(written: u64, len: u64, urgent: bool) -> Admit {
    if urgent || written + len <= MAX_BYTES {
        Admit::Write
    } else if written <= MAX_BYTES {
        Admit::Full
    } else {
        Admit::Drop
    }
}

fn write(log: &mut Log, text: &str, urgent: bool) {
    if !enabled() {
        return;
    }
    let at = START.get_or_init(Instant::now).elapsed().as_secs_f64();
    let stamped = format!("[{at:9.3}] {text}");
    if log.file.is_none() {
        if log.early.len() < EARLY_MAX {
            log.early.push(stamped);
        }
        return;
    }
    let line = scrub::scrub(&stamped, &log.names);
    let admitted = admit(log.written, line.len() as u64 + 1, urgent);
    let line = match admitted {
        Admit::Write => line,
        Admit::Full => format!("[{at:9.3}] {FULL}"),
        Admit::Drop => return,
    };
    let Some(file) = log.file.as_mut() else {
        return;
    };
    let _ = writeln!(file, "{line}");
    // Every line, so a crash loses none.
    let _ = file.flush();
    log.written += line.len() as u64 + 1;
    if admitted == Admit::Full {
        // Past the cap from here: nothing but urgent lines follows the note.
        log.written = log.written.max(MAX_BYTES + 1);
    }
}

/// A line from the crash handler: never waits for the lock (the crash may have happened
/// while holding it), and opens the file if it isn't yet.
pub fn crash_line(text: &str, product: &str) {
    eprintln!("{text}");
    if !enabled() {
        return;
    }
    let Ok(mut log) = LOG.try_lock() else { return };
    if log.file.is_none() {
        drop(log);
        open(product);
        let Ok(again) = LOG.try_lock() else { return };
        log = again;
    }
    // Past the cap: the crash is what the log is for.
    write(&mut log, text, true);
}

/// Whether the log and crash dumps are written (Settings › About › Debugging).
pub fn enabled() -> bool {
    ENABLED.load(Ordering::Relaxed)
}

/// Turns the log on (opening this run's file, or a new one mid-run) or off (closing it, and
/// letting go of the lines held for it).
pub fn set_enabled(product: &str, on: bool) {
    if on {
        ENABLED.store(true, Ordering::Relaxed);
        open(product);
        return;
    }
    line("[log] logging turned off");
    ENABLED.store(false, Ordering::Relaxed);
    let mut log = lock();
    log.file = None;
    log.early.clear();
}

/// The logs folder's size in bytes: its logs and crash dumps (Settings › About › Debugging).
pub fn folder_bytes() -> u64 {
    let Some(dir) = dir() else { return 0 };
    fs::read_dir(dir)
        .map(|entries| {
            entries
                .flatten()
                .filter_map(|e| e.metadata().ok())
                .filter(|m| m.is_file())
                .map(|m| m.len())
                .sum()
        })
        .unwrap_or(0)
}

/// Deletes the older logs and every crash dump, and empties this run's log (it's open), which
/// says it was cleared.
pub fn clear() -> Result<(), String> {
    let Some(dir) = dir() else { return Ok(()) };
    let mut log = lock();
    let mut failed = Vec::new();
    let entries = fs::read_dir(dir)
        .map(|e| e.flatten().collect::<Vec<_>>())
        .unwrap_or_default();
    for entry in entries {
        let name = entry.file_name().to_string_lossy().into_owned();
        let older_log =
            name.starts_with("vandal.") && name.ends_with(".log") && name != "vandal.log";
        let dump = name.starts_with("crash-") && name.ends_with(".dmp");
        let current = name == "vandal.log" && log.file.is_none();
        if older_log || dump || current {
            if let Err(e) = fs::remove_file(entry.path()) {
                failed.push(format!("{name}: {e}"));
            }
        }
    }
    if let Some(file) = log.file.as_mut() {
        let emptied = file.set_len(0).and_then(|()| file.rewind());
        if let Err(e) = emptied {
            failed.push(format!("vandal.log: {e}"));
        }
        log.written = 0;
    }
    drop(log);
    line("[log] cleared");
    if failed.is_empty() {
        Ok(())
    } else {
        Err(format!(
            "Some files couldn't be deleted ({}).",
            failed.join("; ")
        ))
    }
}

/// A file's name, kept out of the log from now on (with its stem, if long enough).
pub fn private_file(path: &Path) {
    let Some(name) = path.file_name() else { return };
    let mut log = lock();
    for name in scrub::file_names(&name.to_string_lossy()) {
        if !log.names.contains(&name) {
            log.names.push(name);
        }
    }
}

/// The names kept out of the log, for the crash handler's dump: never waits for the lock.
pub fn private_names() -> Vec<String> {
    LOG.try_lock()
        .map(|log| log.names.clone())
        .unwrap_or_default()
}

/// Lines from a page (`editor`, `overlay`, `settings`): its edits by name, its tool, its
/// errors. Never what the user typed or named; scrubbed anyway, as every line is.
pub fn page(page: &str, lines: Vec<String>) {
    let page: String = page
        .chars()
        .filter(char::is_ascii_lowercase)
        .take(12)
        .collect();
    for text in lines {
        // A runaway message (a huge stack) doesn't fill the file.
        let text: String = text.chars().take(4000).collect();
        logln!("[{page}-page] {text}");
    }
}

/// Whether a run ended in a crash: a native one, a panic, or the webview's browser process (a
/// renderer's crash only reloads the page, and says so then).
fn crashed(log: &str) -> bool {
    log.lines().any(|line| {
        [
            "] [crash] exception ",
            "] [panic] thread ",
            "] [webview] failed: ",
        ]
        .iter()
        .any(|mark| line.contains(mark))
    })
}

/// Sets the notice shown once the app is up (the newest wins).
pub fn set_notice(text: &str) {
    *NOTICE.lock().unwrap_or_else(|p| p.into_inner()) = Some(text.to_string());
}

/// The notice, once.
pub fn take_notice() -> Option<String> {
    let notice = NOTICE.lock().unwrap_or_else(|p| p.into_inner()).take();
    if let Some(text) = &notice {
        logln!("[log] notified: {text}");
    }
    notice
}

#[cfg(test)]
mod tests {
    use super::{admit, crashed, Admit, MAX_BYTES};

    #[test]
    fn a_full_log_takes_only_urgent_lines() {
        assert_eq!(admit(0, 80, false), Admit::Write);
        assert_eq!(admit(MAX_BYTES - 80, 80, false), Admit::Write);
        // The line that would cross the cap is the note that the log is full...
        assert_eq!(admit(MAX_BYTES - 40, 80, false), Admit::Full);
        // ...and after it (the count put past the cap) nothing ordinary gets in.
        assert_eq!(admit(MAX_BYTES + 1, 80, false), Admit::Drop);
        // A crash or a panic always does.
        assert_eq!(admit(MAX_BYTES + 1, 5000, true), Admit::Write);
    }

    #[test]
    fn a_crash_is_found_in_the_log() {
        let calm = "Vandal 0.3.0\n[    0.4] [startup] ready\n[    9.1] [editor-page] [edit] add";
        assert!(!crashed(calm));
        for line in [
            "[    3.3] [crash] exception 0xc0000005 at vandal.exe+0x2a53d5",
            "[    3.5] [panic] thread main: panicked at src/x.rs:1:1:",
            "[   40.0] [webview] failed: editor: browser process exited (crashed); closing",
        ] {
            assert!(crashed(&format!("{calm}\n{line}")), "{line}");
        }
        // The page's own errors aren't crashes, nor a reloaded renderer (the page said so).
        assert!(!crashed(
            "[    5.0] [editor-page] error: TypeError: x is undefined"
        ));
        assert!(!crashed(
            "[    4.1] [webview] crashed: editor: render process exited; reloading"
        ));
    }
}
