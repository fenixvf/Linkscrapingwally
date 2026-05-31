import { logger } from "./logger";

export type LinkStatus = "active" | "expired" | "unknown";

const VIDEO_EXTENSIONS = [".mp4", ".m3u8", ".webm", ".mkv", ".mov", ".avi", ".ts", ".m4v", ".f4v"];
const VIDEO_MIME_TYPES = ["video/", "application/x-mpegurl", "application/vnd.apple.mpegurl", "audio/mpegurl"];

const VIDEO_URL_PATTERNS = [
  /https?:\/\/[^\s"'<>]+\.(?:mp4|m3u8|webm|mkv|mov|ts|m4v|f4v)(?:\?[^\s"'<>]*)?/gi,
  /["'](https?:\/\/[^\s"'<>]*(?:\/hls\/|\/dash\/|\/stream\/|\/video\/|\/play\/|\.m3u8|\.mp4)[^\s"'<>]*)["']/gi,
  /file:\s*["'](https?:\/\/[^\s"'<>]+)["']/gi,
  /source\s+src=["'](https?:\/\/[^\s"'<>]+)["']/gi,
  /["'](?:src|file|url|hls|dash)["']\s*:\s*["'](https?:\/\/[^\s"'<>]+)["']/gi,
  /"(?:hlsUrl|videoUrl|streamUrl|playbackUrl|mediaUrl|playerUrl|videoSrc|mp4Url|m3u8Url)"\s*:\s*"(https?:\/\/[^\s"'<>]+)"/gi,
  /data-(?:src|video-src|file|url)=["'](https?:\/\/[^\s"'<>]+)["']/gi,
];

// ---------------------------------------------------------------------------
// Slug helpers
// ---------------------------------------------------------------------------

/**
 * Splits a URL path into meaningful slug tokens.
 * e.g. "https://site.com/cursos/aula-01-introducao-python?t=123"
 *   → ["cursos", "aula", "01", "introducao", "python"]
 */
function extractSlugTokens(rawUrl: string): Set<string> {
  const tokens = new Set<string>();
  try {
    const u = new URL(rawUrl);
    // Use both path segments and the hostname subdomain parts
    const segments = u.pathname.split("/").filter(Boolean);
    for (const seg of segments) {
      // Strip file extension
      const withoutExt = seg.replace(/\.[a-z0-9]+$/i, "");
      // Split on non-alphanumeric boundaries
      const parts = withoutExt.split(/[-_. ]+/).filter((p) => p.length >= 2);
      for (const p of parts) tokens.add(p.toLowerCase());
    }
    // Also pull tokens from the query string (some CDNs encode the slug there)
    for (const [, val] of u.searchParams) {
      if (val.length >= 3 && /[a-z]/i.test(val)) {
        val.split(/[-_]+/).forEach((p) => { if (p.length >= 2) tokens.add(p.toLowerCase()); });
      }
    }
  } catch {
    // If not a valid URL, tokenise the raw string
    rawUrl.split(/[-_/. ]+/).filter((p) => p.length >= 2).forEach((p) => tokens.add(p.toLowerCase()));
  }
  return tokens;
}

/**
 * Counts how many tokens from `reference` appear inside `candidate`.
 */
function slugOverlap(candidateUrl: string, referenceTokens: Set<string>): number {
  if (referenceTokens.size === 0) return 0;
  const lower = candidateUrl.toLowerCase();
  let count = 0;
  for (const token of referenceTokens) {
    if (lower.includes(token)) count++;
  }
  return count;
}

// ---------------------------------------------------------------------------
// HTML video URL extraction
// ---------------------------------------------------------------------------

function extractVideoUrlsFromHtml(html: string): string[] {
  const found = new Set<string>();

  // <video src="..."> and <source src="...">
  for (const m of html.matchAll(/<(?:video|source)[^>]+src=["']([^"']+)["']/gi)) {
    found.add(m[1]);
  }

  // Generic patterns
  for (const pattern of VIDEO_URL_PATTERNS) {
    pattern.lastIndex = 0;
    for (const m of html.matchAll(pattern)) {
      const u = (m[1] ?? m[0]).replace(/^["']|["']$/g, "");
      if (u.startsWith("http")) found.add(u);
    }
  }

  // Filter to video-like URLs
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

// ---------------------------------------------------------------------------
// Scoring & selection
// ---------------------------------------------------------------------------

interface ScoredCandidate {
  url: string;
  score: number;
}

/**
 * Scores each candidate video URL against:
 *  1. Slug overlap with the original video URL          (weight 3 — strongest signal)
 *  2. Slug overlap with the page URL                    (weight 2)
 *  3. Hostname overlap with the original video URL      (weight 1)
 *
 * Returns candidates sorted descending by score.
 */
function rankCandidates(
  candidates: string[],
  originalUrl: string,
  pageUrl: string,
): ScoredCandidate[] {
  const originalTokens = extractSlugTokens(originalUrl);
  const pageTokens = extractSlugTokens(pageUrl);

  let originalHost = "";
  try { originalHost = new URL(originalUrl).hostname; } catch { /* ignore */ }

  return candidates
    .map((c) => {
      let score = 0;
      score += slugOverlap(c, originalTokens) * 3;
      score += slugOverlap(c, pageTokens) * 2;
      if (originalHost && c.includes(originalHost)) score += 1;
      return { url: c, score };
    })
    .sort((a, b) => b.score - a.score);
}

// ---------------------------------------------------------------------------
// Network helpers
// ---------------------------------------------------------------------------

async function fetchPage(pageUrl: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const res = await fetch(pageUrl, {
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
    logger.warn({ err, url: pageUrl }, "Failed to fetch page");
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
        headers: { "User-Agent": "Mozilla/5.0 (compatible; VideoLinkChecker/1.0)" },
      });
      return res.status >= 200 && res.status < 400;
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Checks and (if possible) refreshes a video URL.
 *
 * With pageUrl:
 *   1. Fetches the page HTML
 *   2. Extracts all video URL candidates
 *   3. Ranks them by slug similarity to both the original URL and the page URL
 *   4. Returns the best match
 *
 * Without pageUrl:
 *   - Falls back to a direct HEAD/GET check
 */
export async function checkVideoUrl(
  url: string,
  pageUrl?: string | null,
): Promise<{ status: LinkStatus; resolvedUrl: string | null }> {

  // ── Strategy 1: page scraping with slug-aware ranking ──────────────────────
  if (pageUrl) {
    logger.info({ pageUrl }, "Fetching page to extract video URL");
    const html = await fetchPage(pageUrl);

    if (html) {
      const candidates = extractVideoUrlsFromHtml(html);
      logger.info(
        { count: candidates.length, sample: candidates.slice(0, 5) },
        "Extracted video URL candidates",
      );

      if (candidates.length > 0) {
        const ranked = rankCandidates(candidates, url, pageUrl);
        logger.info(
          { ranked: ranked.slice(0, 5).map((r) => ({ url: r.url, score: r.score })) },
          "Ranked candidates",
        );

        // Take the top scorer; if multiple share the top score, prefer the one
        // whose extension matches the original (e.g. .m3u8 → .m3u8)
        const topScore = ranked[0].score;
        const topGroup = ranked.filter((r) => r.score === topScore);

        let originalExt = "";
        try { originalExt = new URL(url).pathname.split(".").pop()?.toLowerCase() ?? ""; } catch { /* ignore */ }

        const best =
          topGroup.find((r) => originalExt && r.url.toLowerCase().includes(`.${originalExt}`))?.url ??
          topGroup[0].url;

        const alive = await checkUrlAlive(best);
        return { status: alive ? "active" : "unknown", resolvedUrl: best };
      }

      return { status: "unknown", resolvedUrl: null };
    }
  }

  // ── Strategy 2: direct HEAD/GET check ──────────────────────────────────────
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    let response: Response;
    try {
      response = await fetch(url, {
        method: "HEAD",
        signal: controller.signal,
        redirect: "follow",
        headers: { "User-Agent": "Mozilla/5.0 (compatible; VideoLinkChecker/1.0)" },
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

    if (response.status >= 200 && response.status < 400) {
      return { status: "active", resolvedUrl };
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
