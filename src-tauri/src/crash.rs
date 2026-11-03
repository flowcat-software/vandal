//! Native crashes (PLAN 3V.8, Razorcat's C2): an unhandled-exception filter that logs the
//! exception, where it happened (module and offset) and writes a small minidump next to the
//! log, then lets Windows go on as before. Windows' own dumps (LocalDumps) need an HKLM key,
//! which a per-user install can't set. The dump holds the threads' stacks and registers and the
//! module list: with the build's symbols (CI keeps them as an artifact, `build:local` beside
//! the installer), the stack names its functions. The names the log keeps out are blanked in it
//! too.

use std::fs::{self, File};
use std::os::windows::io::AsRawHandle;
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::OnceLock;

use tauri::AppHandle;
use tauri_winrt_notification::Toast;
use windows::core::{w, PCWSTR};
use windows::Win32::Foundation::{HANDLE, HMODULE};
use windows::Win32::System::Diagnostics::Debug::{
    MiniDumpNormal, MiniDumpWithThreadInfo, MiniDumpWithUnloadedModules, MiniDumpWriteDump,
    SetUnhandledExceptionFilter, EXCEPTION_POINTERS, MINIDUMP_EXCEPTION_INFORMATION, MINIDUMP_TYPE,
};
use windows::Win32::System::LibraryLoader::{
    GetModuleFileNameW, GetModuleHandleExW, GetModuleHandleW,
    GET_MODULE_HANDLE_EX_FLAG_FROM_ADDRESS, GET_MODULE_HANDLE_EX_FLAG_UNCHANGED_REFCOUNT,
};
use windows::Win32::System::Registry::{
    RegGetValueW, HKEY_LOCAL_MACHINE, RRF_RT_REG_DWORD, RRF_RT_REG_SZ,
};
use windows::Win32::System::SystemInformation::GetLocalTime;
use windows::Win32::System::Threading::{
    GetCurrentProcess, GetCurrentProcessId, GetCurrentThreadId,
};

/// Crash dumps kept, newest first.
const KEEP_DUMPS: usize = 5;
const EXCEPTION_CONTINUE_SEARCH: i32 = 0;
const ACCESS_VIOLATION: u32 = 0xC000_0005;

/// The product name, for a crash before the log has opened.
static PRODUCT: OnceLock<String> = OnceLock::new();

/// The build, as the About page shows it: `0.3.0-beta.15+4 (c3de0be, modified)` from
/// `build:local`, the version alone from CI; dev builds say so.
pub fn build() -> String {
    let version = option_env!("VITE_BUILD_VERSION")
        .filter(|v| !v.is_empty())
        .unwrap_or(env!("CARGO_PKG_VERSION"));
    let mut details: Vec<&str> = Vec::new();
    if let Some(commit) = option_env!("VITE_BUILD_COMMIT").filter(|c| !c.is_empty()) {
        details.push(commit);
    }
    if option_env!("VITE_BUILD_MODIFIED").is_some_and(|m| !m.is_empty()) {
        details.push("modified");
    }
    if cfg!(debug_assertions) {
        details.push("dev");
    }
    if details.is_empty() {
        version.to_string()
    } else {
        format!("{version} ({})", details.join(", "))
    }
}

/// The log's first line: the build, Windows, the local time, and where the exe is loaded (so
/// a backtrace's addresses can be made offsets).
pub fn header(product: &str) -> String {
    let _ = PRODUCT.set(product.to_string());
    let t = unsafe { GetLocalTime() };
    let base = unsafe { GetModuleHandleW(PCWSTR::null()) }.map_or(0, |m| m.0 as usize);
    format!(
        "{product} {} · Windows {} · {:04}-{:02}-{:02} {:02}:{:02}:{:02} · exe at 0x{base:x}",
        build(),
        windows_version(),
        t.wYear,
        t.wMonth,
        t.wDay,
        t.wHour,
        t.wMinute,
        t.wSecond
    )
}

/// `build 26200.6899 (25H2)`.
fn windows_version() -> String {
    let key = w!(r"SOFTWARE\Microsoft\Windows NT\CurrentVersion");
    let text = |value: PCWSTR| -> Option<String> {
        let mut buf = [0u16; 64];
        let mut size = std::mem::size_of_val(&buf) as u32;
        let status = unsafe {
            RegGetValueW(
                HKEY_LOCAL_MACHINE,
                key,
                value,
                RRF_RT_REG_SZ,
                None,
                Some(buf.as_mut_ptr().cast()),
                Some(&mut size),
            )
        };
        status.is_ok().then(|| {
            let len = buf.iter().position(|&c| c == 0).unwrap_or(buf.len());
            String::from_utf16_lossy(&buf[..len])
        })
    };
    let mut ubr = 0u32;
    let mut size = 4u32;
    let has_ubr = unsafe {
        RegGetValueW(
            HKEY_LOCAL_MACHINE,
            key,
            w!("UBR"),
            RRF_RT_REG_DWORD,
            None,
            Some((&raw mut ubr).cast()),
            Some(&mut size),
        )
    }
    .is_ok();
    let mut out = format!(
        "build {}",
        text(w!("CurrentBuild")).unwrap_or_else(|| "?".into())
    );
    if has_ubr {
        out += &format!(".{ubr}");
    }
    if let Some(release) = text(w!("DisplayVersion")) {
        out += &format!(" ({release})");
    }
    out
}

/// Installs the filter, for every thread. Windows still reports the crash after it.
pub fn install() {
    unsafe {
        SetUnhandledExceptionFilter(Some(on_crash));
    }
}

unsafe extern "system" fn on_crash(info: *const EXCEPTION_POINTERS) -> i32 {
    // A second thread crashing meanwhile, or this handler crashing, goes straight on.
    static ONCE: AtomicBool = AtomicBool::new(false);
    if ONCE.swap(true, Ordering::SeqCst) || info.is_null() {
        return EXCEPTION_CONTINUE_SEARCH;
    }
    let product = PRODUCT.get().map_or("Vandal", String::as_str);
    if let Some(record) = unsafe { (*info).ExceptionRecord.as_ref() } {
        let code = record.ExceptionCode.0 as u32;
        let mut what = format!(
            "[crash] exception 0x{code:08x} at {}, thread {}",
            place(record.ExceptionAddress as usize),
            std::thread::current().name().unwrap_or("unnamed")
        );
        if code == ACCESS_VIOLATION && record.NumberParameters >= 2 {
            let kind = match record.ExceptionInformation[0] {
                0 => "reading",
                1 => "writing",
                8 => "executing",
                _ => "touching",
            };
            what += &format!(", {kind} 0x{:x}", record.ExceptionInformation[1]);
        }
        crate::log::crash_line(&what, product);
    }
    let result = match dump(Some(info)) {
        Ok(name) => format!("[crash] dump written: {name}"),
        Err(e) => format!("[crash] no dump: {e}"),
    };
    crate::log::crash_line(&result, product);
    EXCEPTION_CONTINUE_SEARCH
}

/// `vandal.exe+0x4a6150`, or the bare address when no loaded module holds it.
pub fn place(address: usize) -> String {
    let mut module = HMODULE::default();
    let found = unsafe {
        GetModuleHandleExW(
            GET_MODULE_HANDLE_EX_FLAG_FROM_ADDRESS | GET_MODULE_HANDLE_EX_FLAG_UNCHANGED_REFCOUNT,
            PCWSTR(address as *const u16),
            &mut module,
        )
    };
    if found.is_err() {
        return format!("0x{address:x} (in no loaded module)");
    }
    let mut buf = [0u16; 260];
    let len = unsafe { GetModuleFileNameW(Some(module), &mut buf) } as usize;
    let path = String::from_utf16_lossy(&buf[..len]);
    // The name only: the folder would name the user.
    let name = path.rsplit('\\').next().unwrap_or("?");
    format!("{name}+0x{:x}", address - module.0 as usize)
}

/// Writes a minidump to the logs folder (`crash-20261024-001203.dmp`), with the exception
/// when there is one; its file name.
pub fn dump(info: Option<*const EXCEPTION_POINTERS>) -> Result<String, String> {
    if !crate::log::enabled() {
        return Err("logging is off".into());
    }
    let dir = crate::log::dir().ok_or("no logs folder")?;
    fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    let t = unsafe { GetLocalTime() };
    let name = format!(
        "crash-{:04}{:02}{:02}-{:02}{:02}{:02}.dmp",
        t.wYear, t.wMonth, t.wDay, t.wHour, t.wMinute, t.wSecond
    );
    let file = File::create(dir.join(&name)).map_err(|e| e.to_string())?;
    let exception = info.map(|pointers| MINIDUMP_EXCEPTION_INFORMATION {
        ThreadId: unsafe { GetCurrentThreadId() },
        ExceptionPointers: pointers.cast_mut(),
        ClientPointers: false.into(),
    });
    // Small: stacks, registers, threads, the modules and those unloaded. No heap: it's big
    // and holds the user's captures.
    let kind =
        MINIDUMP_TYPE(MiniDumpNormal.0 | MiniDumpWithThreadInfo.0 | MiniDumpWithUnloadedModules.0);
    unsafe {
        MiniDumpWriteDump(
            GetCurrentProcess(),
            GetCurrentProcessId(),
            HANDLE(file.as_raw_handle()),
            kind,
            exception.as_ref().map(|e| e as *const _),
            None,
            None,
        )
    }
    .map_err(|e| e.to_string())?;
    drop(file);
    blank_names(&dir.join(&name));
    Ok(name)
}

/// The log's private names (the user's, the computer's, the files') overwritten in the dump:
/// its module list holds the exe's path, under the user's profile.
fn blank_names(path: &Path) {
    let Ok(mut bytes) = fs::read(path) else {
        return;
    };
    let mut blanked = 0;
    for name in crate::log::private_names() {
        blanked += crate::scrub::blank(&mut bytes, &name);
    }
    if blanked > 0 {
        let _ = fs::write(path, bytes);
    }
}

/// A notification that a report was saved (the last run crashed, or a window was reloaded),
/// with the logs folder a click away: a tray app has no window that's sure to be open.
pub fn tell(app: &AppHandle, text: &str) {
    let product = crate::product_name(app);
    let toast = Toast::new(&crate::output::app_id(app))
        .title(&format!("{product} hit a problem"))
        .text1(text)
        .add_button("Show report", "report")
        .add_button("Report a bug", "issue")
        .on_activated(|action| {
            match action.as_deref() {
                Some("issue") => crate::commands::open_issues(),
                // The toast itself or Show report: the folder, to send the files.
                _ => {
                    let _ = crate::commands::open_logs_folder();
                }
            }
            Ok(())
        });
    if let Err(e) = toast.show() {
        logln!("[crash] toast failed: {e}");
    }
}

/// Crashes on purpose, to check the reports end to end: `VANDAL_CRASH_TEST` set to `native`
/// (an access violation), `panic` (on the main thread), `thread-panic`, `webview` (the first
/// overlay's renderer) or `browser` (the whole webview), a few seconds after startup; or
/// `flood`, which fills the log past its cap and then panics.
pub fn test_from_env(app: &AppHandle) {
    use tauri::Manager;
    let Ok(kind) = std::env::var("VANDAL_CRASH_TEST") else {
        return;
    };
    logln!("[crash] test: {kind} in 3 s");
    let app = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_secs(3));
        match kind.as_str() {
            "native" => unsafe {
                std::ptr::write_volatile(std::ptr::null_mut::<u32>().wrapping_add(4), 1);
            },
            // The log's cap: ~16 MB of lines, then a panic, which still gets in.
            "flood" => {
                for n in 0..200_000 {
                    logln!("[crash] test: flood line {n:06} {}", "x".repeat(60));
                }
                panic!("crash test after a flood");
            }
            "webview" | "browser" => {
                if let Some(window) = app.get_webview_window(&crate::overlay::label(0)) {
                    crate::webview_crash::crash_for_test(&window, kind == "browser");
                }
            }
            "panic" => {
                let _ = app.run_on_main_thread(|| panic!("crash test on the main thread"));
            }
            _ => panic!("crash test on a worker thread"),
        }
    });
}

/// Drops all but the newest few dumps.
pub fn prune(dir: &Path) {
    let Ok(entries) = fs::read_dir(dir) else {
        return;
    };
    let mut dumps: Vec<_> = entries
        .flatten()
        .filter(|e| {
            let name = e.file_name().to_string_lossy().into_owned();
            name.starts_with("crash-") && name.ends_with(".dmp")
        })
        .map(|e| e.path())
        .collect();
    // The names sort by time.
    dumps.sort();
    let extra = dumps.len().saturating_sub(KEEP_DUMPS);
    for old in dumps.into_iter().take(extra) {
        let _ = fs::remove_file(old);
    }
}
