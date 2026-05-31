import { logger } from "./logger";

export type LinkStatus = "active" | "expired" | "unknown";

const VIDEO_EXTENSIONS = [".mp4", ".m3u8", ".webm", ".mkv", ".mov", ".avi", ".ts", ".m4v"];
const VIDEO_MIME_TYPES = ["video/", "application/x-mpegurl", "application/vnd.apple.mpegurl", "audio/mpegurl"];

const VIDEO_URL_PATTERNS = [
  /https?:\/\/[^\s"'<>]+\.(?:mp4|m3u8|webm|mkv|mov|ts|m4v)(?:\?[^\s"'<>]*)?/gi,
  /["'](https?:\/\/[^\s"'<>]*(?:\/hls\/|\/dash\/|\/stream\/|\/video\/|\/play\/|\.m3u8|\.mp4)[^\s"'<>]*)["']/gi,
  /file:\s*["'](https?:\/\/[^\s"'<>]+)["']/gi,
  /source\s+src=["'](https?:\/\/[^\s"'<>]+)["']/gi,
  /["'](?:src|file|url|hls|dash)["']\s*:\s*["'](https?:\/\/[^\s"'<>]+)["']/gi,
  /"hlsUrl"\s*:\s*"(https?:\/\/[^\s"'<>]+)"/gi,
  /"videoUrl"\s*:\s*"(https?:\/\/[^\s"'<>]+)"/gi,
  /"streamUrl"\s*:\s*"(https?:\/\/[^\s"'<>]+)"/gi,
  /"playbackUrl"\s*:\s*"(https?:\/\/[^\s"'<>]+)"/gi,
  /data-src=["'](https?:\/\/[^\s"'<>]+)["']/gi,
  /data-video-src=["'](https?:\/\/[^\s"'<>]+)["']/gi,
];

function extractVideoUrlsFromHtml(html: string): string[] {
  const found = new Set<string>();

  // <video src="..."> and <source src="...">
  const srcMatches = html.matchAll(/<(?:video|source)[^>]+src=["']([^"']+)["']/gi);
  for (const m of srcMatches) found.add(m[1]);

  // Generic URL patterns
  for (const pattern of VIDEO_URL_PATTERNS) {
    pattern.lastIndex = 0;
    const matches = html.matchAll(pattern);
    for (const m of matches) {
      const url = m[1] ?? m[0];
      if (url.startsWith("http")) found.add(url.replace(/^["']|["']$/g, ""));
    }
  }

  // Filter to likely video URLs
  return Array.from(found).filter((u) => {
    const lower = u.toLowerCase();
    return (
      VIDEO_EXTENSIONS.some((ext) => lower.includes(ext)) ||
      lower.includes("/hls/") ||
      lower.includes("/dash/") ||
      lower.includes("/stream/") ||
      lower.includes("manifest") ||
      lower.includes("playlist")
    );
  });
}

async function fetchPage(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
        },
      });
      if (!res.ok) return null;
      return await res.text();
    } finally {
      clearTimeout(timeout);
    }
  } catch (err) {
    logger.warn({ err, url }, "Failed to fetch page");
    return null;
  }
}

async function checkUrlAlive(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const res = await fetch(url, {
        method: "HEAD",
        signal: controller.signal,
        redirect: "follow",
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; VideoLinkChecker/1.0)",
        },
      });
      return res.status >= 200 && res.status < 400;
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    return false;
  }
}

/**
 * If pageUrl is provided: scrapes the page and extracts the current video URL.
 * Otherwise: checks the direct URL via HEAD/GET.
 */
export async function checkVideoUrl(
  url: string,
  pageUrl?: string | null,
): Promise<{
  status: LinkStatus;
  resolvedUrl: string | null;
}> {
  // Strategy 1: scrape the page to find the current video URL
  if (pageUrl) {
    logger.info({ pageUrl }, "Fetching page to extract video URL");
    const html = await fetchPage(pageUrl);
    if (html) {
      const candidates = extractVideoUrlsFromHtml(html);
      logger.info({ count: candidates.length, candidates: candidates.slice(0, 5) }, "Extracted video URL candidates");

      if (candidates.length > 0) {
        // Prefer URLs that match the original domain or CDN patterns
        const originalHost = (() => {
          try { return new URL(url).hostname; } catch { return ""; }
        })();

        const sorted = candidates.sort((a, b) => {
          const aMatchesHost = a.includes(originalHost) ? -1 : 0;
          const bMatchesHost = b.includes(originalHost) ? -1 : 0;
          return aMatchesHost - bMatchesHost;
        });

        // Return the best candidate; verify it's alive if possible
        const best = sorted[0];
        const alive = await checkUrlAlive(best);
        return {
          status: alive ? "active" : "unknown",
          resolvedUrl: best,
        };
      }

      // Page fetched but no video URL found
      return { status: "unknown", resolvedUrl: null };
    }
  }

  // Strategy 2: check the direct URL
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    let response: Response;
    try {
      response = await fetch(url, {
        method: "HEAD",
        signal: controller.signal,
        redirect: "follow",
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; VideoLinkChecker/1.0)",
        },
      });
    } catch {
      response = await fetch(url, {
        method: "GET",
        signal: controller.signal,
        redirect: "follow",
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; VideoLinkChecker/1.0)",
          Range: "bytes=0-0",
        },
      });
    } finally {
      clearTimeout(timeout);
    }

    const resolvedUrl = response.url !== url ? response.url : null;
    const contentType = response.headers.get("content-type") ?? "";
    const isVideoContent = VIDEO_MIME_TYPES.some((t) => contentType.startsWith(t));

    if (response.status >= 200 && response.status < 400) {
      return { status: "active", resolvedUrl: resolvedUrl || (isVideoContent ? null : null) };
    }
    if ([401, 403, 404, 410].includes(response.status)) {
      return { status: "expired", resolvedUrl: null };
    }
    return { status: "unknown", resolvedUrl };
  } catch (err) {
    logger.warn({ err, url }, "Failed to check URL directly");
    return { status: "unknown", resolvedUrl: null };
  }
}
