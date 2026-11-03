/** A file size for people: "840 KB", "12.4 MB", "3.2 GB", in 1024s as Explorer counts. */
export function fileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  const mb = bytes / (1024 * 1024);
  if (mb < 1024) return `${mb < 100 ? mb.toFixed(1) : Math.round(mb)} MB`;
  const gb = mb / 1024;
  return `${gb < 100 ? gb.toFixed(1) : Math.round(gb)} GB`;
}
