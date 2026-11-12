//! The color picker's copy formats (PLAN 3Y): a picked `#rrggbb` as the text
//! that goes on the clipboard. Pure, so it's unit-tested.

use serde::{Deserialize, Serialize};
use specta::Type;

/// How a picked color is copied (Settings › Color picker).
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum ColorFormat {
    /// `#1e88e5`
    #[default]
    HexLower,
    /// `#1E88E5`
    HexUpper,
    /// `rgb(30, 136, 229)`
    Rgb,
    /// `30, 136, 229`
    RgbBare,
    /// `hsl(207, 79%, 51%)`
    Hsl,
}

/// `#rrggbb` (either case) as its channels.
pub fn parse_hex(hex: &str) -> Option<[u8; 3]> {
    let digits = hex.strip_prefix('#')?;
    if digits.len() != 6 || !digits.is_ascii() {
        return None;
    }
    let channel = |i: usize| u8::from_str_radix(&digits[i..i + 2], 16).ok();
    Some([channel(0)?, channel(2)?, channel(4)?])
}

/// The text to copy for `[r, g, b]`.
pub fn format(rgb: [u8; 3], format: ColorFormat) -> String {
    let [r, g, b] = rgb;
    match format {
        ColorFormat::HexLower => format!("#{r:02x}{g:02x}{b:02x}"),
        ColorFormat::HexUpper => format!("#{r:02X}{g:02X}{b:02X}"),
        ColorFormat::Rgb => format!("rgb({r}, {g}, {b})"),
        ColorFormat::RgbBare => format!("{r}, {g}, {b}"),
        ColorFormat::Hsl => {
            let (h, s, l) = hsl(rgb);
            format!("hsl({h}, {s}%, {l}%)")
        }
    }
}

/// Hue in degrees (0–359), saturation and lightness in percent, rounded.
fn hsl([r, g, b]: [u8; 3]) -> (u32, u32, u32) {
    let (r, g, b) = (r as f64 / 255.0, g as f64 / 255.0, b as f64 / 255.0);
    let max = r.max(g).max(b);
    let min = r.min(g).min(b);
    let l = (max + min) / 2.0;
    let d = max - min;
    if d == 0.0 {
        return (0, 0, (l * 100.0).round() as u32);
    }
    let s = d / (1.0 - (2.0 * l - 1.0).abs());
    let h = if max == r {
        60.0 * (((g - b) / d).rem_euclid(6.0))
    } else if max == g {
        60.0 * ((b - r) / d + 2.0)
    } else {
        60.0 * ((r - g) / d + 4.0)
    };
    (
        (h.round() as u32) % 360,
        (s * 100.0).round() as u32,
        (l * 100.0).round() as u32,
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    const BLUE: [u8; 3] = [30, 136, 229];

    #[test]
    fn parses_hex_either_case() {
        assert_eq!(parse_hex("#1e88e5"), Some(BLUE));
        assert_eq!(parse_hex("#1E88E5"), Some(BLUE));
        assert_eq!(parse_hex("1e88e5"), None);
        assert_eq!(parse_hex("#1e88e"), None);
        assert_eq!(parse_hex("#1e88zz"), None);
        assert_eq!(parse_hex("#ééé"), None);
    }

    #[test]
    fn formats() {
        assert_eq!(format(BLUE, ColorFormat::HexLower), "#1e88e5");
        assert_eq!(format(BLUE, ColorFormat::HexUpper), "#1E88E5");
        assert_eq!(format(BLUE, ColorFormat::Rgb), "rgb(30, 136, 229)");
        assert_eq!(format(BLUE, ColorFormat::RgbBare), "30, 136, 229");
        assert_eq!(format(BLUE, ColorFormat::Hsl), "hsl(208, 79%, 51%)");
    }

    #[test]
    fn hsl_edges() {
        assert_eq!(format([0, 0, 0], ColorFormat::Hsl), "hsl(0, 0%, 0%)");
        assert_eq!(
            format([255, 255, 255], ColorFormat::Hsl),
            "hsl(0, 0%, 100%)"
        );
        assert_eq!(format([128, 128, 128], ColorFormat::Hsl), "hsl(0, 0%, 50%)");
        assert_eq!(format([255, 0, 0], ColorFormat::Hsl), "hsl(0, 100%, 50%)");
        assert_eq!(format([0, 255, 0], ColorFormat::Hsl), "hsl(120, 100%, 50%)");
        assert_eq!(format([0, 0, 255], ColorFormat::Hsl), "hsl(240, 100%, 50%)");
        // Just short of red going round: 359.x rounds to 0, not 360.
        assert_eq!(format([255, 0, 1], ColorFormat::Hsl), "hsl(0, 100%, 50%)");
    }
}
