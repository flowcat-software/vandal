//! The capture notification, on WinRT directly (PLAN 3AA.2): unlike
//! tauri-winrt-notification it can carry a tag, so a newer capture's
//! notification replaces the older one in Action Center, and an expiry, so
//! Windows removes it once the image it offers has been freed. Its XML matches
//! that crate's (ToastGeneric, silent), so it looks the same as the others.

use std::path::Path;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use windows::core::{IInspectable, Interface, HSTRING};
use windows::Data::Xml::Dom::XmlDocument;
use windows::Foundation::{DateTime, IReference, PropertyValue, TypedEventHandler};
use windows::UI::Notifications::{
    ToastActivatedEventArgs, ToastDismissalReason, ToastDismissedEventArgs, ToastNotification,
    ToastNotificationManager,
};

pub struct Spec<'a> {
    pub app_id: &'a str,
    pub title: &'a str,
    pub text: &'a str,
    pub image: Option<&'a Path>,
    /// (label, argument) pairs; the argument comes back to `on_activated`.
    pub buttons: &'a [(&'a str, &'a str)],
    /// A notification with the same tag replaces this one.
    pub tag: &'a str,
    /// Windows removes it from Action Center after this long.
    pub lifetime: Duration,
}

/// How a notification went away without being clicked.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Dismissed {
    /// Closed or swiped away: it's gone.
    ByUser,
    /// Replaced, expired or removed by the app: it's gone.
    Removed,
    /// The banner timed out into Action Center: it can still be clicked.
    IntoActionCenter,
}

/// Show `spec`. `on_activated` gets the clicked button's argument, or None
/// for the body.
pub fn show(
    spec: &Spec,
    on_activated: impl Fn(Option<String>) + Send + 'static,
    on_dismissed: impl Fn(Dismissed) + Send + 'static,
) -> windows::core::Result<()> {
    let doc = XmlDocument::new()?;
    doc.LoadXml(&HSTRING::from(xml(spec)))?;
    let toast = ToastNotification::CreateToastNotification(&doc)?;
    toast.SetTag(&HSTRING::from(spec.tag))?;
    toast.SetGroup(&HSTRING::from(spec.tag))?;
    let expires = PropertyValue::CreateDateTime(date_time(SystemTime::now() + spec.lifetime))?
        .cast::<IReference<DateTime>>()?;
    toast.SetExpirationTime(&expires)?;
    toast.Activated(&TypedEventHandler::new(move |_, args| {
        on_activated(activated_argument(&args));
        Ok(())
    }))?;
    toast.Dismissed(&TypedEventHandler::new(move |_, args| {
        if let Some(how) = dismissed_how(&args) {
            on_dismissed(how);
        }
        Ok(())
    }))?;
    ToastNotificationManager::CreateToastNotifierWithId(&HSTRING::from(spec.app_id))?.Show(&toast)
}

fn activated_argument(args: &Option<IInspectable>) -> Option<String> {
    let args = args.as_ref()?.cast::<ToastActivatedEventArgs>().ok()?;
    let argument = args.Arguments().ok()?;
    (!argument.is_empty()).then(|| argument.to_string())
}

fn dismissed_how(args: &Option<ToastDismissedEventArgs>) -> Option<Dismissed> {
    let reason = args.as_ref()?.Reason().ok()?;
    Some(match reason {
        ToastDismissalReason::UserCanceled => Dismissed::ByUser,
        ToastDismissalReason::TimedOut => Dismissed::IntoActionCenter,
        _ => Dismissed::Removed,
    })
}

/// A WinRT DateTime: 100 ns ticks since 1601-01-01 UTC.
fn date_time(t: SystemTime) -> DateTime {
    const UNIX_TO_1601_SECS: i64 = 11_644_473_600;
    let since_unix = t.duration_since(UNIX_EPOCH).unwrap_or_default();
    DateTime {
        UniversalTime: (since_unix.as_secs() as i64 + UNIX_TO_1601_SECS) * 10_000_000
            + i64::from(since_unix.subsec_nanos() / 100),
    }
}

fn xml(spec: &Spec) -> String {
    let mut x = String::from(r#"<toast><visual><binding template="ToastGeneric">"#);
    if let Some(image) = spec.image {
        x.push_str(&format!(
            r#"<image id="1" src="{}" alt="Capture preview"/>"#,
            escape(&format!("file:///{}", image.display()))
        ));
    }
    x.push_str(&format!(r#"<text id="1">{}</text>"#, escape(spec.title)));
    x.push_str(&format!(r#"<text id="2">{}</text>"#, escape(spec.text)));
    x.push_str(r#"</binding></visual><audio silent="true"/>"#);
    if !spec.buttons.is_empty() {
        x.push_str("<actions>");
        for (label, argument) in spec.buttons {
            x.push_str(&format!(
                r#"<action content="{}" arguments="{}"/>"#,
                escape(label),
                escape(argument)
            ));
        }
        x.push_str("</actions>");
    }
    x.push_str("</toast>");
    x
}

fn escape(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn spec<'a>(buttons: &'a [(&'a str, &'a str)], image: Option<&'a Path>) -> Spec<'a> {
        Spec {
            app_id: "x",
            title: "Screenshot copied to clipboard",
            text: "1920 × 1080 · a&b <c>.png",
            image,
            buttons,
            tag: "capture",
            lifetime: Duration::from_secs(900),
        }
    }

    #[test]
    fn xml_escapes_text_and_lists_buttons() {
        let path = Path::new(r"C:\Users\R\x's.png");
        let x = xml(&spec(&[("Edit", "edit"), ("Save", "save")], Some(path)));
        assert!(x.contains(r#"<image id="1" src="file:///C:\Users\R\x&apos;s.png""#));
        assert!(x.contains("1920 × 1080 · a&amp;b &lt;c&gt;.png"));
        assert!(x.contains(
            r#"<action content="Edit" arguments="edit"/><action content="Save" arguments="save"/>"#
        ));
        assert!(x.contains(r#"<audio silent="true"/>"#));
    }

    #[test]
    fn no_buttons_no_actions() {
        let x = xml(&spec(&[], None));
        assert!(!x.contains("<actions>") && !x.contains("<image"));
    }

    #[test]
    fn date_time_counts_from_1601() {
        assert_eq!(date_time(UNIX_EPOCH).UniversalTime, 116_444_736_000_000_000);
        let later = UNIX_EPOCH + Duration::from_millis(1500);
        assert_eq!(date_time(later).UniversalTime, 116_444_736_015_000_000);
    }
}
