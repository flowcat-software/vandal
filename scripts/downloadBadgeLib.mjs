// The README's downloads badge as a self-contained SVG, written by
// .github/workflows/download-badge.yml to the badges branch. It used to be
// shields.io's endpoint badge, which broke whenever shields.io was slow or
// down (GitHub's image proxy gives up and shows a broken image); now the
// badge only depends on GitHub.
//
// The layout copies shields.io's flat style: Verdana 11px, sized from known
// advance widths and pinned with textLength so every renderer agrees.

// GitHub's mark from simple-icons (CC0), the icon shields.io's `logo=github` uses.
const GITHUB_LOGO =
  "M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12";

const LABEL = "downloads";
const LABEL_WIDTH = 59; // "downloads" in Verdana 11px, as shields.io measures it
const DIGIT_WIDTH = 7; // every Verdana digit is the same width
const PAD = 5;
const LOGO = 14;
const LOGO_GAP = 4;

/** The badge for a download count (a non-negative integer). */
export function downloadsSvg(total) {
  // Digits only: the count comes from an API reply and ends up in markup.
  if (!/^\d{1,15}$/.test(String(total))) {
    throw new Error(`Not a download count: ${JSON.stringify(total)}`);
  }
  const message = String(Number(total));
  const messageWidth = message.length * DIGIT_WIDTH;

  const labelBox = PAD + LOGO + LOGO_GAP + LABEL_WIDTH + LOGO_GAP;
  const messageBox = PAD + messageWidth + PAD;
  const width = labelBox + messageBox;
  // Text is drawn at 10x and scaled down, as shields.io does, for finer positioning.
  const labelX = (PAD + LOGO + LOGO_GAP + LABEL_WIDTH / 2) * 10;
  const messageX = (labelBox + messageBox / 2 - 1) * 10; // shields.io sits it 1px left
  const title = `${LABEL}: ${message}`;

  const text = (x, length, s) =>
    `<text x="${x}" y="150" fill="#010101" fill-opacity=".3" textLength="${length * 10}" aria-hidden="true">${s}</text>` +
    `<text x="${x}" y="140" textLength="${length * 10}">${s}</text>`;

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="20" role="img" aria-label="${title}">` +
    `<title>${title}</title>` +
    `<linearGradient id="s" x2="0" y2="100%"><stop offset="0" stop-color="#bbb" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/></linearGradient>` +
    `<clipPath id="r"><rect width="${width}" height="20" rx="3"/></clipPath>` +
    `<g clip-path="url(#r)">` +
    `<rect width="${labelBox}" height="20" fill="#555"/>` +
    `<rect x="${labelBox}" width="${messageBox}" height="20" fill="#4b0"/>` +
    `<rect width="${width}" height="20" fill="url(#s)"/>` +
    `</g>` +
    `<svg x="${PAD}" y="3" width="${LOGO}" height="${LOGO}" viewBox="0 0 24 24"><path fill="whitesmoke" d="${GITHUB_LOGO}"/></svg>` +
    `<g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="110" transform="scale(.1)">` +
    text(labelX, LABEL_WIDTH, LABEL) +
    text(messageX, messageWidth, message) +
    `</g></svg>\n`
  );
}
