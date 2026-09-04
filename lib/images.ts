/**
 * Convert known file-share URLs into direct image URLs browsers can render
 * inside an <img> tag. Anything unrecognized is returned unchanged.
 *
 * Note: viewer/share pages (e.g. a cloud-drive `/shared/<token>` page) serve
 * HTML, not image bytes, so they can never render as embedded images — attach
 * those as hyperlinks instead.
 */
export function resolveImageUrl(input: string): string {
  const url = input.trim();
  if (!url) return url;

  // Google Drive share link: /file/d/<id>/view → direct thumbnail
  const driveFile = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (driveFile) return `https://drive.google.com/thumbnail?id=${driveFile[1]}&sz=w2000`;

  // Google Drive open/uc link: ?id=<id> → direct thumbnail
  if (/drive\.google\.com/.test(url)) {
    const idParam = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (idParam) return `https://drive.google.com/thumbnail?id=${idParam[1]}&sz=w2000`;
  }

  // Dropbox share link (?dl=0) → raw file (?raw=1)
  if (/dropbox\.com/.test(url)) {
    try {
      const u = new URL(url.replace(/^http:/, "https:"));
      u.searchParams.delete("dl");
      u.searchParams.set("raw", "1");
      return u.toString();
    } catch {
      return url;
    }
  }

  return url;
}

/** Looks like a share/viewer page rather than a direct image file. */
export function isSharePageUrl(input: string): boolean {
  const url = input.trim();
  if (!url) return false;
  if (/\.(png|jpe?g|gif|webp|svg|avif|bmp)(\?|#|$)/i.test(url)) return false;
  if (/drive\.google\.com|dropbox\.com/.test(url)) return false; // auto-converted above
  return /\/shared\/[\w-]+/.test(url) || /\/share(s|\/)?[/?]?$/i.test(url);
}
