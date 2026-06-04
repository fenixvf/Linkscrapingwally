const DA = 'https://drivea.masterotaku487.workers.dev';
const AD_BASE = 'https://animesdrive.online';

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
}

export interface DriveAResult {
  type: 'mp4' | 'iframe';
  sources: DriveASource[];
  embedUrl?: string;
}

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

const buildEpisodeUrl = (slug: string, ep: number, isMovie = false): string =>
  isMovie
    ? `${AD_BASE}/episodio/${slug}`
    : `${AD_BASE}/episodio/${slug}-episodio-${epStr(ep)}`;

const probeDriveA = async (
  slug: string,
  ep: number,
  isMovie = false,
): Promise<{ slug: string; results: unknown[] } | null> => {
  const epUrl = buildEpisodeUrl(slug, ep, isMovie);
  const workerUrl = `${DA}/?url=${encodeURIComponent(epUrl)}`;
  try {
    const res = await fetch(workerUrl, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) return null;
    const data = await res.json() as { success: boolean; results?: unknown[] };
    if (data.success && data.results && data.results.length > 0) {
      return { slug, results: data.results };
    }
  } catch {
    // ignore
  }
  return null;
};

export const resolveDriveA = async (
  anime: AnimeInfo,
  ep: number,
  dub = false,
): Promise<{ slug: string; results: unknown[] }> => {
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

interface RawResult {
  type?: string;
  proxyUrl?: string;
  url?: string;
  label?: string;
  isBlogger?: boolean;
  resolveUrl?: string;
}

export const pickBestDriveASource = async (results: unknown[]): Promise<DriveAResult> => {
  const raw = results as RawResult[];

  const mp4s = raw.filter(r => r.type === 'mp4' && r.proxyUrl);
  if (mp4s.length > 0) {
    return {
      type: 'mp4',
      sources: mp4s.map(r => ({
        label: r.label ?? 'MP4',
        url: r.proxyUrl!,
        directUrl: r.url,
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
            url: `${DA}/?proxy=${encodeURIComponent(s.url)}`,
            directUrl: s.url,
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
      })),
    };
  }

  throw new Error('Nenhuma fonte válida encontrada no DriveA');
};

export const loadDriveA = async (
  anime: AnimeInfo,
  ep: number,
  isDub: boolean,
): Promise<{ success: true; sources: DriveASource[]; type: 'mp4' | 'iframe'; embedUrl?: string } | { success: false; error: string }> => {
  try {
    const adResult = await resolveDriveA(anime, ep, isDub);
    const picked = await pickBestDriveASource(adResult.results);

    if (picked.type === 'mp4') {
      let sources = picked.sources;
      if (isDub) {
        sources = sources.map(s => {
          const dubUrl = toDubUrl(s.directUrl ?? s.url);
          return {
            ...s,
            directUrl: dubUrl,
            url: `${DA}/?proxy=${encodeURIComponent(dubUrl)}`,
          };
        });
      }
      return { success: true, sources, type: 'mp4' };
    }

    if (picked.type === 'iframe') {
      return { success: true, type: 'iframe', embedUrl: picked.embedUrl, sources: picked.sources };
    }

    return { success: false, error: 'Tipo de fonte desconhecido' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[DriveA] Erro:', msg);
    return { success: false, error: msg };
  }
};
