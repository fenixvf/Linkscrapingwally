import { logger } from "./logger";

export type LinkStatus = "active" | "expired" | "unknown";

/**
 * Checks a video URL by making a HEAD request (falling back to GET).
 * Returns the resolved URL (following redirects) and the status.
 */
export async function checkVideoUrl(url: string): Promise<{
  status: LinkStatus;
  resolvedUrl: string | null;
}> {
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
          "User-Agent":
            "Mozilla/5.0 (compatible; VideoLinkChecker/1.0)",
        },
      });
    } catch {
      response = await fetch(url, {
        method: "GET",
        signal: controller.signal,
        redirect: "follow",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; VideoLinkChecker/1.0)",
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

    if (
      response.status === 401 ||
      response.status === 403 ||
      response.status === 410 ||
      response.status === 404
    ) {
      return { status: "expired", resolvedUrl: null };
    }

    return { status: "unknown", resolvedUrl };
  } catch (err) {
    logger.warn({ err, url }, "Failed to check URL");
    return { status: "unknown", resolvedUrl: null };
  }
}
