//! In-memory store of the capture on screen (PLAN §4.3, 3AA). Full-resolution pixels stay
//! in Rust; the webview fetches them through the custom protocol.

use std::collections::VecDeque;
use std::sync::Arc;

use crate::capture::MonitorFrame;
use crate::geometry::PhysicalPoint;

pub type CaptureId = u32;

pub struct Capture {
    pub id: CaptureId,
    pub frames: Vec<Arc<MonitorFrame>>,
}

impl Capture {
    /// The color at `p` (virtual-desktop physical px) as `#rrggbb`, if a
    /// frame covers it (the eyedropper, PLAN 3U).
    pub fn color_at(&self, p: PhysicalPoint) -> Option<String> {
        let frame = self
            .frames
            .iter()
            .find(|f| f.monitor.physical_bounds.contains(p))?;
        let origin = frame.monitor.physical_bounds.origin();
        let (x, y) = (p.x - origin.x, p.y - origin.y);
        if x as u32 >= frame.width || y as u32 >= frame.height {
            return None;
        }
        let i = (y as usize * frame.width as usize + x as usize) * 4;
        let [b, g, r] = [frame.bgra[i], frame.bgra[i + 1], frame.bgra[i + 2]];
        Some(format!("#{r:02x}{g:02x}{b:02x}"))
    }
}

/// The capture on screen, while its overlays are up (PLAN 3AA). A session's
/// capture leaves when the session ends ([`FrameStore::take`]); whoever
/// delivers it holds the `Arc` until done, and then the pixels are freed. A
/// capture that never goes on screen (full screen, a window's own pixels) gets
/// an id from [`FrameStore::detached`] and isn't stored at all.
pub struct FrameStore {
    next_id: CaptureId,
    /// Oldest first.
    captures: VecDeque<Arc<Capture>>,
}

impl FrameStore {
    /// Only one capture is on screen at a time. This bounds what a path that
    /// forgot to take its capture could leave behind.
    const MAX: usize = 2;

    pub fn new() -> Self {
        Self {
            next_id: 1,
            captures: VecDeque::new(),
        }
    }

    /// A capture with an id, not stored.
    pub fn detached(&mut self, frames: Vec<MonitorFrame>) -> Arc<Capture> {
        let capture = Arc::new(Capture {
            id: self.next_id,
            frames: frames.into_iter().map(Arc::new).collect(),
        });
        self.next_id = self.next_id.wrapping_add(1).max(1);
        capture
    }

    /// Store a capture going on screen, evicting the oldest beyond [`Self::MAX`].
    pub fn insert(&mut self, frames: Vec<MonitorFrame>) -> Arc<Capture> {
        let capture = self.detached(frames);
        self.captures.push_back(capture.clone());
        while self.captures.len() > Self::MAX {
            self.captures.pop_front();
        }
        capture
    }

    pub fn get(&self, id: CaptureId) -> Option<Arc<Capture>> {
        self.captures.iter().find(|c| c.id == id).cloned()
    }

    pub fn frame(&self, id: CaptureId, monitor_index: u32) -> Option<Arc<MonitorFrame>> {
        self.get(id)?
            .frames
            .iter()
            .find(|f| f.monitor.index == monitor_index)
            .cloned()
    }

    /// Remove a capture and hand it over.
    pub fn take(&mut self, id: CaptureId) -> Option<Arc<Capture>> {
        let i = self.captures.iter().position(|c| c.id == id)?;
        self.captures.remove(i)
    }

    pub fn len(&self) -> usize {
        self.captures.len()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::geometry::{MonitorInfo, PhysicalRect};

    fn frame(index: u32) -> MonitorFrame {
        MonitorFrame {
            monitor: MonitorInfo {
                index,
                name: String::new(),
                physical_bounds: PhysicalRect::new(0, 0, 2, 1),
                work_area: PhysicalRect::new(0, 0, 2, 1),
                scale_factor: 1.0,
                is_primary: index == 0,
            },
            width: 2,
            height: 1,
            bgra: vec![index as u8; 8],
            has_alpha: false,
        }
    }

    #[test]
    fn evicts_oldest_beyond_max() {
        let mut store = FrameStore::new();
        let ids: Vec<_> = (0..4).map(|_| store.insert(vec![frame(0)]).id).collect();
        assert_eq!(store.len(), FrameStore::MAX);
        assert!(store.get(ids[0]).is_none());
        assert!(store.get(ids[1]).is_none());
        for id in &ids[2..] {
            assert!(store.get(*id).is_some());
        }
    }

    #[test]
    fn detached_captures_get_ids_but_arent_kept() {
        let mut store = FrameStore::new();
        let a = store.insert(vec![]).id;
        let b = store.detached(vec![frame(0)]).id;
        assert_ne!(a, b);
        assert_eq!(store.len(), 1);
        assert!(store.get(b).is_none());
    }

    #[test]
    fn ids_are_unique_and_nonzero() {
        let mut store = FrameStore::new();
        let a = store.insert(vec![]).id;
        let b = store.insert(vec![]).id;
        assert_ne!(a, 0);
        assert_ne!(a, b);
    }

    #[test]
    fn frame_lookup_by_monitor_index() {
        let mut store = FrameStore::new();
        let id = store.insert(vec![frame(0), frame(1)]).id;
        assert_eq!(store.frame(id, 1).unwrap().bgra[0], 1);
        assert!(store.frame(id, 2).is_none());
        assert!(store.frame(id + 1, 0).is_none());
    }

    #[test]
    fn take_hands_the_capture_over() {
        let mut store = FrameStore::new();
        let id = store.insert(vec![frame(0)]).id;
        let held = store.frame(id, 0).unwrap();
        let taken = store.take(id).unwrap();
        assert!(store.take(id).is_none());
        assert_eq!(store.len(), 0);
        assert_eq!(taken.id, id);
        // Outstanding readers (e.g. an in-flight protocol response) keep their Arc.
        assert_eq!(held.width, 2);
    }

    #[test]
    fn color_at_reads_the_pixel_on_its_monitor() {
        // A 2×1 monitor left of the origin, pixels BGRA: blue-ish, then red.
        let mut left = frame(1);
        left.monitor.physical_bounds = PhysicalRect::new(-2, 0, 2, 1);
        left.bgra = vec![0xff, 0x80, 0x00, 0, 0x00, 0x00, 0xff, 0];
        let capture = Capture {
            id: 1,
            frames: vec![Arc::new(frame(0)), Arc::new(left)],
        };
        assert_eq!(
            capture.color_at(PhysicalPoint::new(-2, 0)).as_deref(),
            Some("#0080ff")
        );
        assert_eq!(
            capture.color_at(PhysicalPoint::new(-1, 0)).as_deref(),
            Some("#ff0000")
        );
        assert_eq!(
            capture.color_at(PhysicalPoint::new(1, 0)).as_deref(),
            Some("#000000")
        );
        assert_eq!(capture.color_at(PhysicalPoint::new(2, 0)), None);
        assert_eq!(capture.color_at(PhysicalPoint::new(0, 1)), None);
    }
}
