import { describe, expect, it } from "vitest";
import { fileSize } from "./fileSize";

describe("fileSize", () => {
  it("says KB, MB or GB, whichever reads best", () => {
    expect(fileSize(200)).toBe("1 KB");
    expect(fileSize(840 * 1024)).toBe("840 KB");
    expect(fileSize(12.4 * 1024 * 1024)).toBe("12.4 MB");
    expect(fileSize(512 * 1024 * 1024)).toBe("512 MB");
    expect(fileSize(3.2 * 1024 ** 3)).toBe("3.2 GB");
    expect(fileSize(150 * 1024 ** 3)).toBe("150 GB");
  });
});
