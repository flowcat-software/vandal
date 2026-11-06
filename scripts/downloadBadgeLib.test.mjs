import { describe, expect, it } from "vitest";
import { downloadsSvg } from "./downloadBadgeLib.mjs";

const attr = (svg, name) => Number(svg.match(new RegExp(`<svg[^>]* ${name}="([^"]+)"`))[1]);

describe("downloadsSvg", () => {
  it("matches shields.io's layout for a three-digit count", () => {
    const svg = downloadsSvg(150);
    expect(attr(svg, "width")).toBe(117); // shields.io's badge for 150 is 117 wide
    expect(svg).toContain('aria-label="downloads: 150"');
    expect(svg).toContain('<rect width="86" height="20" fill="#555"/>');
    expect(svg).toContain('<text x="525" y="140" textLength="590">downloads</text>');
    expect(svg).toContain('<text x="1005" y="140" textLength="210">150</text>');
  });

  it("grows 7px per digit", () => {
    expect(attr(downloadsSvg(9), "width")).toBe(103);
    expect(attr(downloadsSvg(12345), "width")).toBe(131);
  });

  it("takes the count as the workflow passes it, a string", () => {
    expect(downloadsSvg("150")).toBe(downloadsSvg(150));
  });

  it("refuses anything that isn't a count, so a bad API reply can't become markup", () => {
    for (const bad of ["", "abc", "1<script>", -1, 1.5, "NaN", undefined]) {
      expect(() => downloadsSvg(bad)).toThrow(/Not a download count/);
    }
  });

  it("is well-formed XML", () => {
    const svg = downloadsSvg(150);
    expect(svg.startsWith("<svg ")).toBe(true);
    expect(svg.trimEnd().endsWith("</svg>")).toBe(true);
    expect(svg.match(/<svg/g)).toHaveLength(2);
    expect(svg.match(/<\/svg>/g)).toHaveLength(2);
  });
});
