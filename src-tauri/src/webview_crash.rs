//! The webview's crashes (PLAN 3V.8, Razorcat's C4). WebView2 draws the pages in processes of
//! its own, so when one dies Vandal doesn't crash with it, and `crash.rs` never sees it: the
//! window just goes blank. WebView2 says so (`ProcessFailed`): it's logged, and
//! - a page's renderer gone: the page is reloaded, and a notification says why (an editor's
//!   edit, which lived in the page, is lost);
//! - the browser process gone: nothing can be shown any more, so Vandal says so and closes;
//! - anything else (the GPU process, which WebView2 restarts; a renderer not responding, which
//!   may recover): logged only.

use tauri::{AppHandle, Manager, WebviewWindow};
use webview2_com::Microsoft::Web::WebView2::Win32::*;
use webview2_com::{CallDevToolsProtocolMethodCompletedHandler, ProcessFailedEventHandler};
use windows::core::{w, Interface, HSTRING};
use windows::Win32::UI::WindowsAndMessaging::{
    MessageBoxW, MB_ICONERROR, MB_OK, MB_SETFOREGROUND, MB_TOPMOST,
};

const RELOADED: &str = "A window stopped working and was reloaded. A report was saved.";

/// Watches `window`'s webview for its processes failing.
pub fn watch(window: &WebviewWindow) {
    let app = window.app_handle().clone();
    let label = window.label().to_string();
    let watched = window.with_webview(move |webview| unsafe {
        let Ok(core) = webview.controller().CoreWebView2() else {
            logln!("[webview] {label}: no CoreWebView2 to watch");
            return;
        };
        let named = label.clone();
        let handler = ProcessFailedEventHandler::create(Box::new(move |sender, args| {
            if let Some(args) = args {
                failed(&app, &named, sender, &args);
            }
            Ok(())
        }));
        let mut token = 0;
        if let Err(e) = core.add_ProcessFailed(&handler, &mut token) {
            logln!("[webview] can't watch {label}: {e}");
        }
    });
    if let Err(e) = watched {
        logln!("[webview] can't watch {}: {e}", window.label());
    }
}

fn failed(
    app: &AppHandle,
    label: &str,
    sender: Option<ICoreWebView2>,
    args: &ICoreWebView2ProcessFailedEventArgs,
) {
    let mut kind = COREWEBVIEW2_PROCESS_FAILED_KIND::default();
    let _ = unsafe { args.ProcessFailedKind(&mut kind) };
    let (mut reason, mut code) = (COREWEBVIEW2_PROCESS_FAILED_REASON::default(), 0);
    let details = args.cast::<ICoreWebView2ProcessFailedEventArgs2>().ok();
    if let Some(args) = &details {
        let _ = unsafe { args.Reason(&mut reason) };
        let _ = unsafe { args.ExitCode(&mut code) };
    }
    let what = format!(
        "{label}: {} ({}, exit code 0x{code:08x})",
        kind_name(kind),
        reason_name(reason)
    );
    match kind {
        COREWEBVIEW2_PROCESS_FAILED_KIND_RENDER_PROCESS_EXITED => {
            // Not "failed:" (log.rs): the notification says so now, the next launch needn't.
            logln!("[webview] crashed: {what}; reloading");
            if let Some(core) = sender {
                if let Err(e) = unsafe { core.Reload() } {
                    logln!("[webview] couldn't reload {label}: {e}");
                }
            }
            crate::crash::tell(app, RELOADED);
        }
        COREWEBVIEW2_PROCESS_FAILED_KIND_BROWSER_PROCESS_EXITED => {
            // "failed:" marks a crash for the next launch's notification (log.rs).
            logln!("[webview] failed: {what}; closing");
            let product = crate::product_name(app);
            let text = HSTRING::from(format!(
                "{product}'s windows stopped working and it has to close. A report was saved; \
                 the next start shows where."
            ));
            // Windows' own message box (nothing of the webview's is left to draw one), here
            // on the main thread: elsewhere, Tauri sometimes closed the dead window and the
            // app before it showed.
            unsafe {
                MessageBoxW(
                    None,
                    &text,
                    &HSTRING::from(product),
                    MB_OK | MB_ICONERROR | MB_TOPMOST | MB_SETFOREGROUND,
                );
            }
            // Not `app.exit`: Tauri's shutdown waits on the dead webview. An unsaved capture
            // doesn't stay on disk (PLAN 3I.1), as on a normal exit.
            crate::output::delete_preview();
            std::process::exit(1);
        }
        _ => logln!("[webview] {what}"),
    }
}

fn kind_name(kind: COREWEBVIEW2_PROCESS_FAILED_KIND) -> &'static str {
    match kind {
        COREWEBVIEW2_PROCESS_FAILED_KIND_BROWSER_PROCESS_EXITED => "browser process exited",
        COREWEBVIEW2_PROCESS_FAILED_KIND_RENDER_PROCESS_EXITED => "render process exited",
        COREWEBVIEW2_PROCESS_FAILED_KIND_RENDER_PROCESS_UNRESPONSIVE => {
            "render process unresponsive"
        }
        COREWEBVIEW2_PROCESS_FAILED_KIND_FRAME_RENDER_PROCESS_EXITED => {
            "a frame's render process exited"
        }
        COREWEBVIEW2_PROCESS_FAILED_KIND_GPU_PROCESS_EXITED => "GPU process exited",
        COREWEBVIEW2_PROCESS_FAILED_KIND_UTILITY_PROCESS_EXITED => "a utility process exited",
        COREWEBVIEW2_PROCESS_FAILED_KIND_SANDBOX_HELPER_PROCESS_EXITED => "sandbox helper exited",
        _ => "a process exited",
    }
}

fn reason_name(reason: COREWEBVIEW2_PROCESS_FAILED_REASON) -> &'static str {
    match reason {
        COREWEBVIEW2_PROCESS_FAILED_REASON_CRASHED => "crashed",
        COREWEBVIEW2_PROCESS_FAILED_REASON_OUT_OF_MEMORY => "out of memory",
        COREWEBVIEW2_PROCESS_FAILED_REASON_UNRESPONSIVE => "unresponsive",
        COREWEBVIEW2_PROCESS_FAILED_REASON_TERMINATED => "terminated",
        COREWEBVIEW2_PROCESS_FAILED_REASON_LAUNCH_FAILED => "launch failed",
        COREWEBVIEW2_PROCESS_FAILED_REASON_PROFILE_DELETED => "profile deleted",
        _ => "unexpected",
    }
}

/// For `VANDAL_CRASH_TEST=webview` (a page's renderer) or `browser` (the whole webview):
/// crashes it through the DevTools protocol.
pub fn crash_for_test(window: &WebviewWindow, browser: bool) {
    let _ = window.with_webview(move |webview| unsafe {
        let Ok(core) = webview.controller().CoreWebView2() else {
            return;
        };
        let method = if browser {
            w!("Browser.crash")
        } else {
            w!("Page.crash")
        };
        let done = CallDevToolsProtocolMethodCompletedHandler::create(Box::new(|_, _| Ok(())));
        let _ = core.CallDevToolsProtocolMethod(method, w!("{}"), &done);
    });
}
