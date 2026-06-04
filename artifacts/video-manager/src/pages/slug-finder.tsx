import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Search,
  Loader2,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  ExternalLink,
  Hash,
  Link as LinkIcon,
} from "lucide-react";
import { toast } from "sonner";

const DA = "https://drivea.masterotaku487.workers.dev";
const AD_BASE = "https://animesdrive.online";

interface ProbeResult {
  status: "idle" | "checking" | "found" | "notfound";
  proxyUrls: string[];
  directUrls: string[];
  slug: string;
}

const epStr = (ep: number) => String(ep).padStart(2, "0");

function extractSlug(input: string): string | null {
  let url = input.trim();
  if (!url) return null;

  try {
    const parsed = new URL(url.startsWith("http") ? url : "https://" + url);
    const path = parsed.pathname.replace(/\/$/, "");
    const segments = path.split("/").filter(Boolean);
    if (segments.length === 0) return null;

    const last = segments[segments.length - 1];

    // /episodio/re-zero-4-episodio-01  →  re-zero-4
    if (segments.includes("episodio")) {
      return last.replace(/-episodio-\d+$/, "");
    }

    // /anime/re-zero-4  →  re-zero-4
    return last;
  } catch {
    // Not a URL — treat raw input as slug directly
    return input.trim() || null;
  }
}

async function probeSlug(
  slug: string,
  ep: number,
  isDub: boolean
): Promise<{ found: boolean; proxyUrls: string[]; directUrls: string[] }> {
  const epNum = epStr(ep);
  const epUrl = `${AD_BASE}/episodio/${slug}-episodio-${epNum}`;
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
        isBlogger?: boolean;
        resolveUrl?: string;
      }>;
    };

    if (!data.success || !data.results?.length) {
      return { found: false, proxyUrls: [], directUrls: [] };
    }

    const mp4s = data.results.filter((r) => r.type === "mp4" && (r.proxyUrl || r.url));

    const proxyUrls: string[] = [];
    const directUrls: string[] = [];

    for (const r of mp4s) {
      // Prefer r.url; if absent, decode it from the proxyUrl parameter
      let direct = r.url ?? "";
      if (!direct && r.proxyUrl) {
        const proxyParam = r.proxyUrl.split("/?proxy=")[1];
        if (proxyParam) {
          try { direct = decodeURIComponent(proxyParam); } catch { direct = proxyParam; }
        }
      }

      if (isDub) {
        // Insert /Dub/ before the filename
        const i = direct.lastIndexOf("/");
        if (i !== -1 && !direct.includes("/Dub/")) {
          direct = direct.slice(0, i) + "/Dub" + direct.slice(i);
        }
        proxyUrls.push(`${DA}/?proxy=${direct}`);
      } else {
        proxyUrls.push(r.proxyUrl ?? `${DA}/?proxy=${encodeURIComponent(direct)}`);
      }
      directUrls.push(direct);
    }

    if (proxyUrls.length > 0) {
      return { found: true, proxyUrls, directUrls };
    }
  } catch {
    // ignore
  }
  return { found: false, proxyUrls: [], directUrls: [] };
}

export default function SlugFinderPage() {
  const [animeUrl, setAnimeUrl] = useState("");
  const [episode, setEpisode] = useState("1");
  const [isDub, setIsDub] = useState(false);

  const [result, setResult] = useState<ProbeResult | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const slug = extractSlug(animeUrl);

  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    });
  };

  const handleSearch = async () => {
    if (!slug) {
      toast.error("Cole a URL da página do anime ou o slug.");
      return;
    }
    const ep = parseInt(episode, 10);
    if (isNaN(ep) || ep < 1) {
      toast.error("Número de episódio inválido.");
      return;
    }

    setResult({ status: "checking", proxyUrls: [], directUrls: [], slug });

    const { found, proxyUrls, directUrls } = await probeSlug(slug, ep, isDub);

    setResult({
      status: found ? "found" : "notfound",
      proxyUrls,
      directUrls,
      slug,
    });

    if (found) {
      toast.success(`Slug encontrado: ${slug}`);
    } else {
      toast.error(`Nenhuma fonte encontrada para "${slug}" - Ep ${ep}`);
    }
  };

  const isChecking = result?.status === "checking";

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto w-full space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Hash className="w-7 h-7 text-primary" />
          Slug Finder
        </h1>
        <p className="text-muted-foreground mt-1">
          Cole a URL da página do anime no AnimesDrive para descobrir as URLs de proxy prontas.
        </p>
      </div>

      {/* ── Form ─────────────────────────────────────────────────────────────── */}
      <Card className="border-border/50 bg-card/50 backdrop-blur">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <LinkIcon className="w-4 h-4" />
            URL do Anime
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>URL da página do anime *</Label>
            <Input
              placeholder="Ex: https://animesdrive.online/anime/re-zero-4"
              value={animeUrl}
              onChange={(e) => setAnimeUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !isChecking && handleSearch()}
            />
            {slug && animeUrl && (
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Hash className="w-3 h-3" />
                Slug detectado:{" "}
                <code className="font-mono text-foreground">{slug}</code>
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Episódio</Label>
              <Input
                type="number"
                min={1}
                placeholder="1"
                value={episode}
                onChange={(e) => setEpisode(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !isChecking && handleSearch()}
              />
            </div>
            <div className="flex items-end pb-0.5">
              <div className="flex items-center gap-3">
                <Switch
                  id="dub-toggle"
                  checked={isDub}
                  onCheckedChange={setIsDub}
                />
                <Label htmlFor="dub-toggle" className="cursor-pointer">
                  Dublado
                  {isDub && (
                    <Badge className="ml-2 bg-orange-500/10 text-orange-500 border-orange-500/20 text-xs">
                      DUB
                    </Badge>
                  )}
                </Label>
              </div>
            </div>
          </div>

          <Button
            onClick={handleSearch}
            disabled={isChecking || !slug}
            className="w-full md:w-auto"
          >
            {isChecking ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Testando...
              </>
            ) : (
              <>
                <Search className="w-4 h-4 mr-2" />
                Buscar URLs de Proxy
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* ── Result ───────────────────────────────────────────────────────────── */}
      {result && result.status !== "idle" && (
        <Card
          className={
            result.status === "found"
              ? "border-emerald-500/20 bg-emerald-500/5"
              : result.status === "checking"
              ? "border-border/50 bg-card/50"
              : "border-destructive/20 bg-destructive/5"
          }
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              {result.status === "checking" && (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  <span className="text-muted-foreground">Testando slug...</span>
                </>
              )}
              {result.status === "found" && (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span className="text-emerald-600 dark:text-emerald-400">
                    Encontrado
                  </span>
                </>
              )}
              {result.status === "notfound" && (
                <>
                  <XCircle className="w-4 h-4 text-destructive" />
                  <span className="text-destructive">Não encontrado</span>
                </>
              )}
            </CardTitle>
          </CardHeader>

          {result.status !== "idle" && (
            <CardContent className="space-y-4">
              {/* Slug pill */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Slug:</span>
                <code className="text-sm font-mono font-semibold">
                  {result.slug}
                </code>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-xs px-2"
                  onClick={() => copyText(result.slug, "slug")}
                >
                  {copiedKey === "slug" ? (
                    <Check className="w-3 h-3 mr-1 text-emerald-500" />
                  ) : (
                    <Copy className="w-3 h-3 mr-1" />
                  )}
                  Copiar
                </Button>
              </div>

              {/* Proxy URLs */}
              {result.status === "found" && result.proxyUrls.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                    URLs de proxy — Ep {episode}
                    {isDub && (
                      <Badge className="ml-2 bg-orange-500/10 text-orange-500 border-orange-500/20 text-xs normal-case">
                        DUB
                      </Badge>
                    )}
                  </p>
                  {result.proxyUrls.map((url, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 bg-background/60 border border-emerald-500/20 rounded-md px-3 py-2"
                    >
                      <span className="font-mono text-xs text-muted-foreground truncate flex-1">
                        {url}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => copyText(url, `proxy-${i}`)}
                          title="Copiar URL"
                        >
                          {copiedKey === `proxy-${i}` ? (
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </Button>
                        <a href={url} target="_blank" rel="noopener noreferrer">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            title="Abrir em nova aba"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Button>
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Direct URLs */}
              {result.status === "found" && result.directUrls.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                    URLs diretas
                  </p>
                  {result.directUrls.map((url, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 bg-muted/30 rounded-md px-3 py-2"
                    >
                      <span className="font-mono text-xs text-muted-foreground truncate flex-1">
                        {url}
                      </span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 shrink-0"
                        onClick={() => copyText(url, `direct-${i}`)}
                        title="Copiar URL direta"
                      >
                        {copiedKey === `direct-${i}` ? (
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {result.status === "notfound" && (
                <p className="text-sm text-muted-foreground">
                  Nenhuma fonte encontrada para o slug{" "}
                  <code className="font-mono">{result.slug}</code> no episódio{" "}
                  {episode}. Verifique se o slug e episódio estão corretos.
                </p>
              )}
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
}
