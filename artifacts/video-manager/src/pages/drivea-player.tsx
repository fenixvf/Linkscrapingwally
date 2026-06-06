import { useState, useRef } from "react";
import {
  loadDriveA,
  buildDriveACandidates,
  type AnimeInfo,
  type DriveASource,
} from "@/services/drivea";
import {
  useCreateLink,
  useCreateBackup,
  useListFolders,
  getListFoldersQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertCircle,
  Play,
  Loader2,
  ExternalLink,
  Film,
  Globe,
  Tv,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  BookmarkPlus,
  FolderOpen,
  Info,
  VideoOff,
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
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  // ── Search form ────────────────────────────────────────────────────────────
  const [title, setTitle] = useState("");
  const [titleEn, setTitleEn] = useState("");
  const [titlePt, setTitlePt] = useState("");
  const [episode, setEpisode] = useState("1");
  const [animeType, setAnimeType] = useState("TV");
  const [isDub, setIsDub] = useState(false);
  const [atDirectSlug, setAtDirectSlug] = useState("");
  const [selectedSource, setSelectedSource] = useState(0);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showCandidates, setShowCandidates] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [videoError, setVideoError] = useState(false);

  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [result, setResult] = useState<PlayerResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const videoRef = useRef<HTMLVideoElement>(null);

  // ── Save as Link dialog ────────────────────────────────────────────────────
  const [isSaveOpen, setIsSaveOpen] = useState(false);
  const [saveTitle, setSaveTitle] = useState("");
  const [saveFolderId, setSaveFolderId] = useState<string>("none");
  const [saveEpisodeOrder, setSaveEpisodeOrder] = useState("");
  const [saveNotes, setSaveNotes] = useState("");
  const [saveBackups, setSaveBackups] = useState(true);

  const { data: folders } = useListFolders({
    query: { queryKey: getListFoldersQueryKey() },
  });
  const createLink = useCreateLink();
  const createBackup = useCreateBackup();

  // ── Derived ────────────────────────────────────────────────────────────────
  const animeInfo: AnimeInfo = {
    title: title.trim(),
    title_english: titleEn.trim() || undefined,
    title_portuguese: titlePt.trim() || undefined,
    type: animeType,
  };

  const candidates = title.trim() ? buildDriveACandidates(animeInfo, isDub) : [];
  const currentSource = result?.sources[selectedSource];

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleLoad = async () => {
    if (!title.trim()) { toast.error("Informe o título do anime."); return; }
    const ep = parseInt(episode, 10);
    if (isNaN(ep) || ep < 1) { toast.error("Número de episódio inválido."); return; }

    setLoadState("loading");
    setResult(null);
    setErrorMsg("");
    setSelectedSource(0);
    setVideoError(false);

    const res = await loadDriveA(animeInfo, ep, isDub, {
      atDirectSlug: atDirectSlug.trim() || undefined,
    });
    if (!res.success) {
      setLoadState("error");
      setErrorMsg(res.error);
      return;
    }

    setResult({ type: res.type, sources: res.sources, embedUrl: res.embedUrl });
    setLoadState("success");
    toast.success(`Fonte encontrada — ${res.type.toUpperCase()}`);
  };

  const openSaveDialog = () => {
    const ep = parseInt(episode, 10);
    const dubSuffix = isDub ? " [DUB]" : "";
    setSaveTitle(`${title.trim()} - Ep ${ep}${dubSuffix}`);
    setSaveEpisodeOrder(String(ep));
    setSaveNotes("");
    setSaveFolderId("none");
    setIsSaveOpen(true);
  };

  const handleSave = () => {
    if (!saveTitle.trim()) { toast.error("Informe um título para o link."); return; }
    if (!result || !currentSource) return;

    const primaryUrl = currentSource.url;
    const episodeOrder = saveEpisodeOrder ? parseInt(saveEpisodeOrder, 10) : undefined;

    createLink.mutate(
      {
        data: {
          title: saveTitle.trim(),
          url: primaryUrl,
          folderId: saveFolderId !== "none" ? Number(saveFolderId) : undefined,
          notes: saveNotes.trim() || undefined,
        },
      },
      {
        onSuccess: async (created: { id: number }) => {
          queryClient.invalidateQueries({ queryKey: ["getListLinks"] });

          // Set episodeOrder via PATCH if provided
          if (episodeOrder !== undefined && !isNaN(episodeOrder)) {
            await fetch(`/api/links/${created.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ episodeOrder }),
            }).catch(() => {});
          }

          // Save remaining sources as backup links
          if (saveBackups && result.sources.length > 1) {
            const backups = result.sources.filter((_, i) => i !== selectedSource);
            for (const b of backups) {
              await createBackup
                .mutateAsync({ id: created.id, data: { url: b.url, label: b.label } })
                .catch(() => {});
            }
          }

          setIsSaveOpen(false);
          toast.success("Link salvo com sucesso!");
          setLocation(`/links/${created.id}`);
        },
        onError: (err: Error) => {
          toast.error(`Erro ao salvar: ${err.message}`);
        },
      }
    );
  };

  const copyUrl = (url: string, idx: number) => {
    navigator.clipboard.writeText(url).then(() => {
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 2000);
    });
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto w-full space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Film className="w-7 h-7 text-primary" />
          DriveA Player
        </h1>
        <p className="text-muted-foreground mt-1">
          Busca e reproduz episódios via AnimesDrive. Salve como link para gerenciar depois.
        </p>
      </div>

      {/* ── Search form ─────────────────────────────────────────────────────── */}
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
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLoad()}
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
                  onKeyDown={(e) => e.key === "Enter" && handleLoad()}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Select value={animeType} onValueChange={setAnimeType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ANIME_TYPES.map((t) => (
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

          {/* AniTube direct URL */}
          <div className="space-y-1.5 rounded-md border border-cyan-500/25 bg-cyan-500/5 p-3">
            <Label className="text-xs flex items-center gap-1.5 text-cyan-600 dark:text-cyan-400 font-medium">
              <Globe className="w-3.5 h-3.5" />
              URL direta do AniTube <span className="text-muted-foreground font-normal">(opcional)</span>
            </Label>
            <Input
              placeholder="Ex: https://www.anitube.zip/video/1037840/"
              value={atDirectSlug}
              onChange={(e) => setAtDirectSlug(e.target.value.trim())}
            />
            {atDirectSlug ? (
              <p className="text-[11px] text-cyan-600 dark:text-cyan-400 font-mono break-all">
                → {atDirectSlug.startsWith("http")
                    ? atDirectSlug.replace(/\/$/, "") + "/"
                    : `https://www.anitube.zip/${atDirectSlug.replace(/^\/|\/$/g, "")}/`}
              </p>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                Cole a URL do episódio no AniTube para usar diretamente, sem busca por título.
              </p>
            )}
          </div>

          {/* Advanced titles */}
          <div>
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
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

          {/* Slug preview */}
          {candidates.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setShowCandidates((v) => !v)}
                className="text-xs text-muted-foreground flex items-center gap-1 hover:text-foreground transition-colors"
              >
                {showCandidates ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                Ver slugs que serão testados ({candidates.length})
              </button>
              {showCandidates && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {candidates.map((c) => (
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
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Buscando...</>
            ) : (
              <><Play className="w-4 h-4 mr-2" />Carregar Episódio</>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* ── Error state ─────────────────────────────────────────────────────── */}
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

      {/* ── Player ──────────────────────────────────────────────────────────── */}
      {loadState === "success" && result && (
        <Card className="border-border/50 bg-card/50 backdrop-blur">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Play className="w-4 h-4 text-primary" />
                {title} — Ep {episode}
                {isDub && (
                  <Badge className="bg-orange-500/10 text-orange-500 border-orange-500/20 text-xs">DUB</Badge>
                )}
              </CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono uppercase text-xs">{result.type}</Badge>
                <Button size="sm" onClick={openSaveDialog}>
                  <BookmarkPlus className="w-4 h-4 mr-2" />
                  Salvar como Link
                </Button>
              </div>
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
                      setVideoError(false);
                      if (videoRef.current) {
                        videoRef.current.load();
                        videoRef.current.play().catch(() => {});
                      }
                    }}
                    className="flex items-center gap-1.5"
                  >
                    {s.label}
                    {s.origin && (
                      <span className={`text-[10px] px-1 py-0.5 rounded font-mono leading-none ${
                        s.origin === "AnimeQ"
                          ? "bg-violet-500/20 text-violet-400"
                          : s.origin === "AniTube"
                          ? "bg-cyan-500/20 text-cyan-400"
                          : "bg-amber-500/20 text-amber-400"
                      }`}>
                        {s.origin === "AnimesDrive" ? "AD" : s.origin === "AnimeQ" ? "AQ" : "AT"}
                      </span>
                    )}
                  </Button>
                ))}
              </div>
            )}

            {/* MP4 native player */}
            {result.type === "mp4" && currentSource && (
              <>
                {videoError ? (
                  <div className="rounded-lg overflow-hidden bg-black aspect-video flex flex-col items-center justify-center gap-3 text-muted-foreground px-6">
                    <VideoOff className="w-12 h-12 opacity-40" />
                    <p className="text-sm text-center max-w-xs">
                      O player integrado não conseguiu reproduzir este vídeo.
                    </p>
                    <div className="flex flex-wrap gap-2 justify-center">
                      {currentSource.directUrl && currentSource.directUrl !== currentSource.url && (
                        <a href={currentSource.directUrl} target="_blank" rel="noopener noreferrer">
                          <Button variant="outline" size="sm">
                            <ExternalLink className="w-4 h-4 mr-2" />
                            Abrir URL direta
                          </Button>
                        </a>
                      )}
                      <a href={currentSource.url} target="_blank" rel="noopener noreferrer">
                        <Button variant="outline" size="sm">
                          <ExternalLink className="w-4 h-4 mr-2" />
                          {currentSource.directUrl && currentSource.directUrl !== currentSource.url
                            ? "Abrir via proxy"
                            : "Abrir em nova aba"}
                        </Button>
                      </a>
                    </div>
                    <p className="text-[11px] text-center opacity-60 max-w-xs">
                      URL direta funciona se o CDN permitir acesso sem Referer.
                      Proxy funciona se o worker suportar streaming.
                    </p>
                  </div>
                ) : (
                  <div className="rounded-lg overflow-hidden bg-black aspect-video">
                    <video
                      ref={videoRef}
                      key={currentSource.url}
                      controls
                      autoPlay
                      className="w-full h-full"
                      onError={() => setVideoError(true)}
                    >
                      <source src={currentSource.url} type="video/mp4" />
                    </video>
                  </div>
                )}
              </>
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

            {/* Info banner */}
            <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/40 rounded-md px-3 py-2">
              <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>
                Clique em <strong>Salvar como Link</strong> para armazenar esta fonte no sistema,
                adicionar a uma pasta, definir ordem de episódio e criar backups automáticos com as demais fontes.
              </span>
            </div>

            {/* Sources list */}
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                Fontes disponíveis
              </p>
              {result.sources.map((s, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-2 p-2 rounded-md border text-sm transition-colors ${
                    selectedSource === i
                      ? "border-primary/40 bg-primary/5"
                      : "border-border/50 bg-background/40"
                  }`}
                >
                  <span className="font-medium shrink-0 min-w-[80px]">{s.label}</span>
                  {s.origin && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono shrink-0 ${
                      s.origin === "AnimeQ"
                        ? "bg-violet-500/15 text-violet-400 border border-violet-500/20"
                        : s.origin === "AniTube"
                        ? "bg-cyan-500/15 text-cyan-400 border border-cyan-500/20"
                        : "bg-amber-500/15 text-amber-400 border border-amber-500/20"
                    }`}>
                      {s.origin}
                    </span>
                  )}
                  <span className="font-mono text-xs text-muted-foreground truncate flex-1">{s.url}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={() => copyUrl(s.url, i)}
                      title="Copiar URL"
                    >
                      {copiedIdx === i ? (
                        <Check className="w-3 h-3 text-emerald-500" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
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

      {/* ── Save as Link dialog ─────────────────────────────────────────────── */}
      <Dialog open={isSaveOpen} onOpenChange={setIsSaveOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookmarkPlus className="w-5 h-5 text-primary" />
              Salvar como Link
            </DialogTitle>
            <DialogDescription>
              A fonte selecionada ({currentSource?.label}) será salva como link principal.
              {result && result.sources.length > 1 && saveBackups && (
                <> As outras {result.sources.length - 1} fonte(s) serão salvas como backup.</>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-1">
            {/* Title */}
            <div className="space-y-1.5">
              <Label>Título *</Label>
              <Input
                value={saveTitle}
                onChange={(e) => setSaveTitle(e.target.value)}
                placeholder="Ex: Re:Zero - Ep 01"
              />
            </div>

            {/* Folder */}
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <FolderOpen className="w-3.5 h-3.5" />
                Pasta
              </Label>
              <Select value={saveFolderId} onValueChange={setSaveFolderId}>
                <SelectTrigger>
                  <SelectValue placeholder="Sem pasta" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem pasta</SelectItem>
                  {folders?.map((f: { id: number; name: string }) => (
                    <SelectItem key={f.id} value={String(f.id)}>
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Episode order */}
            <div className="space-y-1.5">
              <Label>Ordem do episódio</Label>
              <Input
                type="number"
                min={1}
                placeholder="Ex: 1"
                value={saveEpisodeOrder}
                onChange={(e) => setSaveEpisodeOrder(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Usado para ordenar episódios dentro de uma pasta.
              </p>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label>Notas (opcional)</Label>
              <Textarea
                placeholder="Observações sobre este episódio..."
                value={saveNotes}
                onChange={(e) => setSaveNotes(e.target.value)}
                rows={2}
              />
            </div>

            {/* Save backups toggle */}
            {result && result.sources.length > 1 && (
              <div className="flex items-center gap-3 pt-1">
                <Switch
                  id="save-backups"
                  checked={saveBackups}
                  onCheckedChange={setSaveBackups}
                />
                <Label htmlFor="save-backups" className="cursor-pointer text-sm">
                  Salvar outras fontes como backup
                  <span className="block text-xs text-muted-foreground font-normal">
                    {result.sources.length - 1} fonte(s) adicional(is) disponível(is)
                  </span>
                </Label>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsSaveOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={createLink.isPending || !saveTitle.trim()}
            >
              {createLink.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Salvando...</>
              ) : (
                <><BookmarkPlus className="w-4 h-4 mr-2" />Salvar Link</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
