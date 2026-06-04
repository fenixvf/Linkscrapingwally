import { useState, useRef } from "react";
import { loadDriveA, buildDriveACandidates, type AnimeInfo, type DriveASource } from "@/services/drivea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertCircle,
  Play,
  Loader2,
  ExternalLink,
  Film,
  Tv,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
} from "lucide-react";
import { toast } from "sonner";

const ANIME_TYPES = ["TV", "Movie", "OVA", "Special", "TV Special", "Music"];

type LoadState = "idle" | "loading" | "success" | "error";

interface PlayerResult {
  type: "mp4" | "iframe";
  sources: DriveASource[];
  embedUrl?: string;
}

export default function DriveAPlayerPage() {
  const [title, setTitle] = useState("");
  const [titleEn, setTitleEn] = useState("");
  const [titlePt, setTitlePt] = useState("");
  const [episode, setEpisode] = useState("1");
  const [animeType, setAnimeType] = useState("TV");
  const [isDub, setIsDub] = useState(false);
  const [selectedSource, setSelectedSource] = useState(0);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showCandidates, setShowCandidates] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [result, setResult] = useState<PlayerResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const videoRef = useRef<HTMLVideoElement>(null);

  const animeInfo: AnimeInfo = {
    title: title.trim(),
    title_english: titleEn.trim() || undefined,
    title_portuguese: titlePt.trim() || undefined,
    type: animeType,
  };

  const candidates = title.trim() ? buildDriveACandidates(animeInfo, isDub) : [];

  const handleLoad = async () => {
    if (!title.trim()) {
      toast.error("Informe o título do anime.");
      return;
    }
    const ep = parseInt(episode, 10);
    if (isNaN(ep) || ep < 1) {
      toast.error("Número de episódio inválido.");
      return;
    }

    setLoadState("loading");
    setResult(null);
    setErrorMsg("");
    setSelectedSource(0);

    const res = await loadDriveA(animeInfo, ep, isDub);

    if (!res.success) {
      setLoadState("error");
      setErrorMsg(res.error);
      return;
    }

    setResult({ type: res.type, sources: res.sources, embedUrl: res.embedUrl });
    setLoadState("success");
    toast.success(`Fonte encontrada — ${res.type.toUpperCase()}`);
  };

  const copyUrl = (url: string, idx: number) => {
    navigator.clipboard.writeText(url).then(() => {
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 2000);
    });
  };

  const currentSource = result?.sources[selectedSource];

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto w-full space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Film className="w-7 h-7 text-primary" />
          DriveA Player
        </h1>
        <p className="text-muted-foreground mt-1">
          Busca e reproduz episódios via AnimesDrive.
        </p>
      </div>

      {/* Search form */}
      <Card className="border-border/50 bg-card/50 backdrop-blur">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Tv className="w-4 h-4" />
            Buscar Episódio
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Título principal *</Label>
              <Input
                placeholder="Ex: Re:Zero kara Hajimeru Isekai Seikatsu"
                value={title}
                onChange={e => setTitle(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleLoad()}
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
                  onChange={e => setEpisode(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleLoad()}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Select value={animeType} onValueChange={setAnimeType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ANIME_TYPES.map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Dub toggle */}
          <div className="flex items-center gap-3">
            <Switch id="dub-toggle" checked={isDub} onCheckedChange={setIsDub} />
            <Label htmlFor="dub-toggle" className="cursor-pointer">
              Dublado
              {isDub && (
                <Badge className="ml-2 bg-orange-500/10 text-orange-500 border-orange-500/20 text-xs">DUB</Badge>
              )}
            </Label>
          </div>

          {/* Advanced titles */}
          <div>
            <button
              type="button"
              onClick={() => setShowAdvanced(v => !v)}
              className="text-xs text-muted-foreground flex items-center gap-1 hover:text-foreground transition-colors"
            >
              {showAdvanced ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              Títulos alternativos (opcional)
            </button>
            {showAdvanced && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Título em inglês</Label>
                  <Input
                    placeholder="Ex: Re:Zero - Starting Life in Another World"
                    value={titleEn}
                    onChange={e => setTitleEn(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Título em português</Label>
                  <Input
                    placeholder="Ex: Re:Zero"
                    value={titlePt}
                    onChange={e => setTitlePt(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Slug candidates preview */}
          {candidates.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setShowCandidates(v => !v)}
                className="text-xs text-muted-foreground flex items-center gap-1 hover:text-foreground transition-colors"
              >
                {showCandidates ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                Ver slugs que serão testados ({candidates.length})
              </button>
              {showCandidates && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {candidates.map(c => (
                    <Badge key={c} variant="secondary" className="font-mono text-xs">{c}</Badge>
                  ))}
                </div>
              )}
            </div>
          )}

          <Button
            onClick={handleLoad}
            disabled={loadState === "loading" || !title.trim()}
            className="w-full md:w-auto"
          >
            {loadState === "loading" ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Buscando...</>
            ) : (
              <><Play className="w-4 h-4 mr-2" /> Carregar Episódio</>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Error state */}
      {loadState === "error" && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="pt-5 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-destructive">Não encontrado</p>
              <p className="text-sm text-muted-foreground mt-1">{errorMsg}</p>
              <p className="text-xs text-muted-foreground mt-2">
                Tente adicionar títulos alternativos ou verificar o tipo do anime.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Player */}
      {loadState === "success" && result && (
        <Card className="border-border/50 bg-card/50 backdrop-blur">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Play className="w-4 h-4 text-primary" />
                {title} — Ep {episode}
                {isDub && <Badge className="bg-orange-500/10 text-orange-500 border-orange-500/20 text-xs">DUB</Badge>}
              </CardTitle>
              <Badge variant="outline" className="font-mono uppercase text-xs">{result.type}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Source selector */}
            {result.sources.length > 1 && (
              <div className="flex flex-wrap gap-2">
                {result.sources.map((s, i) => (
                  <Button
                    key={i}
                    size="sm"
                    variant={selectedSource === i ? "default" : "outline"}
                    onClick={() => {
                      setSelectedSource(i);
                      if (videoRef.current) {
                        videoRef.current.load();
                        videoRef.current.play().catch(() => {});
                      }
                    }}
                  >
                    {s.label}
                  </Button>
                ))}
              </div>
            )}

            {/* MP4 native player */}
            {result.type === "mp4" && currentSource && (
              <div className="rounded-lg overflow-hidden bg-black aspect-video">
                <video
                  ref={videoRef}
                  key={currentSource.url}
                  controls
                  autoPlay
                  className="w-full h-full"
                  onError={() => toast.error("Erro ao carregar o vídeo. Tente outra fonte.")}
                >
                  <source src={currentSource.url} type="video/mp4" />
                  Seu navegador não suporta o elemento de vídeo.
                </video>
              </div>
            )}

            {/* Iframe player */}
            {result.type === "iframe" && (result.embedUrl ?? currentSource?.url) && (
              <div className="rounded-lg overflow-hidden bg-black aspect-video">
                <iframe
                  src={result.embedUrl ?? currentSource?.url}
                  className="w-full h-full border-0"
                  allowFullScreen
                  allow="autoplay; fullscreen; picture-in-picture"
                  title="DriveA Player"
                />
              </div>
            )}

            {/* Sources list */}
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Fontes disponíveis</p>
              {result.sources.map((s, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 p-2 rounded-md border border-border/50 bg-background/40 text-sm"
                >
                  <span className="font-medium shrink-0">{s.label}</span>
                  <span className="font-mono text-xs text-muted-foreground truncate flex-1">{s.url}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={() => copyUrl(s.url, i)}
                      title="Copiar URL"
                    >
                      {copiedIdx === i ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                    </Button>
                    <a href={s.url} target="_blank" rel="noopener noreferrer">
                      <Button size="icon" variant="ghost" className="h-6 w-6" title="Abrir em nova aba">
                        <ExternalLink className="w-3 h-3" />
                      </Button>
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
