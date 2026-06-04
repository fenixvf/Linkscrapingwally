import { useState } from "react";
import { buildDriveACandidates, type AnimeInfo } from "@/services/drivea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  Loader2,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Hash,
} from "lucide-react";
import { toast } from "sonner";

const DA = "https://drivea.masterotaku487.workers.dev";
const AD_BASE = "https://animesdrive.online";
const ANIME_TYPES = ["TV", "Movie", "OVA", "Special", "TV Special", "Music"];

interface SlugResult {
  slug: string;
  status: "pending" | "checking" | "found" | "notfound";
  proxyUrls: string[];
  directUrls: string[];
}

const epStr = (ep: number) => String(ep).padStart(2, "0");

const buildEpisodeUrl = (slug: string, ep: number, isMovie: boolean) =>
  isMovie
    ? `${AD_BASE}/episodio/${slug}`
    : `${AD_BASE}/episodio/${slug}-episodio-${epStr(ep)}`;

async function probeSlug(
  slug: string,
  ep: number,
  isMovie: boolean
): Promise<{ found: boolean; proxyUrls: string[]; directUrls: string[] }> {
  const epUrl = buildEpisodeUrl(slug, ep, isMovie);
  const workerUrl = `${DA}/?url=${encodeURIComponent(epUrl)}`;
  try {
    const res = await fetch(workerUrl, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) return { found: false, proxyUrls: [], directUrls: [] };
    const data = (await res.json()) as {
      success: boolean;
      results?: Array<{
        type?: string;
        proxyUrl?: string;
        url?: string;
        label?: string;
      }>;
    };
    if (data.success && data.results && data.results.length > 0) {
      const mp4s = data.results.filter((r) => r.type === "mp4" && r.proxyUrl);
      const proxyUrls = mp4s.map((r) => r.proxyUrl!);
      const directUrls = mp4s.map((r) => r.url ?? "");
      return { found: true, proxyUrls, directUrls };
    }
  } catch {
    // ignore
  }
  return { found: false, proxyUrls: [], directUrls: [] };
}

export default function SlugFinderPage() {
  const [title, setTitle] = useState("");
  const [titleEn, setTitleEn] = useState("");
  const [titlePt, setTitlePt] = useState("");
  const [episode, setEpisode] = useState("1");
  const [animeType, setAnimeType] = useState("TV");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [results, setResults] = useState<SlugResult[]>([]);
  const [running, setRunning] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    });
  };

  const handleSearch = async () => {
    if (!title.trim()) {
      toast.error("Informe o título do anime.");
      return;
    }
    const ep = parseInt(episode, 10);
    if (isNaN(ep) || ep < 1) {
      toast.error("Número de episódio inválido.");
      return;
    }

    const anime: AnimeInfo = {
      title: title.trim(),
      title_english: titleEn.trim() || undefined,
      title_portuguese: titlePt.trim() || undefined,
      type: animeType,
    };

    const movieTypes = ["Movie", "OVA", "Special", "TV Special", "Music"];
    const isMovie = movieTypes.includes(animeType);

    const subSlugs = buildDriveACandidates(anime, false);
    const dubSlugs = buildDriveACandidates(anime, true).filter(
      (s) => !subSlugs.includes(s)
    );
    const allSlugs = [...subSlugs, ...dubSlugs];

    const initial: SlugResult[] = allSlugs.map((slug) => ({
      slug,
      status: "pending",
      proxyUrls: [],
      directUrls: [],
    }));
    setResults(initial);
    setRunning(true);

    for (let i = 0; i < allSlugs.length; i++) {
      const slug = allSlugs[i];
      setResults((prev) =>
        prev.map((r) => (r.slug === slug ? { ...r, status: "checking" } : r))
      );
      const { found, proxyUrls, directUrls } = await probeSlug(slug, ep, isMovie);
      setResults((prev) =>
        prev.map((r) =>
          r.slug === slug
            ? { ...r, status: found ? "found" : "notfound", proxyUrls, directUrls }
            : r
        )
      );
    }

    setRunning(false);
    const found = initial.filter((_, i) =>
      allSlugs.slice(0, i + 1).length > 0
    );
    toast.success("Busca concluída!");
  };

  const foundResults = results.filter((r) => r.status === "found");
  const notFoundResults = results.filter((r) => r.status === "notfound");
  const pendingResults = results.filter(
    (r) => r.status === "pending" || r.status === "checking"
  );

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto w-full space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Hash className="w-7 h-7 text-primary" />
          Slug Finder
        </h1>
        <p className="text-muted-foreground mt-1">
          Descobre quais slugs do AnimesDrive funcionam para um anime e gera as URLs de proxy prontas.
        </p>
      </div>

      {/* ── Form ─────────────────────────────────────────────────────────────── */}
      <Card className="border-border/50 bg-card/50 backdrop-blur">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Search className="w-4 h-4" />
            Buscar Slugs
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Título principal *</Label>
              <Input
                placeholder="Ex: Re:Zero kara Hajimeru Isekai Seikatsu"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !running && handleSearch()}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Episódio</Label>
                <Input
                  type="number"
                  min={1}
                  placeholder="1"
                  value={episode}
                  onChange={(e) => setEpisode(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !running && handleSearch()}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Select value={animeType} onValueChange={setAnimeType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ANIME_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div>
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="text-xs text-muted-foreground flex items-center gap-1 hover:text-foreground transition-colors"
            >
              {showAdvanced ? (
                <ChevronUp className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
              Títulos alternativos (opcional)
            </button>
            {showAdvanced && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Título em inglês</Label>
                  <Input
                    placeholder="Ex: Re:Zero - Starting Life in Another World"
                    value={titleEn}
                    onChange={(e) => setTitleEn(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Título em português</Label>
                  <Input
                    placeholder="Ex: Re:Zero"
                    value={titlePt}
                    onChange={(e) => setTitlePt(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>

          <Button
            onClick={handleSearch}
            disabled={running || !title.trim()}
            className="w-full md:w-auto"
          >
            {running ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Testando slugs...
              </>
            ) : (
              <>
                <Search className="w-4 h-4 mr-2" />
                Descobrir Slugs
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* ── Progress / results ────────────────────────────────────────────────── */}
      {results.length > 0 && (
        <div className="space-y-4">
          {/* Summary badges */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm font-medium text-muted-foreground">
              {results.length} slugs testados
            </span>
            {foundResults.length > 0 && (
              <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                {foundResults.length} encontrado{foundResults.length > 1 ? "s" : ""}
              </Badge>
            )}
            {notFoundResults.length > 0 && (
              <Badge variant="outline" className="text-muted-foreground">
                {notFoundResults.length} não encontrado{notFoundResults.length > 1 ? "s" : ""}
              </Badge>
            )}
            {pendingResults.length > 0 && (
              <Badge variant="secondary">
                {pendingResults.length} restante{pendingResults.length > 1 ? "s" : ""}
              </Badge>
            )}
          </div>

          {/* Found slugs */}
          {foundResults.length > 0 && (
            <Card className="border-emerald-500/20 bg-emerald-500/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" />
                  Slugs encontrados
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {foundResults.map((r) => (
                  <div
                    key={r.slug}
                    className="rounded-md border border-emerald-500/20 bg-background/60 p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <code className="text-sm font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                        {r.slug}
                      </code>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        onClick={() => copyText(r.slug, `slug-${r.slug}`)}
                      >
                        {copiedKey === `slug-${r.slug}` ? (
                          <Check className="w-3 h-3 mr-1 text-emerald-500" />
                        ) : (
                          <Copy className="w-3 h-3 mr-1" />
                        )}
                        Copiar slug
                      </Button>
                    </div>

                    {r.proxyUrls.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                          URLs de proxy
                        </p>
                        {r.proxyUrls.map((url, i) => (
                          <div
                            key={i}
                            className="flex items-center gap-2 bg-muted/40 rounded px-2 py-1.5"
                          >
                            <span className="font-mono text-xs text-muted-foreground truncate flex-1">
                              {url}
                            </span>
                            <div className="flex items-center gap-1 shrink-0">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6"
                                onClick={() => copyText(url, `proxy-${url}`)}
                                title="Copiar URL"
                              >
                                {copiedKey === `proxy-${url}` ? (
                                  <Check className="w-3 h-3 text-emerald-500" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </Button>
                              <a
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6"
                                  title="Abrir em nova aba"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                </Button>
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* All slugs progress list */}
          <Card className="border-border/50 bg-card/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">
                Todos os candidatos testados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {results.map((r) => (
                  <div
                    key={r.slug}
                    className="flex items-center gap-3 px-2 py-1.5 rounded-md hover:bg-muted/30 transition-colors"
                  >
                    {r.status === "checking" && (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground shrink-0" />
                    )}
                    {r.status === "found" && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    )}
                    {r.status === "notfound" && (
                      <XCircle className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
                    )}
                    {r.status === "pending" && (
                      <div className="w-3.5 h-3.5 rounded-full border border-muted-foreground/20 shrink-0" />
                    )}
                    <code
                      className={`text-xs font-mono ${
                        r.status === "found"
                          ? "text-emerald-600 dark:text-emerald-400 font-semibold"
                          : "text-muted-foreground"
                      }`}
                    >
                      {r.slug}
                    </code>
                    {r.status === "found" && r.proxyUrls.length > 0 && (
                      <Badge className="ml-auto text-xs bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                        {r.proxyUrls.length} URL{r.proxyUrls.length > 1 ? "s" : ""}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
