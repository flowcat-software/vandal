//! Takes what could identify the user out of a log line (PLAN 3V.8, Razorcat's C1): paths,
//! URLs, the Windows user and computer names, and the names of the images opened or saved.
//! The log keeps a file's facts (type, size), never its name.

/// What stands in for a path or URL.
pub const PATH: &str = "<path>";
/// What stands in for a name.
pub const NAME: &str = "<name>";

/// `line` with paths, URLs and every one of `names` (case-insensitive) taken out.
pub fn scrub(line: &str, names: &[String]) -> String {
    let mut out = paths_out(line);
    // Longest first, so a file's name goes before its stem would leave its extension.
    let mut names: Vec<&String> = names.iter().filter(|n| !n.is_empty()).collect();
    names.sort_by_key(|n| std::cmp::Reverse(n.len()));
    for name in names {
        out = replace_ignoring_case(&out, name, NAME);
    }
    out
}

/// Overwrites every `name` in `bytes` with `_`, in place and at the same length, as UTF-16 and
/// as UTF-8, ignoring ASCII case: for crash dumps, whose module list holds the exe's path
/// (and so the user's name) and whose stacks may hold anything. Returns how many it blanked.
pub fn blank(bytes: &mut [u8], name: &str) -> usize {
    if name.is_empty() {
        return 0;
    }
    let utf8: Vec<u8> = name.bytes().collect();
    let utf16: Vec<u8> = name.encode_utf16().flat_map(u16::to_le_bytes).collect();
    let mut count = 0;
    for (pattern, unit) in [(utf8, 1), (utf16, 2)] {
        let mut i = 0;
        while i + pattern.len() <= bytes.len() {
            if bytes[i..i + pattern.len()].eq_ignore_ascii_case(&pattern) {
                for k in (i..i + pattern.len()).step_by(unit) {
                    bytes[k] = b'_';
                }
                i += pattern.len();
                count += 1;
            } else {
                i += 1;
            }
        }
    }
    count
}

/// The names to scrub for a file: its whole name, and its stem when that's long enough not to
/// eat ordinary words ("clip", "test").
pub fn file_names(name: &str) -> Vec<String> {
    let mut names = vec![name.to_string()];
    if let Some((stem, _)) = name.rsplit_once('.') {
        if stem.chars().count() >= 6 {
            names.push(stem.to_string());
        }
    }
    names
}

/// Paths (`C:\…`, `\\server\…`, `\\?\…`, `%USERPROFILE%\…`) and URLs (`media://…`) replaced.
fn paths_out(line: &str) -> String {
    let chars: Vec<char> = line.chars().collect();
    let mut out = String::with_capacity(line.len());
    let mut i = 0;
    while i < chars.len() {
        if let Some((body, url)) = path_start(&chars, i) {
            out.push_str(PATH);
            i = path_end(&chars, body, url);
        } else {
            out.push(chars[i]);
            i += 1;
        }
    }
    out
}

/// Where a path or URL starting at `i` has its body (past what announces it), and whether it's
/// a URL, if one starts there.
fn path_start(c: &[char], i: usize) -> Option<(usize, bool)> {
    let at = |k: usize| c.get(i + k).copied();
    let sep = |ch: Option<char>| matches!(ch, Some('\\' | '/'));
    let starts_word = i == 0 || !c[i - 1].is_alphanumeric();
    // A drive: `C:\`, `c:/`.
    if starts_word
        && at(0).is_some_and(|ch| ch.is_ascii_alphabetic())
        && at(1) == Some(':')
        && sep(at(2))
    {
        return Some((i + 3, false));
    }
    // UNC and `\\?\`.
    if at(0) == Some('\\') && at(1) == Some('\\') {
        let long = matches!(at(2), Some('?' | '.')) && at(3) == Some('\\');
        return Some((i + if long { 4 } else { 2 }, false));
    }
    // `%VAR%\…`, as folder settings are kept.
    if at(0) == Some('%') {
        let close = (1..40).find(|&k| at(k) == Some('%')).unwrap_or(0);
        if close > 1
            && (1..close).all(|k| at(k).is_some_and(|ch| ch.is_ascii_alphanumeric() || ch == '_'))
            && sep(at(close + 1))
        {
            return Some((i + close + 2, false));
        }
    }
    // A URL: `scheme://`.
    if starts_word && at(0).is_some_and(|ch| ch.is_ascii_alphabetic()) {
        let mut k = 0;
        while at(k).is_some_and(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '+' | '-' | '.')) {
            k += 1;
        }
        if at(k) == Some(':') && at(k + 1) == Some('/') && at(k + 2) == Some('/') {
            return Some((i + k + 3, true));
        }
    }
    None
}

/// Where a path's body starting at `start` ends. A path runs until a character no Windows path
/// holds (quotes, `<>|*?`, a second `:`, a line break), or a space after a part with an
/// extension (`…\x.mp4 in 2 s`), or `" ("`, which follows a path in messages far more often
/// than it sits in a file name. Folders with spaces may take some of the message with them:
/// too much rather than too little. A URL ends at any space.
fn path_end(c: &[char], start: usize, url: bool) -> usize {
    let mut i = start;
    let mut extension = false;
    while i < c.len() {
        let ch = c[i];
        // A drive's colon (after `\\?\`) belongs; any other ends the path.
        let drive = ch == ':' && i == start + 1;
        if !drive
            && matches!(
                ch,
                '"' | '\'' | '<' | '>' | '|' | '*' | '?' | ':' | '\r' | '\n' | '\t' | '`'
            )
        {
            break;
        }
        if ch == ' ' && (url || extension || c.get(i + 1) == Some(&'(')) {
            break;
        }
        match ch {
            '\\' | '/' => extension = false,
            '.' => extension = c.get(i + 1).is_some_and(|n| n.is_alphanumeric()),
            _ => {}
        }
        i += 1;
    }
    // A sentence's full stop, a comma or a closing bracket after the path isn't part of it
    // (a bracket is, when the path opened one: `name (1).mp4`).
    while i > start {
        match c[i - 1] {
            '.' | ',' | ' ' => i -= 1,
            ')' if !c[start..i].contains(&'(') => i -= 1,
            _ => break,
        }
    }
    i
}

/// `text` with every case-insensitive match of `find` replaced by `with`.
fn replace_ignoring_case(text: &str, find: &str, with: &str) -> String {
    let lower = text.to_lowercase();
    let find = find.to_lowercase();
    // Lowercasing can change byte lengths outside ASCII; then match exactly instead.
    if lower.len() != text.len() || find.is_empty() {
        return text.replace(&find, with);
    }
    let mut out = String::with_capacity(text.len());
    let mut last = 0;
    for (at, _) in lower.match_indices(&find) {
        if at < last {
            continue;
        }
        out.push_str(&text[last..at]);
        out.push_str(with);
        last = at + find.len();
    }
    out.push_str(&text[last..]);
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn s(line: &str) -> String {
        scrub(line, &[])
    }

    #[test]
    fn drive_paths_go() {
        assert_eq!(
            s(r"[proxy] made C:\Users\Rich\AppData\x.mp4 in 2.0 s"),
            "[proxy] made <path> in 2.0 s"
        );
        assert_eq!(s("open c:/Videos/My Holiday.mov"), "open <path>");
        assert_eq!(
            s(r#"can't read "D:\a b\c.mp4": denied"#),
            r#"can't read "<path>": denied"#
        );
        assert_eq!(s(r"D:\clips\x.mp4: No such file"), "<path>: No such file");
        assert_eq!(
            s(r"failed for C:\x\y.mp4 (os error 2)"),
            "failed for <path> (os error 2)"
        );
        assert_eq!(s(r"moved to C:\x\proxies."), "moved to <path>.");
    }

    #[test]
    fn other_paths_and_urls_go() {
        assert_eq!(s(r"at \\nas\share\v.mp4 now"), "at <path> now");
        assert_eq!(s(r"\\?\C:\Users\me\v.mp4"), "<path>");
        assert_eq!(s(r"folder %USERPROFILE%\Videos\Work"), "folder <path>");
        assert_eq!(
            s("GET http://media.localhost/C%3A%5Cx.mp4 failed"),
            "GET <path> failed"
        );
        assert_eq!(s("loading media://localhost/3/proxy"), "loading <path>");
    }

    #[test]
    fn ordinary_text_stays() {
        for line in [
            "[export] encoded with h264_nvenc",
            "[fonts] 312 families in 41.2ms",
            "1920x1080 hevc at 60000/1001 fps: 3 of 4 done",
            "time 00:01:02.500, 50% (ratio 3:2)",
            "100% done",
        ] {
            assert_eq!(s(line), line);
        }
    }

    #[test]
    fn blanking_keeps_lengths() {
        let path = r"C:\Users\Alice\AppData\Local\Vandal\vandal.exe";
        let mut bytes: Vec<u8> = b"head ".to_vec();
        bytes.extend(path.encode_utf16().flat_map(u16::to_le_bytes));
        bytes.extend(b" and ALICE in ascii");
        let len = bytes.len();
        assert_eq!(blank(&mut bytes, "alice"), 2);
        assert_eq!(bytes.len(), len);
        let wide: Vec<u16> = bytes[5..5 + path.len() * 2]
            .chunks(2)
            .map(|c| u16::from_le_bytes([c[0], c[1]]))
            .collect();
        assert_eq!(
            String::from_utf16(&wide).unwrap(),
            r"C:\Users\_____\AppData\Local\Vandal\vandal.exe"
        );
        assert!(bytes.ends_with(b" and _____ in ascii"));
        assert_eq!(blank(&mut bytes, ""), 0);
    }

    #[test]
    fn names_go_whatever_their_case() {
        let names = file_names("Birthday Party.MP4");
        assert_eq!(
            names,
            vec![
                "Birthday Party.MP4".to_string(),
                "Birthday Party".to_string()
            ]
        );
        assert_eq!(
            scrub(
                "[convert] birthday party.mp4 failed; birthday party stays",
                &names
            ),
            "[convert] <name> failed; <name> stays"
        );
        // Short stems would eat words: only the whole name goes.
        assert_eq!(file_names("clip.mp4"), vec!["clip.mp4".to_string()]);
        assert_eq!(
            scrub("clip.mp4: clip fades", &file_names("clip.mp4")),
            "<name>: clip fades"
        );
        assert_eq!(
            scrub("user Alice here", &["alice".into()]),
            "user <name> here"
        );
    }
}
