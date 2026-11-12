//! Resize image (PLAN 3Z): a part of an image resampled to a new size, with
//! `fast_image_resize`. Lanczos3 to shrink (sharp, no moiré on screenshots'
//! fine detail), Catmull-Rom to enlarge (less halo round text than Lanczos).
//! Alpha is premultiplied for the filter, so a window cutout's transparent
//! corners don't bleed dark into its edge. Pure, so it's unit-tested.

use fast_image_resize::images::{Image, ImageRef};
use fast_image_resize::{FilterType, PixelType, ResizeAlg, ResizeOptions, Resizer};

use crate::compose::{self, RgbaImage};
use crate::geometry::PhysicalRect;

/// Largest side a resize may produce.
pub const MAX_SIDE: u32 = 16_384;
/// Largest image a resize may produce: 100 MP is 400 MB of RGBA, held once per
/// version for undo.
pub const MAX_PIXELS: u64 = 100_000_000;

/// `crop` of `image` (in its pixels) resampled to `width` × `height`.
pub fn resample(
    image: &RgbaImage,
    crop: PhysicalRect,
    width: u32,
    height: u32,
) -> Result<RgbaImage, String> {
    check_size(width, height)?;
    let inside = crop.x >= 0
        && crop.y >= 0
        && crop.width > 0
        && crop.height > 0
        && crop.x as u64 + crop.width as u64 <= image.width as u64
        && crop.y as u64 + crop.height as u64 <= image.height as u64;
    if !inside {
        return Err("The crop is outside the image.".into());
    }
    // Cut out first: the filter would otherwise reach past the crop's edges
    // and pull in pixels you can't see (the image you resize is the visible one).
    let visible;
    let part = if crop == PhysicalRect::new(0, 0, image.width as i32, image.height as i32) {
        image
    } else {
        visible = compose::crop_rgba(image, crop).ok_or("The crop is empty.")?;
        &visible
    };
    let src = ImageRef::new(part.width, part.height, &part.rgba, PixelType::U8x4)
        .map_err(|e| format!("Couldn't read the image: {e}"))?;
    let mut dst = Image::new(width, height, PixelType::U8x4);
    let shrinking = (width as u64) * (height as u64) < (part.width as u64) * (part.height as u64);
    let filter = if shrinking {
        FilterType::Lanczos3
    } else {
        FilterType::CatmullRom
    };
    let options = ResizeOptions::new().resize_alg(ResizeAlg::Convolution(filter));
    Resizer::new()
        .resize(&src, &mut dst, &options)
        .map_err(|e| format!("Couldn't resize the image: {e}"))?;
    Ok(RgbaImage {
        width,
        height,
        rgba: dst.into_vec(),
    })
}

/// Why `width` × `height` can't be a resize's result, if it can't.
pub fn check_size(width: u32, height: u32) -> Result<(), String> {
    if width == 0 || height == 0 {
        return Err("The size must be at least 1 × 1 pixel.".into());
    }
    if width > MAX_SIDE || height > MAX_SIDE {
        return Err(format!("A side can be at most {MAX_SIDE} pixels."));
    }
    if width as u64 * height as u64 > MAX_PIXELS {
        return Err(format!(
            "That's {:.0} megapixels; the most is {}.",
            width as f64 * height as f64 / 1e6,
            MAX_PIXELS / 1_000_000
        ));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn solid(width: u32, height: u32, px: [u8; 4]) -> RgbaImage {
        RgbaImage {
            width,
            height,
            rgba: px.repeat((width * height) as usize),
        }
    }

    fn full(image: &RgbaImage) -> PhysicalRect {
        PhysicalRect::new(0, 0, image.width as i32, image.height as i32)
    }

    fn pixel(image: &RgbaImage, x: u32, y: u32) -> [u8; 4] {
        let i = ((y * image.width + x) * 4) as usize;
        image.rgba[i..i + 4].try_into().unwrap()
    }

    #[test]
    fn a_solid_color_stays_put_both_ways() {
        let image = solid(40, 30, [30, 136, 229, 255]);
        for (w, h) in [(20, 15), (100, 75), (7, 90)] {
            let out = resample(&image, full(&image), w, h).unwrap();
            assert_eq!((out.width, out.height), (w, h));
            assert_eq!(out.rgba.len(), (w * h * 4) as usize);
            assert!(out.rgba.chunks(4).all(|p| p == [30, 136, 229, 255]));
        }
    }

    #[test]
    fn only_the_crop_is_used() {
        // Left half red, right half green: the right half's crop is all green.
        let mut image = solid(20, 10, [255, 0, 0, 255]);
        for y in 0..10 {
            for x in 10..20 {
                let i = ((y * 20 + x) * 4) as usize;
                image.rgba[i..i + 4].copy_from_slice(&[0, 255, 0, 255]);
            }
        }
        let out = resample(&image, PhysicalRect::new(10, 0, 10, 10), 30, 30).unwrap();
        assert!(out.rgba.chunks(4).all(|p| p == [0, 255, 0, 255]));
    }

    #[test]
    fn transparency_doesnt_darken_edges() {
        // Opaque white next to fully transparent black: shrinking blends the
        // alpha, but the color stays white (premultiplied filtering).
        let mut image = solid(4, 2, [255, 255, 255, 255]);
        for y in 0..2 {
            for x in 2..4 {
                let i = ((y * 4 + x) * 4) as usize;
                image.rgba[i..i + 4].copy_from_slice(&[0, 0, 0, 0]);
            }
        }
        let out = resample(&image, full(&image), 1, 1).unwrap();
        let [r, g, b, a] = pixel(&out, 0, 0);
        assert!(a > 100 && a < 155, "alpha {a}");
        assert!(r > 250 && g > 250 && b > 250, "{r} {g} {b}");
    }

    #[test]
    fn refuses_impossible_sizes_and_crops() {
        let image = solid(10, 10, [0, 0, 0, 255]);
        assert!(resample(&image, full(&image), 0, 5).is_err());
        assert!(resample(&image, full(&image), MAX_SIDE + 1, 5).is_err());
        assert!(resample(&image, full(&image), 12_000, 12_000).is_err()); // 144 MP
        assert!(resample(&image, PhysicalRect::new(5, 5, 10, 10), 5, 5).is_err());
        assert!(resample(&image, PhysicalRect::new(-1, 0, 5, 5), 5, 5).is_err());
        assert!(check_size(MAX_SIDE, 6_000).is_ok());
    }
}
