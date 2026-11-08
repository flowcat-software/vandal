//! Style pickers for the markup tools (PLAN Phase 2, "Style controls"): the
//! palette, line width and per-tool overrides, stored in settings. The page
//! renders each picker from its spec; Rust only keeps the specs sane.

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};
use specta::Type;

/// At most this many presets per list (keys 1–9 and 0 pick them).
pub const MAX_PRESETS: usize = 10;

/// A number control: a free range, or a list of presets shown as a stepped
/// slider, a dropdown or buttons. Lists are kept ascending.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(tag = "control", rename_all = "camelCase")]
pub enum NumberPicker {
    Slider { min: f64, max: f64 },
    Stepped { values: Vec<f64> },
    Dropdown { values: Vec<f64> },
    Buttons { values: Vec<f64> },
}

impl NumberPicker {
    /// [`Self::normalized`], with no value above `max` (a percentage's 100).
    fn normalized_up_to(self, max: f64) -> Option<Self> {
        let cap = |values: Vec<f64>| values.into_iter().map(|v| v.min(max)).collect();
        match self.normalized()? {
            Self::Slider { min, max: hi } => Self::Slider {
                min: min.min(max),
                max: hi.min(max),
            }
            .normalized(),
            Self::Stepped { values } => Self::Stepped {
                values: cap(values),
            }
            .normalized(),
            Self::Dropdown { values } => Self::Dropdown {
                values: cap(values),
            }
            .normalized(),
            Self::Buttons { values } => Self::Buttons {
                values: cap(values),
            }
            .normalized(),
        }
    }

    /// For the corner radius (PLAN 3D.18): 0 (square) is always a choice, first
    /// in a list or a slider's minimum, and it's never buttons (beside
    /// Spotlight's darkness buttons they read as one row of numbers), so
    /// buttons become a dropdown. `None` if a slider has no usable top.
    fn normalized_from_zero(self) -> Option<Self> {
        let with_zero = |values: Vec<f64>| {
            let mut v: Vec<f64> = values
                .into_iter()
                .filter(|x| x.is_finite() && *x > 0.0)
                .collect();
            v.sort_by(f64::total_cmp);
            v.dedup();
            v.truncate(MAX_PRESETS - 1);
            v.insert(0, 0.0);
            v
        };
        match self {
            Self::Slider { max, .. } => {
                (max.is_finite() && max > 0.0).then_some(Self::Slider { min: 0.0, max })
            }
            Self::Stepped { values } => Some(Self::Stepped {
                values: with_zero(values),
            }),
            Self::Dropdown { values } | Self::Buttons { values } => Some(Self::Dropdown {
                values: with_zero(values),
            }),
        }
    }

    /// Fix what can be fixed (order, duplicates, too many values); `None` if
    /// nothing usable is left.
    fn normalized(self) -> Option<Self> {
        let list = |values: Vec<f64>| {
            let mut v: Vec<f64> = values
                .into_iter()
                .filter(|x| x.is_finite() && *x > 0.0)
                .collect();
            v.sort_by(f64::total_cmp);
            v.dedup();
            v.truncate(MAX_PRESETS);
            (!v.is_empty()).then_some(v)
        };
        match self {
            Self::Slider { min, max } => {
                (min.is_finite() && max.is_finite() && min > 0.0 && max > min)
                    .then_some(Self::Slider { min, max })
            }
            Self::Stepped { values } => list(values).map(|values| Self::Stepped { values }),
            Self::Dropdown { values } => list(values).map(|values| Self::Dropdown { values }),
            Self::Buttons { values } => list(values).map(|values| Self::Buttons { values }),
        }
    }
}

/// How the font picker shows its fonts.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum FontControl {
    Dropdown,
    /// A stepped slider with the name under it (custom lists of up to 10).
    Stepped,
}

/// Where the font picker's fonts come from.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum FontSource {
    /// Every installed font.
    #[default]
    System,
    /// The user's own list, in their order.
    Custom,
    /// The text tool's fonts and control ("Same as Text tool"). Only the step
    /// font offers it (PLAN 3D.13); the text tool's own picker can't.
    Text,
}

/// A font picker (the text tool's, and the step markers'). The user's list is kept while `source` is
/// `System`, so switching back brings it back (Richard's call, 2C.3). Files
/// from before 2C.3 (`{"source":"system",...}` without `fonts`) load as is.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(default, rename_all = "camelCase")]
pub struct FontPicker {
    pub source: FontSource,
    pub fonts: Vec<String>,
    /// Kept as chosen: the page shows a dropdown whenever a stepped slider
    /// doesn't fit (the system list, or more than 10 fonts).
    pub control: FontControl,
}

impl Default for FontPicker {
    fn default() -> Self {
        Self {
            source: FontSource::System,
            fonts: Vec::new(),
            control: FontControl::Dropdown,
        }
    }
}

impl FontPicker {
    /// Names trimmed, duplicates (ignoring case) and blanks dropped; an empty
    /// custom list means every installed font. `Text` is kept only if
    /// `can_follow_text` (else every installed font).
    fn normalized(self, can_follow_text: bool) -> Self {
        let mut fonts: Vec<String> = Vec::new();
        for f in self
            .fonts
            .iter()
            .map(|f| f.trim())
            .filter(|f| !f.is_empty())
        {
            if !fonts.iter().any(|o| o.eq_ignore_ascii_case(f)) {
                fonts.push(f.to_string());
            }
        }
        let source = match self.source {
            FontSource::Custom if fonts.is_empty() => FontSource::System,
            FontSource::Text if !can_follow_text => FontSource::System,
            source => source,
        };
        Self {
            source,
            fonts,
            control: self.control,
        }
    }
}

/// How the options bar shows the colors (PLAN 3D.16).
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum ColorControl {
    /// The palette as a row of swatches (with the two-color chip).
    #[default]
    Swatches,
    /// A button per color that opens the palette.
    Dropdown,
}

/// An arrow head's look (PLAN 3W): a filled triangle or an open chevron.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum ArrowHead {
    Filled,
    Open,
}

/// An arrow head style in the options bar's list (PLAN 3W). `width` and
/// `length` are % of the standard head; the width scales only what sticks out
/// past the line (`geometry.ts` › `arrowHeadSize`).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ArrowHeadStyle {
    pub label: String,
    pub head: ArrowHead,
    pub width: f64,
    pub length: f64,
}

/// Head style limits, so a head still reads as one and never balloons
/// (mirrored in `headStyles.ts`).
pub const HEAD_WIDTH: (f64, f64) = (25.0, 200.0);
pub const HEAD_LENGTH: (f64, f64) = (50.0, 250.0);
/// Neither side more than this many times the other, compared with the standard head.
pub const HEAD_MAX_RATIO: f64 = 4.0;
pub const MAX_HEAD_STYLES: usize = 10;
pub const MAX_HEAD_LABEL: usize = 20;

impl ArrowHeadStyle {
    fn new(label: &str, head: ArrowHead, width: f64, length: f64) -> Self {
        Self {
            label: label.to_string(),
            head,
            width,
            length,
        }
    }

    /// The four that come with the app: Regular and Narrow, filled and open.
    pub fn defaults() -> Vec<Self> {
        use ArrowHead::{Filled, Open};
        vec![
            Self::new("Regular Filled", Filled, 100.0, 100.0),
            Self::new("Narrow Filled", Filled, 50.0, 125.0),
            Self::new("Regular Open", Open, 100.0, 100.0),
            Self::new("Narrow Open", Open, 50.0, 125.0),
        ]
    }

    /// Within the limits; a blank label becomes "Style n" (`n` from 1).
    fn normalized(self, n: usize) -> Self {
        let fine = |v: f64| if v.is_finite() { v } else { 100.0 };
        let width = fine(self.width).clamp(HEAD_WIDTH.0, HEAD_WIDTH.1);
        // Width's range allows every length, so clamping length settles the ratio.
        let length = fine(self.length)
            .clamp(HEAD_LENGTH.0, HEAD_LENGTH.1)
            .clamp(width / HEAD_MAX_RATIO, width * HEAD_MAX_RATIO);
        let label: String = self.label.trim().chars().take(MAX_HEAD_LABEL).collect();
        let label = label.trim_end().to_string();
        Self {
            label: if label.is_empty() {
                format!("Style {n}")
            } else {
                label
            },
            head: self.head,
            width,
            length,
        }
    }
}

/// Each style within the limits, at most [`MAX_HEAD_STYLES`]; the defaults if
/// none are left (the options bar always has one).
fn normalize_head_styles(list: Vec<ArrowHeadStyle>) -> Vec<ArrowHeadStyle> {
    let out: Vec<_> = list
        .into_iter()
        .take(MAX_HEAD_STYLES)
        .enumerate()
        .map(|(i, h)| h.normalized(i + 1))
        .collect();
    if out.is_empty() {
        ArrowHeadStyle::defaults()
    } else {
        out
    }
}

/// A dashed or dotted line style in the options bar's list (PLAN 3X). Dash and
/// gap are in line widths, with round ends: a dash of 1 is a dot. Solid isn't
/// one: it's always the first choice.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct DashStyle {
    pub label: String,
    pub dash: f64,
    pub gap: f64,
}

/// Dash style limits (mirrored in `dashStyles.ts`).
pub const DASH_LENGTH: (f64, f64) = (1.0, 20.0);
pub const DASH_GAP: (f64, f64) = (0.5, 20.0);
pub const MAX_DASH_STYLES: usize = 10;
pub const MAX_DASH_LABEL: usize = 20;

impl DashStyle {
    fn new(label: &str, dash: f64, gap: f64) -> Self {
        Self {
            label: label.to_string(),
            dash,
            gap,
        }
    }

    /// The three that come with the app.
    pub fn defaults() -> Vec<Self> {
        vec![
            Self::new("Dashed", 3.0, 2.0),
            Self::new("Dotted", 1.0, 1.5),
            Self::new("Long dash", 6.0, 3.0),
        ]
    }

    /// Within the limits, to a tenth; a blank label becomes "Style n" (`n` from 1).
    fn normalized(self, n: usize) -> Self {
        let fit = |v: f64, (lo, hi): (f64, f64), fallback: f64| {
            let v = if v.is_finite() { v } else { fallback };
            ((v * 10.0).round() / 10.0).clamp(lo, hi)
        };
        let label: String = self.label.trim().chars().take(MAX_DASH_LABEL).collect();
        let label = label.trim_end().to_string();
        Self {
            label: if label.is_empty() {
                format!("Style {n}")
            } else {
                label
            },
            dash: fit(self.dash, DASH_LENGTH, 3.0),
            gap: fit(self.gap, DASH_GAP, 2.0),
        }
    }
}

/// Each style within the limits, at most [`MAX_DASH_STYLES`]. May be empty:
/// then lines are solid only.
fn normalize_dash_styles(list: Vec<DashStyle>) -> Vec<DashStyle> {
    list.into_iter()
        .take(MAX_DASH_STYLES)
        .enumerate()
        .map(|(i, d)| d.normalized(i + 1))
        .collect()
}

/// A tool's own palette, width picker, color control and/or dash styles
/// ("Custom styles"), used instead of the global ones.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize, Type)]
#[serde(default, rename_all = "camelCase")]
pub struct ToolStyles {
    pub palette: Option<Vec<String>>,
    pub width: Option<NumberPicker>,
    pub color_control: Option<ColorControl>,
    /// Lines, arrows, rectangles, ellipses and callouts (PLAN 3X).
    pub dashes: Option<Vec<DashStyle>>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(default, rename_all = "camelCase")]
pub struct Styles {
    /// Color presets in the user's order, `#rrggbb`.
    pub palette: Vec<String>,
    /// How the colors show in the options bar.
    pub color_control: ColorControl,
    /// Line width in source px.
    pub width: NumberPicker,
    /// The text tool's font.
    pub font: FontPicker,
    /// The text tool's size in pt.
    pub font_size: NumberPicker,
    /// Redact's pixelate block size in source px (PLAN 3D.3).
    pub pixelate: NumberPicker,
    /// Redact's blur radius in source px.
    pub blur: NumberPicker,
    /// Spotlight's darkness outside, in % (PLAN 3D.7).
    pub spotlight: NumberPicker,
    /// Step markers' size in source px (PLAN 3D.13).
    pub step_size: NumberPicker,
    /// Rounded corners (rectangles, Spotlight's rectangle) in source px (PLAN
    /// 3D.17): 0 is always a choice, and never buttons.
    pub corner_radius: NumberPicker,
    /// Step markers' font; by default the text tool's choices.
    pub step_font: FontPicker,
    /// Per-tool overrides, keyed by tool id (`"highlighter"`, ...).
    pub tools: BTreeMap<String, ToolStyles>,
    /// The arrow's head styles, in the options bar's order (PLAN 3W).
    pub arrow_heads: Vec<ArrowHeadStyle>,
    /// Dash styles, in the options bar's order after Solid (PLAN 3X).
    pub dashes: Vec<DashStyle>,
}

impl Default for Styles {
    fn default() -> Self {
        let colors = |c: &[&str]| c.iter().map(|s| s.to_string()).collect();
        Self {
            palette: colors(&[
                "#e53935", "#fb8c00", "#fdd835", "#43a047", "#1e88e5", "#8e24aa", "#000000",
                "#ffffff",
            ]),
            // Defaults from Razorcat (PLAN 3V.2, Richard's picks): a dropdown
            // takes less room, and lines go wider.
            color_control: ColorControl::Dropdown,
            width: NumberPicker::Slider {
                min: 1.0,
                max: 30.0,
            },
            font: FontPicker::default(),
            font_size: NumberPicker::Dropdown {
                values: vec![8.0, 10.0, 12.0, 14.0, 16.0, 18.0, 20.0, 36.0, 48.0, 72.0],
            },
            pixelate: NumberPicker::Buttons {
                values: vec![6.0, 10.0, 16.0, 24.0],
            },
            blur: NumberPicker::Buttons {
                values: vec![3.0, 6.0, 10.0, 16.0],
            },
            spotlight: NumberPicker::Slider {
                min: 30.0,
                max: 85.0,
            },
            step_size: NumberPicker::Dropdown {
                values: vec![24.0, 32.0, 44.0, 60.0, 72.0],
            },
            corner_radius: NumberPicker::Dropdown {
                values: vec![0.0, 5.0, 10.0, 15.0, 20.0],
            },
            step_font: FontPicker {
                source: FontSource::Text,
                ..FontPicker::default()
            },
            tools: BTreeMap::from([
                (
                    "highlighter".to_string(),
                    ToolStyles {
                        palette: Some(colors(&[
                            "#ffeb3b", "#76ff03", "#ff4081", "#40c4ff", "#ffab40",
                        ])),
                        width: Some(NumberPicker::Slider {
                            min: 8.0,
                            max: 40.0,
                        }),
                        ..ToolStyles::default()
                    },
                ),
                ("callout".to_string(), ToolStyles::callout_default()),
            ]),
            arrow_heads: ArrowHeadStyle::defaults(),
            dashes: DashStyle::defaults(),
        }
    }
}

impl ToolStyles {
    /// The callout's default override: its own thickness range, 1 to 20 px
    /// (PLAN 3V.2, from Razorcat; it was a compact dropdown, 3E.3).
    pub fn callout_default() -> Self {
        Self {
            palette: None,
            width: Some(NumberPicker::Slider {
                min: 1.0,
                max: 20.0,
            }),
            ..Self::default()
        }
    }
}

/// `#rgb` or `#rrggbb` (any case) as lowercase `#rrggbb`.
pub fn normalize_color(c: &str) -> Option<String> {
    let hex = c.trim().strip_prefix('#')?;
    if !hex.chars().all(|ch| ch.is_ascii_hexdigit()) {
        return None;
    }
    match hex.len() {
        6 => Some(format!("#{}", hex.to_ascii_lowercase())),
        3 => Some(
            hex.chars()
                .flat_map(|ch| [ch, ch])
                .fold(String::from("#"), |mut s, ch| {
                    s.push(ch.to_ascii_lowercase());
                    s
                }),
        ),
        _ => None,
    }
}

/// Valid colors only, no duplicates, at most [`MAX_PRESETS`]; `None` if empty.
fn normalize_palette(palette: Vec<String>) -> Option<Vec<String>> {
    let mut out: Vec<String> = Vec::new();
    for c in palette.iter().filter_map(|c| normalize_color(c)) {
        if !out.contains(&c) && out.len() < MAX_PRESETS {
            out.push(c);
        }
    }
    (!out.is_empty()).then_some(out)
}

impl Styles {
    /// Repair hand-edited or outdated values; anything unusable goes back to
    /// its default (or, for an override, is dropped).
    pub fn normalized(self) -> Self {
        let defaults = Self::default();
        Self {
            palette: normalize_palette(self.palette).unwrap_or(defaults.palette),
            color_control: self.color_control,
            width: self.width.normalized().unwrap_or(defaults.width),
            font: self.font.normalized(false),
            font_size: self.font_size.normalized().unwrap_or(defaults.font_size),
            pixelate: self.pixelate.normalized().unwrap_or(defaults.pixelate),
            blur: self.blur.normalized().unwrap_or(defaults.blur),
            spotlight: self
                .spotlight
                .normalized_up_to(100.0)
                .unwrap_or(defaults.spotlight),
            step_size: self.step_size.normalized().unwrap_or(defaults.step_size),
            corner_radius: self
                .corner_radius
                .normalized_from_zero()
                .unwrap_or(defaults.corner_radius),
            step_font: self.step_font.normalized(true),
            tools: self
                .tools
                .into_iter()
                .map(|(tool, o)| {
                    let o = ToolStyles {
                        palette: o.palette.and_then(normalize_palette),
                        width: o.width.and_then(NumberPicker::normalized),
                        color_control: o.color_control,
                        dashes: o.dashes.map(normalize_dash_styles),
                    };
                    (tool, o)
                })
                .filter(|(_, o)| {
                    o.palette.is_some()
                        || o.width.is_some()
                        || o.color_control.is_some()
                        || o.dashes.is_some()
                })
                .collect(),
            arrow_heads: normalize_head_styles(self.arrow_heads),
            dashes: normalize_dash_styles(self.dashes),
        }
    }
}

impl Styles {
    /// The presets `tool` uses: its own palette if it has one, else the global one.
    fn palette_mut(&mut self, tool: &str) -> &mut Vec<String> {
        match self.tools.get_mut(tool).and_then(|o| o.palette.as_mut()) {
            Some(own) => own,
            None => &mut self.palette,
        }
    }

    /// Add `color` to the presets `tool` uses (the custom picker's "Save as preset").
    pub fn add_preset(&mut self, tool: &str, color: &str) -> Result<(), String> {
        let color = normalize_color(color).ok_or_else(|| format!("Not a color: {color}"))?;
        let palette = self.palette_mut(tool);
        if palette.contains(&color) {
            return Err("That color is already a preset.".into());
        }
        if palette.len() >= MAX_PRESETS {
            return Err(format!("The palette is full ({MAX_PRESETS} colors)."));
        }
        palette.push(color);
        Ok(())
    }

    /// Change (`Some`) or delete (`None`) preset `index` of the palette `tool`
    /// uses. The last color can't be deleted.
    pub fn edit_preset(
        &mut self,
        tool: &str,
        index: usize,
        color: Option<&str>,
    ) -> Result<(), String> {
        let palette = self.palette_mut(tool);
        if index >= palette.len() {
            return Err("That preset no longer exists.".into());
        }
        match color {
            None if palette.len() == 1 => Err("The palette needs at least one color.".into()),
            None => {
                palette.remove(index);
                Ok(())
            }
            Some(c) => {
                let c = normalize_color(c).ok_or_else(|| format!("Not a color: {c}"))?;
                if palette
                    .iter()
                    .enumerate()
                    .any(|(i, p)| i != index && *p == c)
                {
                    return Err("That color is already a preset.".into());
                }
                palette[index] = c;
                Ok(())
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn spotlight_darkness_stays_a_percentage() {
        let s = Styles {
            spotlight: NumberPicker::Buttons {
                values: vec![40.0, 150.0, 100.0],
            },
            ..Styles::default()
        }
        .normalized();
        assert_eq!(
            s.spotlight,
            NumberPicker::Buttons {
                values: vec![40.0, 100.0]
            }
        );
        let s = Styles {
            spotlight: NumberPicker::Slider {
                min: 20.0,
                max: 300.0,
            },
            ..Styles::default()
        }
        .normalized();
        assert_eq!(
            s.spotlight,
            NumberPicker::Slider {
                min: 20.0,
                max: 100.0
            }
        );
        // Nothing usable left: the default.
        let s = Styles {
            spotlight: NumberPicker::Slider {
                min: 120.0,
                max: 300.0,
            },
            ..Styles::default()
        }
        .normalized();
        assert_eq!(s.spotlight, Styles::default().spotlight);
    }

    #[test]
    fn corner_radius_always_offers_square_and_is_never_buttons() {
        let normalized = |p: NumberPicker| {
            Styles {
                corner_radius: p,
                ..Styles::default()
            }
            .normalized()
            .corner_radius
        };
        assert_eq!(
            normalized(NumberPicker::Buttons {
                values: vec![8.0, 4.0, 4.0, -1.0]
            }),
            NumberPicker::Dropdown {
                values: vec![0.0, 4.0, 8.0]
            }
        );
        assert_eq!(
            normalized(NumberPicker::Stepped {
                values: (1..=15).map(f64::from).collect()
            }),
            NumberPicker::Stepped {
                values: (0..=9).map(f64::from).collect()
            }
        );
        assert_eq!(
            normalized(NumberPicker::Slider {
                min: 5.0,
                max: 30.0
            }),
            NumberPicker::Slider {
                min: 0.0,
                max: 30.0
            }
        );
        assert_eq!(
            normalized(NumberPicker::Slider { min: 0.0, max: 0.0 }),
            Styles::default().corner_radius
        );
        assert_eq!(Styles::default().normalized(), Styles::default());
    }

    #[test]
    fn a_tool_can_keep_only_its_color_control() {
        let mut s = Styles::default();
        s.tools.insert(
            "step".into(),
            ToolStyles {
                color_control: Some(ColorControl::Dropdown),
                ..ToolStyles::default()
            },
        );
        let s = s.normalized();
        assert_eq!(s.tools["step"].color_control, Some(ColorControl::Dropdown));
        assert_eq!(s.color_control, ColorControl::Dropdown);
        // Files without one take the default.
        let old: Styles = serde_json::from_value(json!({ "palette": ["#000000"] })).unwrap();
        assert_eq!(old.color_control, ColorControl::Dropdown);
    }

    #[test]
    fn only_the_step_font_can_follow_the_text_tool() {
        let follow = FontPicker {
            source: FontSource::Text,
            ..FontPicker::default()
        };
        let s = Styles {
            font: follow.clone(),
            step_font: follow,
            ..Styles::default()
        }
        .normalized();
        assert_eq!(s.font.source, FontSource::System);
        assert_eq!(s.step_font.source, FontSource::Text);
        // Settings from before 3D.13 get the defaults.
        let old: Styles = serde_json::from_value(json!({ "palette": ["#000000"] })).unwrap();
        assert_eq!(old.step_font.source, FontSource::Text);
        assert_eq!(old.step_size, Styles::default().step_size);
    }

    #[test]
    fn presets_go_to_the_palette_the_tool_uses() {
        let mut s = Styles::default();
        s.add_preset("pen", "#ABC").unwrap();
        assert_eq!(s.palette.last().unwrap(), "#aabbcc");
        s.add_preset("highlighter", "#123456").unwrap();
        let own = s.tools["highlighter"].palette.as_ref().unwrap();
        assert_eq!(own.last().unwrap(), "#123456");
        assert!(!s.palette.contains(&"#123456".to_string()));

        assert!(s.add_preset("pen", "#aabbcc").is_err()); // already there
        assert!(s.add_preset("pen", "blue").is_err());
        while s.palette.len() < MAX_PRESETS {
            let c = format!("#00000{}", s.palette.len());
            s.add_preset("pen", &c).unwrap();
        }
        assert!(s.add_preset("pen", "#fefefe").is_err()); // full
    }

    #[test]
    fn presets_can_be_changed_and_deleted() {
        let mut s = Styles::default();
        s.edit_preset("pen", 0, Some("#ABCDEF")).unwrap();
        assert_eq!(s.palette[0], "#abcdef");
        // Not onto another preset's color.
        assert!(s
            .edit_preset("pen", 0, Some(&s.palette[1].clone()))
            .is_err());
        let second = s.palette[1].clone();
        s.edit_preset("pen", 0, None).unwrap();
        assert_eq!(s.palette[0], second);
        assert!(s.edit_preset("pen", 99, None).is_err());

        s.edit_preset("highlighter", 0, None).unwrap();
        assert_eq!(s.tools["highlighter"].palette.as_ref().unwrap().len(), 4);
        s.palette = vec!["#000000".into()];
        assert!(s.edit_preset("pen", 0, None).is_err()); // the last one stays
    }

    #[test]
    fn default_shape_matches_plan() {
        let v = serde_json::to_value(Styles::default()).unwrap();
        assert_eq!(v["palette"][0], "#e53935");
        // PLAN 3V.2.
        assert_eq!(v["colorControl"], "dropdown");
        assert_eq!(
            v["width"],
            json!({ "control": "slider", "min": 1.0, "max": 30.0 })
        );
        assert_eq!(
            v["spotlight"],
            json!({ "control": "slider", "min": 30.0, "max": 85.0 })
        );
        assert_eq!(
            v["stepSize"],
            json!({ "control": "dropdown", "values": [24.0, 32.0, 44.0, 60.0, 72.0] })
        );
        assert_eq!(
            v["tools"]["highlighter"]["width"],
            json!({ "control": "slider", "min": 8.0, "max": 40.0 })
        );
        assert_eq!(
            v["tools"]["callout"]["width"],
            json!({ "control": "slider", "min": 1.0, "max": 20.0 })
        );
        assert_eq!(Styles::default().normalized(), Styles::default());
    }

    #[test]
    fn head_styles_default_to_regular_and_narrow() {
        let v = serde_json::to_value(Styles::default()).unwrap();
        assert_eq!(
            v["arrowHeads"][1],
            json!({ "label": "Narrow Filled", "head": "filled", "width": 50.0, "length": 125.0 })
        );
        assert_eq!(v["arrowHeads"].as_array().unwrap().len(), 4);
        // Settings from before PLAN 3W get them too.
        let old: Styles = serde_json::from_value(json!({ "palette": ["#000000"] })).unwrap();
        assert_eq!(old.arrow_heads, ArrowHeadStyle::defaults());
    }

    #[test]
    fn head_styles_are_kept_within_limits() {
        let h = |label: &str, width: f64, length: f64| {
            ArrowHeadStyle::new(label, ArrowHead::Open, width, length)
        };
        let s = Styles {
            arrow_heads: vec![
                h("  Huge  ", 1000.0, 1.0),
                h("", 5.0, 1000.0),
                h("Thin", 30.0, 250.0), // longer than 4 × its width
                h(
                    "A label well over twenty characters",
                    f64::NAN,
                    f64::INFINITY,
                ),
            ],
            ..Styles::default()
        }
        .normalized();
        assert_eq!(
            s.arrow_heads,
            vec![
                h("Huge", 200.0, 50.0),
                h("Style 2", 25.0, 100.0),
                h("Thin", 30.0, 120.0),
                h("A label well over tw", 100.0, 100.0),
            ]
        );
        let many = Styles {
            arrow_heads: vec![h("x", 100.0, 100.0); 15],
            ..Styles::default()
        };
        assert_eq!(many.normalized().arrow_heads.len(), MAX_HEAD_STYLES);
        let none = Styles {
            arrow_heads: vec![],
            ..Styles::default()
        };
        assert_eq!(none.normalized().arrow_heads, ArrowHeadStyle::defaults());
    }

    #[test]
    fn dash_styles_default_and_old_settings_get_them() {
        let v = serde_json::to_value(Styles::default()).unwrap();
        assert_eq!(
            v["dashes"][1],
            json!({ "label": "Dotted", "dash": 1.0, "gap": 1.5 })
        );
        let old: Styles = serde_json::from_value(json!({ "palette": ["#000000"] })).unwrap();
        assert_eq!(old.dashes, DashStyle::defaults());
        // Removing them all is allowed: lines are solid only.
        let none = Styles {
            dashes: vec![],
            ..Styles::default()
        };
        assert!(none.normalized().dashes.is_empty());
    }

    #[test]
    fn dash_styles_are_kept_within_limits() {
        let d = DashStyle::new;
        let s = Styles {
            dashes: vec![
                d("  Big  ", 100.0, 0.0),
                d("", 2.34, 1.26),
                d(
                    "A label well over twenty characters",
                    f64::NAN,
                    f64::INFINITY,
                ),
            ],
            ..Styles::default()
        }
        .normalized();
        assert_eq!(
            s.dashes,
            vec![
                d("Big", 20.0, 0.5),
                d("Style 2", 2.3, 1.3),
                d("A label well over tw", 3.0, 2.0),
            ]
        );
        let many = Styles {
            dashes: vec![d("x", 2.0, 2.0); 15],
            ..Styles::default()
        };
        assert_eq!(many.normalized().dashes.len(), MAX_DASH_STYLES);
    }

    #[test]
    fn a_tools_own_dash_styles_are_kept_even_empty() {
        let s: Styles = serde_json::from_value(json!({
            "tools": {
                "rect": { "dashes": [{ "label": "", "dash": 0.0, "gap": 3.0 }] },
                "line": { "dashes": [] },
            }
        }))
        .unwrap();
        let s = s.normalized();
        assert_eq!(
            s.tools["rect"].dashes,
            Some(vec![DashStyle::new("Style 1", 1.0, 3.0)])
        );
        assert_eq!(s.tools["line"].dashes, Some(vec![]));
    }

    #[test]
    fn lists_are_sorted_deduped_and_capped() {
        let p = NumberPicker::Dropdown {
            values: vec![6.0, 2.0, 2.0, -1.0, f64::NAN, 4.0],
        };
        assert_eq!(
            p.normalized(),
            Some(NumberPicker::Dropdown {
                values: vec![2.0, 4.0, 6.0]
            })
        );
        let many = NumberPicker::Buttons {
            values: (1..=15).map(f64::from).collect(),
        };
        let Some(NumberPicker::Buttons { values }) = many.normalized() else {
            panic!()
        };
        assert_eq!(values.len(), MAX_PRESETS);
        assert!(NumberPicker::Stepped { values: vec![] }
            .normalized()
            .is_none());
        assert!(NumberPicker::Slider { min: 5.0, max: 5.0 }
            .normalized()
            .is_none());
    }

    #[test]
    fn font_pickers_are_normalized() {
        let custom = FontPicker {
            source: FontSource::Custom,
            fonts: vec![
                " Arial ".into(),
                "arial".into(),
                "".into(),
                "Georgia".into(),
            ],
            control: FontControl::Stepped,
        };
        assert_eq!(
            custom.normalized(false),
            FontPicker {
                source: FontSource::Custom,
                fonts: vec!["Arial".into(), "Georgia".into()],
                control: FontControl::Stepped,
            }
        );
        // No fonts left: every installed font.
        let empty = FontPicker {
            source: FontSource::Custom,
            fonts: vec![" ".into()],
            control: FontControl::Stepped,
        };
        assert_eq!(empty.normalized(false).source, FontSource::System);
        // The list is kept while the system fonts are in use.
        let parked = FontPicker {
            source: FontSource::System,
            fonts: vec!["Georgia".into()],
            control: FontControl::Dropdown,
        };
        assert_eq!(parked.clone().normalized(false), parked);

        let v = serde_json::to_value(Styles::default()).unwrap();
        assert_eq!(
            v["font"],
            json!({ "source": "system", "fonts": [], "control": "dropdown" })
        );
        assert_eq!(v["fontSize"]["values"][6], 20.0);
    }

    #[test]
    fn font_pickers_from_before_2c3_load() {
        let system: FontPicker =
            serde_json::from_value(json!({ "source": "system", "control": "dropdown" })).unwrap();
        assert_eq!(system, FontPicker::default());
        let custom: FontPicker = serde_json::from_value(
            json!({ "source": "custom", "fonts": ["Georgia"], "control": "stepped" }),
        )
        .unwrap();
        assert_eq!(custom.source, FontSource::Custom);
        assert_eq!(custom.fonts, ["Georgia"]);
        assert_eq!(custom.control, FontControl::Stepped);
    }

    #[test]
    fn colors_are_normalized() {
        assert_eq!(normalize_color("#ABC").as_deref(), Some("#aabbcc"));
        assert_eq!(normalize_color(" #1E88E5 ").as_deref(), Some("#1e88e5"));
        assert_eq!(normalize_color("red"), None);
        assert_eq!(normalize_color("#12345"), None);
        let p = normalize_palette(vec!["#fff".into(), "#FFFFFF".into(), "nope".into()]);
        assert_eq!(p, Some(vec!["#ffffff".to_string()]));
    }

    #[test]
    fn unusable_values_fall_back() {
        let s = Styles {
            palette: vec!["x".into()],
            width: NumberPicker::Buttons { values: vec![] },
            tools: BTreeMap::from([(
                "pen".to_string(),
                ToolStyles {
                    palette: Some(vec![]),
                    ..ToolStyles::default()
                },
            )]),
            ..Styles::default()
        }
        .normalized();
        let d = Styles::default();
        assert_eq!(s.palette, d.palette);
        assert_eq!(s.width, d.width);
        assert!(
            s.tools.is_empty(),
            "an override with nothing left is dropped"
        );
    }
}
