/**
 * Keep-alive for Render free tier.
 *
 * Render spins down free web services after 15 minutes of inactivity.
 * This module pings the /api/healthz endpoint every 14 minutes so the
 * server never goes idle long enough to sleep.
 *
 * Only active when RENDER_EXTERNAL_URL is set (i.e. on Render). Has no
 * effect in local development.
 */
import { logger } from "./logger";

const INTERVAL_MS = 14 * 60 * 1000;

export function startKeepAlive(): void {
  const baseUrl = process.env["RENDER_EXTERNAL_URL"];

  if (!baseUrl) {
    return;
  }

  const url = `${baseUrl}/api/healthz`;
  logger.info({ url, intervalMinutes: 14 }, "Keep-alive: started");

  const ping = () => {
    fetch(url)
      .then((res) => {
        logger.debug({ status: res.status }, "Keep-alive: ping ok");
      })
      .catch((err: unknown) => {
        logger.warn({ err }, "Keep-alive: ping failed");
      });
  };

  setInterval(ping, INTERVAL_MS);
}
