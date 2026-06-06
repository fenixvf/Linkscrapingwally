const DA  = 'https://drivea.masterotaku487.workers.dev';
const AQ  = 'https://aq.masterotaku487.workers.dev';
const AT  = 'https://at.masterotaku487.workers.dev';

const AD_BASE  = 'https://animesdrive.online';
const AQ_BASE  = 'https://animeq.net';
const AT_BASE  = 'https://www.anitube.zip';

export interface AnimeInfo {
  title: string;
  title_english?: string;
  title_portuguese?: string;
  titles?: { title: string }[];
  type?: string;
}

export interface DriveASource {
  label: string;
  url: string;
  directUrl?: string;
  origin?: string;
}

export interface DriveAResult {
  type: 'mp4' | 'iframe';
  sources: DriveASource[];
  embedUrl?: string;
}

// ── URL helpers ────────────────────────────────────────────────────────────────

const toDubUrl = (url: string): string => {
  if (url.includes('/Dub/')) return url;
  const i = url.lastIndexOf('/');
  return url.slice(0, i) + '/Dub' + url.slice(i);
};

const slugifyAD = (s: string): string =>
  s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[:.!?★☆♪•'"]/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .trim().replace(/\s+/g, '-').replace(/-+/g, '-');

const stripSeasonAD = (s: string): string =>
  s.replace(/\s+(the\s+)?(final|last|new)\s+season/gi, '')
   .replace(/\s*[-–]\s*(season|parte?|part|cour)\s*\d+/gi, '')
   .trim();

export const buildDriveACandidates = (anime: AnimeInfo, dub = false): string[] => {
  const titles = [
    anime.title,
    anime.title_english,
    anime.title_portuguese,
    ...(anime.titles ?? []).map(t => t.title),
  ].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i) as string[];

  const bases = new Set<string>();
  for (const t of titles) {
    const stripped = stripSeasonAD(t);
    for (const v of [t, stripped]) {
      const s = slugifyAD(v);
      if (s && s.length > 1) bases.add(s);
    }
  }

  if (dub) {
    const withDub = [...bases].map(b => b + '-dublado');
    return [...new Set([...withDub, ...bases])];
  }
  return [...bases];
};

const epStr = (ep: number): string => String(ep).padStart(2, '0');

// ── Raw result shape (shared by all workers) ───────────────────────────────────

interface RawResult {
  type?: string;
  proxyUrl?: string;
  url?: string;
  label?: string;
  isBlogger?: boolean;
  resolveUrl?: string;
  option?: string;
}

// ── Worker probe helpers ───────────────────────────────────────────────────────

const probeWorker = async (
  workerBase: string,
  pageUrl: string,
  timeoutMs = 20000,
): Promise<{ results: RawResult[] } | null> => {
  const workerUrl = `${workerBase}/?url=${encodeURIComponent(pageUrl)}`;
  try {
    const res = await fetch(workerUrl, {
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    const data = await res.json() as { success: boolean; results?: RawResult[] };
    if (data.success && data.results && data.results.length > 0) {
      return { results: data.results };
    }
  } catch {
    // ignore
  }
  return null;
};

// ── AnimesDrive ────────────────────────────────────────────────────────────────

const buildADEpisodeUrl = (slug: string, ep: number, isMovie = false): string =>
  isMovie
    ? `${AD_BASE}/episodio/${slug}`
    : `${AD_BASE}/episodio/${slug}-episodio-${epStr(ep)}`;

const probeDriveA = async (
  slug: string,
  ep: number,
  isMovie = false,
): Promise<{ slug: string; results: RawResult[] } | null> => {
  const found = await probeWorker(DA, buildADEpisodeUrl(slug, ep, isMovie));
  if (found) return { slug, results: found.results };
  return null;
};

export const resolveDriveA = async (
  anime: AnimeInfo,
  ep: number,
  dub = false,
): Promise<{ slug: string; results: RawResult[] }> => {
  const movieTypes = ['Movie', 'OVA', 'Special', 'TV Special', 'Music'];
  const isMovie = movieTypes.includes(anime.type ?? '');
  const candidates = buildDriveACandidates(anime, dub);

  console.log('[DriveA] Testando slugs:', candidates);

  for (const slug of candidates) {
    const found = await probeDriveA(slug, ep, isMovie);
    if (found) {
      console.log('[DriveA] ✅ Encontrado:', slug);
      return found;
    }
  }
  throw new Error(`Anime "${anime.title}" não encontrado no AnimesDrive`);
};

// ── AnimeQ ─────────────────────────────────────────────────────────────────────

const buildAQEpisodeUrl = (slug: string, ep: number, isMovie = false): string =>
  isMovie
    ? `${AQ_BASE}/episodio/${slug}`
    : `${AQ_BASE}/episodio/${slug}-episodio-${epStr(ep)}`;

const probeAnimeQ = async (
  slug: string,
  ep: number,
  isMovie = false,
): Promise<{ results: RawResult[] } | null> => {
  return probeWorker(AQ, buildAQEpisodeUrl(slug, ep, isMovie), 8000);
};

const resolveAnimeQ = async (
  anime: AnimeInfo,
  ep: number,
  dub = false,
): Promise<RawResult[] | null> => {
  const movieTypes = ['Movie', 'OVA', 'Special', 'TV Special', 'Music'];
  const isMovie = movieTypes.includes(anime.type ?? '');
  // Limit to top 3 candidates to avoid long sequential waits
  const candidates = buildDriveACandidates(anime, dub).slice(0, 3);

  console.log('[AnimeQ] Testando slugs:', candidates);

  for (const slug of candidates) {
    const found = await probeAnimeQ(slug, ep, isMovie);
    if (found) {
      console.log('[AnimeQ] ✅ Encontrado:', slug);
      return found.results;
    }
  }
  return null;
};

// ── AniTube ────────────────────────────────────────────────────────────────────

const slugifyAT = (s: string): string =>
  s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[:.!?★☆♪•'"]/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .trim().replace(/\s+/g, '-').replace(/-+/g, '-')
    .replace(/-+/g, '-');

const buildATEpisodeUrl = (slug: string, ep: number, isMovie = false): string =>
  isMovie
    ? `${AT_BASE}/${slug}/`
    : `${AT_BASE}/${slug}-${epStr(ep)}/`;

const probeAniTube = async (
  slug: string,
  ep: number,
  isMovie = false,
): Promise<{ results: RawResult[] } | null> => {
  return probeWorker(AT, buildATEpisodeUrl(slug, ep, isMovie), 8000);
};

const resolveAniTube = async (
  anime: AnimeInfo,
  ep: number,
  dub = false,
): Promise<RawResult[] | null> => {
  const movieTypes = ['Movie', 'OVA', 'Special', 'TV Special', 'Music'];
  const isMovie = movieTypes.includes(anime.type ?? '');

  const titles = [
    anime.title,
    anime.title_english,
    anime.title_portuguese,
    ...(anime.titles ?? []).map(t => t.title),
  ].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i) as string[];

  const allCandidates: string[] = [];
  for (const t of titles) {
    const stripped = stripSeasonAD(t);
    for (const v of [t, stripped]) {
      const s = slugifyAT(v);
      if (s && s.length > 1 && !allCandidates.includes(s)) allCandidates.push(s);
    }
  }

  // Limit to top 3 candidates to avoid long sequential waits
  const candidates = dub
    ? [...allCandidates.slice(0, 3).map(c => c + '-dublado'), ...allCandidates.slice(0, 3)]
    : allCandidates.slice(0, 3);

  console.log('[AniTube] Testando slugs:', candidates);

  for (const c of candidates) {
    const found = await probeAniTube(c, ep, isMovie);
    if (found) {
      console.log('[AniTube] ✅ Encontrado:', c);
      return found.results;
    }
  }
  return null;
};

// ── Source picker (shared by all workers) ─────────────────────────────────────

export const pickBestDriveASource = async (
  results: unknown[],
  originLabel?: string,
): Promise<DriveAResult> => {
  const raw = results as RawResult[];
  const workerProxy = originLabel === 'AnimeQ' ? AQ : originLabel === 'AniTube' ? AT : DA;

  const mp4s = raw.filter(r => r.type === 'mp4' && r.proxyUrl);
  if (mp4s.length > 0) {
    return {
      type: 'mp4',
      sources: mp4s.map(r => ({
        label: r.label ?? 'MP4',
        url: r.proxyUrl!,
        directUrl: r.url,
        origin: originLabel,
      })),
    };
  }

  const bloggers = raw.filter(r => r.isBlogger && r.resolveUrl);
  for (const r of bloggers) {
    try {
      const res = await fetch(r.resolveUrl!, { signal: AbortSignal.timeout(15000) });
      const data = await res.json() as { success: boolean; sources?: { url: string }[] };
      if (data.success && data.sources && data.sources.length > 0) {
        return {
          type: 'mp4',
          sources: data.sources.map((s, i) => ({
            label: `Blogger ${i + 1}`,
            url: `${workerProxy}/?proxy=${encodeURIComponent(s.url)}`,
            directUrl: s.url,
            origin: originLabel,
          })),
        };
      }
    } catch {
      // continue
    }
  }

  const iframes = raw.filter(r => r.type === 'iframe' && r.url);
  if (iframes.length > 0) {
    return {
      type: 'iframe',
      embedUrl: iframes[0].url,
      sources: iframes.map((r, i) => ({
        label: r.label ?? `Opção ${i + 1}`,
        url: r.url!,
        origin: originLabel,
      })),
    };
  }

  throw new Error('Nenhuma fonte válida encontrada');
};

// ── Main loader (tries all sources) ───────────────────────────────────────────

const withTimeout = <T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> =>
  Promise.race([
    promise,
    new Promise<T>(resolve => setTimeout(() => resolve(fallback), ms)),
  ]);

export const loadDriveA = async (
  anime: AnimeInfo,
  ep: number,
  isDub: boolean,
): Promise<
  | { success: true; sources: DriveASource[]; type: 'mp4' | 'iframe'; embedUrl?: string }
  | { success: false; error: string }
> => {
  try {
    // Run all three sources in parallel, with a 25s global ceiling
    const [adResult, aqResults, atResults] = await withTimeout(
      Promise.allSettled([
        resolveDriveA(anime, ep, isDub),
        resolveAnimeQ(anime, ep, isDub),
        resolveAniTube(anime, ep, isDub),
      ]),
      25000,
      [
        { status: 'rejected' as const, reason: new Error('Timeout global') },
        { status: 'rejected' as const, reason: new Error('Timeout global') },
        { status: 'rejected' as const, reason: new Error('Timeout global') },
      ],
    );

    const allSources: DriveASource[] = [];
    let dominantType: 'mp4' | 'iframe' = 'iframe';
    let embedUrl: string | undefined;

    const processResult = async (
      rawResults: RawResult[],
      originLabel: string,
    ) => {
      try {
        const picked = await pickBestDriveASource(rawResults, originLabel);
        if (picked.type === 'mp4') {
          dominantType = 'mp4';
          allSources.push(...picked.sources);
        } else if (picked.type === 'iframe') {
          if (!embedUrl) embedUrl = picked.embedUrl ?? picked.sources[0]?.url;
          allSources.push(...picked.sources);
        }
      } catch {
        // skip this source
      }
    };

    // Process in priority order: AnimesDrive → AnimeQ → AniTube
    if (adResult.status === 'fulfilled') {
      await processResult(adResult.value.results as RawResult[], 'AnimesDrive');
    }
    if (aqResults.status === 'fulfilled' && aqResults.value) {
      await processResult(aqResults.value, 'AnimeQ');
    }
    if (atResults.status === 'fulfilled' && atResults.value) {
      await processResult(atResults.value, 'AniTube');
    }

    if (allSources.length === 0) {
      const errors = [adResult, aqResults, atResults]
        .filter(r => r.status === 'rejected')
        .map(r => (r as PromiseRejectedResult).reason?.message ?? 'erro desconhecido')
        .join('; ');
      return {
        success: false,
        error: `Nenhuma fonte encontrada. ${errors}`,
      };
    }

    // Apply dub URL transform for MP4 sources
    if (isDub && dominantType === 'mp4') {
      const transformed = allSources.map(s => {
        if (!s.url.includes('proxy=') && !s.directUrl) return s;
        let rawDirect = s.directUrl;
        if (!rawDirect) {
          const proxyParam = s.url.split('/?proxy=')[1];
          if (proxyParam) {
            try { rawDirect = decodeURIComponent(proxyParam); } catch { rawDirect = proxyParam; }
          }
        }
        if (!rawDirect) return s;
        const dubUrl = toDubUrl(rawDirect);
        const workerBase = s.origin === 'AnimeQ' ? AQ : s.origin === 'AniTube' ? AT : DA;
        return {
          ...s,
          directUrl: dubUrl,
          url: `${workerBase}/?proxy=${dubUrl}`,
        };
      });
      return { success: true, sources: transformed, type: dominantType };
    }

    return { success: true, sources: allSources, type: dominantType, embedUrl };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[DriveA] Erro:', msg);
    return { success: false, error: msg };
  }
};
