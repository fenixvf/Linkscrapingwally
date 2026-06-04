import { useState } from "react";
import { useParams, useLocation } from "wouter";
import {
  useGetLink, useCheckLink, useUpdateLink, useDeleteLink, useMoveLink,
  useListBackups, useCreateBackup, useDeleteBackup, useUpdateBackup,
  getGetLinkQueryKey, getListBackupsQueryKey,
  useListFolders, getListFoldersQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft, RefreshCw, Trash2, FolderOutput, CalendarClock,
  Copy, Globe, ShieldCheck, Plus, GripVertical, AlertTriangle,
  Code2, ChevronDown, ChevronUp, Pencil, Link as LinkIcon,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

export default function LinkDetail() {
  const params = useParams();
  const id = Number(params.id);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data: link, isLoading } = useGetLink(id, { query: { enabled: !!id, queryKey: getGetLinkQueryKey(id) } });
  const { data: backups, isLoading: backupsLoading } = useListBackups(id, { query: { enabled: !!id, queryKey: getListBackupsQueryKey(id) } });
  const { data: folders } = useListFolders({ query: { queryKey: getListFoldersQueryKey() } });

  const checkLink = useCheckLink();
  const updateLink = useUpdateLink();
  const deleteLink = useDeleteLink();
  const moveLink = useMoveLink();
  const createBackup = useCreateBackup();
  const deleteBackup = useDeleteBackup();
  const updateBackup = useUpdateBackup();

  const [notes, setNotes] = useState("");
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [isMoveOpen, setIsMoveOpen] = useState(false);
  const [isEditingPageUrl, setIsEditingPageUrl] = useState(false);
  const [pageUrlInput, setPageUrlInput] = useState("");
  const [targetFolderId, setTargetFolderId] = useState<string>("none");
  const [isEditingUrl, setIsEditingUrl] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState("");
  const [isEditingEpisode, setIsEditingEpisode] = useState(false);
  const [episodeInput, setEpisodeInput] = useState("");

  const [isIntegrationOpen, setIsIntegrationOpen] = useState(false);

  // Add backup form
  const [newBackupUrl, setNewBackupUrl] = useState("");
  const [newBackupLabel, setNewBackupLabel] = useState("");
  const [isAddingBackup, setIsAddingBackup] = useState(false);

  if (link && notes === "" && link.notes && !isEditingNotes) setNotes(link.notes);

  const invalidateLink = () => queryClient.invalidateQueries({ queryKey: getGetLinkQueryKey(id) });
  const invalidateBackups = () => queryClient.invalidateQueries({ queryKey: getListBackupsQueryKey(id) });

  const handleCheck = () => {
    checkLink.mutate({ id }, {
      onSuccess: (res) => {
        invalidateLink();
        invalidateBackups();
        if (res.activeBackupId) {
          toast.success("Link principal falhou — usando backup automaticamente!");
        } else if (res.refreshedUrl) {
          toast.success("URL atualizado com sucesso!");
        } else {
          toast.info(`Status: ${res.status}`);
        }
      }
    });
  };

  const handleDelete = () => {
    if (confirm("Tem certeza que deseja deletar este link?")) {
      deleteLink.mutate({ id }, {
        onSuccess: () => {
          toast.success("Link deletado");
          setLocation(link?.folderId ? `/folders/${link.folderId}` : "/links");
        }
      });
    }
  };

  const handleSaveTitle = () => {
    if (!titleInput.trim()) return;
    updateLink.mutate({ id, data: { title: titleInput.trim() } }, {
      onSuccess: () => { invalidateLink(); setIsEditingTitle(false); toast.success("Nome atualizado"); }
    });
  };

  const handleSaveNotes = () => {
    updateLink.mutate({ id, data: { notes } }, {
      onSuccess: () => { invalidateLink(); setIsEditingNotes(false); toast.success("Notas atualizadas"); }
    });
  };

  const handleSavePageUrl = () => {
    updateLink.mutate({ id, data: { pageUrl: pageUrlInput.trim() } }, {
      onSuccess: () => { invalidateLink(); setIsEditingPageUrl(false); toast.success("URL da página salva"); }
    });
  };

  const handleSaveEpisode = () => {
    const val = episodeInput.trim();
    const parsed = val === "" ? null : parseInt(val, 10);
    if (val !== "" && (isNaN(parsed!) || parsed! < 1)) {
      toast.error("Número de episódio inválido");
      return;
    }
    updateLink.mutate({ id, data: { episodeOrder: parsed } }, {
      onSuccess: () => { invalidateLink(); setIsEditingEpisode(false); toast.success("Episódio atualizado"); }
    });
  };

  const handleSaveUrl = () => {
    if (!urlInput.trim()) return;
    updateLink.mutate({ id, data: { url: urlInput.trim() } }, {
      onSuccess: () => { invalidateLink(); setIsEditingUrl(false); toast.success("URL do vídeo atualizado!"); }
    });
  };

  const handleMove = () => {
    moveLink.mutate({ id, data: { folderId: targetFolderId === "none" ? null : Number(targetFolderId) } }, {
      onSuccess: () => { invalidateLink(); setIsMoveOpen(false); toast.success("Link movido"); }
    });
  };

  const handleAddBackup = () => {
    if (!newBackupUrl.trim()) return;
    createBackup.mutate({ id, data: { url: newBackupUrl.trim(), label: newBackupLabel.trim() || undefined } }, {
      onSuccess: () => {
        invalidateBackups();
        invalidateLink();
        setNewBackupUrl("");
        setNewBackupLabel("");
        setIsAddingBackup(false);
        toast.success("Link reserva adicionado");
      }
    });
  };

  const handleDeleteBackup = (backupId: number) => {
    if (confirm("Remover este link reserva?")) {
      deleteBackup.mutate({ id, backupId }, {
        onSuccess: () => { invalidateBackups(); invalidateLink(); toast.success("Reserva removido"); }
      });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado!");
  };

  if (isLoading) return <div className="p-8 text-center">Carregando...</div>;
  if (!link) return <div className="p-8 text-center text-destructive">Link não encontrado.</div>;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active": return <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 px-3 py-1">Ativo</Badge>;
      case "expired": return <Badge variant="destructive" className="bg-destructive/10 text-destructive border-destructive/20 px-3 py-1">Expirado</Badge>;
      case "checking": return <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20 px-3 py-1">Verificando...</Badge>;
      default: return <Badge variant="secondary" className="px-3 py-1">Desconhecido</Badge>;
    }
  };

  const getBackupStatusDot = (status: string) => {
    switch (status) {
      case "active": return "bg-emerald-500";
      case "expired": return "bg-red-500";
      default: return "bg-gray-400";
    }
  };

  const displayUrl = link.refreshedUrl || link.url;
  const isUsingBackup = !!link.activeBackupId;
  const apiOrigin = import.meta.env.VITE_API_URL ?? window.location.origin;
  const serveUrl = `${apiOrigin}/api/links/${id}/serve`;

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto w-full space-y-8">
      {/* Distribution URL banner */}
      <div className="flex items-center gap-3 bg-primary/10 border border-primary/30 rounded-xl px-4 py-3">
        <LinkIcon className="w-4 h-4 text-primary flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-0.5">URL de Distribuição deste link</p>
          <code className="text-sm font-mono text-foreground truncate block">{serveUrl}</code>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="flex-shrink-0 text-primary hover:text-primary"
          onClick={() => copyToClipboard(serveUrl)}
        >
          <Copy className="w-4 h-4" />
        </Button>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <Button variant="ghost" onClick={() => setLocation(link.folderId ? `/folders/${link.folderId}` : "/links")} className="-ml-4 text-muted-foreground" data-testid="button-back">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" onClick={() => setIsMoveOpen(true)} data-testid="button-move">
            <FolderOutput className="w-4 h-4 mr-2" />
            Mover
          </Button>
          <Button
            onClick={handleCheck}
            disabled={checkLink.isPending}
            className="bg-primary text-primary-foreground"
            data-testid="button-check-status"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${checkLink.isPending ? 'animate-spin' : ''}`} />
            {checkLink.isPending ? "Verificando..." : "Verificar / Atualizar"}
          </Button>
          <Button variant="destructive" onClick={handleDelete} data-testid="button-delete">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: player + backup notice */}
        <div className="lg:col-span-2 space-y-6">
          <div>
            {isEditingTitle ? (
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <Input
                  value={titleInput}
                  onChange={(e) => setTitleInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleSaveTitle(); if (e.key === "Escape") setIsEditingTitle(false); }}
                  className="text-2xl font-bold h-auto py-1 px-2 bg-background/50 flex-1 min-w-0"
                  autoFocus
                  data-testid="input-edit-title"
                />
                <Button size="sm" onClick={handleSaveTitle} disabled={!titleInput.trim() || updateLink.isPending} data-testid="button-save-title">Salvar</Button>
                <Button size="sm" variant="ghost" onClick={() => setIsEditingTitle(false)}>Cancelar</Button>
              </div>
            ) : (
              <div className="flex items-center gap-3 mb-2 flex-wrap">
                <h1 className="text-3xl font-bold tracking-tight">{link.title}</h1>
                <button
                  onClick={() => { setTitleInput(link.title); setIsEditingTitle(true); }}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  title="Editar nome"
                  data-testid="button-edit-title"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                {getStatusBadge(link.status)}
                {isUsingBackup && (
                  <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20 px-3 py-1 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" />
                    Usando backup
                  </Badge>
                )}
              </div>
            )}
            {link.folderName && (
              <p className="text-muted-foreground">na pasta: <span className="font-medium text-foreground">{link.folderName}</span></p>
            )}
          </div>

          {isUsingBackup && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-600 text-sm">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <p>O link principal está indisponível. O sistema ativou automaticamente um link reserva.</p>
            </div>
          )}

          {/* Video player */}
          <Card className="border-border/50 bg-black overflow-hidden shadow-xl shadow-black/50">
            <div className="aspect-video w-full bg-black relative flex items-center justify-center">
              {link.status === "expired" && !link.refreshedUrl ? (
                <div className="text-center p-6 text-destructive/80">
                  <RefreshCw className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p className="font-medium mb-1">Link expirado</p>
                  <p className="text-sm opacity-70">Clique em "Verificar / Atualizar" para tentar renovar.</p>
                </div>
              ) : (
                <video key={displayUrl} src={displayUrl} controls className="w-full h-full object-contain" data-testid="video-player">
                  Seu navegador não suporta o player de vídeo.
                </video>
              )}
            </div>
          </Card>

          {/* Backup Links */}
          <Card className="border-border/50 bg-card/50 backdrop-blur">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-muted-foreground" />
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                  Links Reserva
                  {(backups?.length ?? 0) > 0 && (
                    <span className="ml-2 text-xs font-normal normal-case bg-muted px-1.5 py-0.5 rounded">{backups?.length}</span>
                  )}
                </CardTitle>
              </div>
              <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={() => setIsAddingBackup(true)} data-testid="button-add-backup">
                <Plus className="w-3 h-3 mr-1" />
                Adicionar
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {backupsLoading ? (
                <p className="text-sm text-muted-foreground">Carregando...</p>
              ) : (backups?.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground italic">
                  Nenhum link reserva. Se o principal cair, nada vai substituí-lo.
                </p>
              ) : (
                backups?.map((backup, index) => (
                  <div
                    key={backup.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border text-sm ${
                      link.activeBackupId === backup.id
                        ? "border-amber-500/40 bg-amber-500/5"
                        : "border-border/50 bg-background/40"
                    }`}
                    data-testid={`backup-item-${backup.id}`}
                  >
                    <GripVertical className="w-3.5 h-3.5 text-muted-foreground/40 flex-shrink-0" />
                    <span className="text-xs text-muted-foreground w-4 flex-shrink-0">{index + 1}</span>
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${getBackupStatusDot(backup.status)}`} />
                    <div className="flex-1 min-w-0">
                      {backup.label && <div className="font-medium text-xs text-foreground mb-0.5">{backup.label}</div>}
                      <div className="font-mono text-xs text-muted-foreground truncate">{backup.url}</div>
                    </div>
                    {link.activeBackupId === backup.id && (
                      <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20 text-xs flex-shrink-0">Ativo</Badge>
                    )}
                    <button
                      onClick={() => copyToClipboard(backup.url)}
                      className="text-muted-foreground hover:text-foreground flex-shrink-0"
                      data-testid={`button-copy-backup-${backup.id}`}
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => handleDeleteBackup(backup.id)}
                      className="text-muted-foreground hover:text-destructive flex-shrink-0"
                      data-testid={`button-delete-backup-${backup.id}`}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))
              )}

              {isAddingBackup && (
                <div className="border border-border rounded-lg p-3 space-y-2 mt-2 bg-background/60">
                  <div className="space-y-1">
                    <Label className="text-xs">URL do Link Reserva</Label>
                    <Input
                      value={newBackupUrl}
                      onChange={(e) => setNewBackupUrl(e.target.value)}
                      placeholder="https://outro-servidor.com/video.mp4"
                      type="url"
                      className="h-8 text-sm"
                      data-testid="input-backup-url"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Label <span className="text-muted-foreground font-normal">(opcional)</span></Label>
                    <Input
                      value={newBackupLabel}
                      onChange={(e) => setNewBackupLabel(e.target.value)}
                      placeholder="Ex: Servidor 2, Mirror EU"
                      className="h-8 text-sm"
                      data-testid="input-backup-label"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setIsAddingBackup(false)}>Cancelar</Button>
                    <Button size="sm" onClick={handleAddBackup} disabled={!newBackupUrl.trim() || createBackup.isPending} data-testid="button-save-backup">
                      Salvar
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: URLs, page source, notes, last checked */}
        <div className="space-y-6">
          <Card className="border-border/50 bg-card/50 backdrop-blur">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">URLs</CardTitle>
              {!isEditingUrl && (
                <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={() => { setUrlInput(link.url); setIsEditingUrl(true); }} data-testid="button-edit-url">
                  <Pencil className="w-3 h-3 mr-1" />
                  Trocar URL
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {isEditingUrl ? (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Nova URL do Vídeo</Label>
                  <Input
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="https://cdn.exemplo.com/novo-video.mp4"
                    type="url"
                    className="bg-background/50 text-sm"
                    data-testid="input-edit-url"
                  />
                  <p className="text-xs text-muted-foreground">O URL de distribuição (<code>/serve</code>) permanece o mesmo — só o vídeo muda.</p>
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setIsEditingUrl(false)}>Cancelar</Button>
                    <Button size="sm" onClick={handleSaveUrl} disabled={!urlInput.trim() || updateLink.isPending} data-testid="button-save-url">Salvar</Button>
                  </div>
                </div>
              ) : (
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground flex justify-between">
                  URL Original
                  <button onClick={() => copyToClipboard(link.url)} className="hover:text-primary" data-testid="button-copy-original-url">
                    <Copy className="w-3 h-3" />
                  </button>
                </div>
                <a href={link.url} target="_blank" rel="noreferrer" className="block text-sm font-mono break-all text-primary hover:underline" title={link.url}>
                  {link.url}
                </a>
              </div>
              )}

              {link.refreshedUrl && link.refreshedUrl !== link.url && (
                <>
                  <Separator />
                  <div className="space-y-1">
                    <div className={`text-xs flex justify-between ${isUsingBackup ? "text-amber-500/80" : "text-emerald-500/80"}`}>
                      {isUsingBackup ? "URL Backup Ativo" : "URL Atualizado"}
                      <button onClick={() => copyToClipboard(link.refreshedUrl!)} className="hover:text-emerald-500" data-testid="button-copy-refreshed-url">
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                    <a href={link.refreshedUrl} target="_blank" rel="noreferrer" className={`block text-sm font-mono break-all hover:underline ${isUsingBackup ? "text-amber-500" : "text-emerald-500"}`} title={link.refreshedUrl}>
                      {link.refreshedUrl}
                    </a>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Page URL */}
          <Card className="border-border/50 bg-card/50 backdrop-blur">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-muted-foreground" />
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Página Fonte</CardTitle>
              </div>
              {!isEditingPageUrl && (
                <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={() => { setPageUrlInput(link.pageUrl ?? ""); setIsEditingPageUrl(true); }} data-testid="button-edit-page-url">
                  {link.pageUrl ? "Editar" : "Adicionar"}
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {isEditingPageUrl ? (
                <div className="space-y-2">
                  <Input value={pageUrlInput} onChange={(e) => setPageUrlInput(e.target.value)} placeholder="https://site.com/pagina-do-video" type="url" className="bg-background/50" data-testid="input-page-url" />
                  <p className="text-xs text-muted-foreground">O sistema vai scrapeaer esta página para renovar o URL automaticamente.</p>
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setIsEditingPageUrl(false)}>Cancelar</Button>
                    <Button size="sm" onClick={handleSavePageUrl} disabled={updateLink.isPending} data-testid="button-save-page-url">Salvar</Button>
                  </div>
                </div>
              ) : link.pageUrl ? (
                <a href={link.pageUrl} target="_blank" rel="noreferrer" className="text-sm font-mono break-all text-primary hover:underline" data-testid="link-page-url">{link.pageUrl}</a>
              ) : (
                <p className="text-sm text-muted-foreground italic">Nenhuma página fonte definida.</p>
              )}
            </CardContent>
          </Card>

          {/* Episode order */}
          {link.folderId && (
            <Card className="border-border/50 bg-card/50 backdrop-blur">
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Nº do Episódio</CardTitle>
                {!isEditingEpisode && (
                  <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={() => { setEpisodeInput(link.episodeOrder != null ? String(link.episodeOrder) : ""); setIsEditingEpisode(true); }}>
                    {link.episodeOrder != null ? "Editar" : "Definir"}
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {isEditingEpisode ? (
                  <div className="space-y-2">
                    <Input
                      value={episodeInput}
                      onChange={(e) => setEpisodeInput(e.target.value)}
                      placeholder="Ex: 1, 2, 3..."
                      type="number"
                      min={1}
                      className="bg-background/50 text-sm"
                    />
                    <p className="text-xs text-muted-foreground">Define a posição deste link como episódio na pasta. Use via <code>/folders/{link.folderId}/episode/N</code></p>
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setIsEditingEpisode(false)}>Cancelar</Button>
                      <Button size="sm" onClick={handleSaveEpisode} disabled={updateLink.isPending}>Salvar</Button>
                    </div>
                  </div>
                ) : link.episodeOrder != null ? (
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold text-foreground">Ep. {link.episodeOrder}</span>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">Sem número definido.</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Notes */}
          <Card className="border-border/50 bg-card/50 backdrop-blur">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Notas</CardTitle>
              {!isEditingNotes && (
                <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={() => setIsEditingNotes(true)} data-testid="button-edit-notes">Editar</Button>
              )}
            </CardHeader>
            <CardContent>
              {isEditingNotes ? (
                <div className="space-y-2">
                  <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Adicione notas..." className="min-h-[80px] resize-none text-sm bg-background/50" data-testid="textarea-notes" />
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setIsEditingNotes(false)}>Cancelar</Button>
                    <Button size="sm" onClick={handleSaveNotes} disabled={updateLink.isPending} data-testid="button-save-notes">Salvar</Button>
                  </div>
                </div>
              ) : (
                <div className="text-sm whitespace-pre-wrap min-h-[40px] text-muted-foreground" data-testid="text-notes">
                  {link.notes || <span className="italic opacity-50">Sem notas.</span>}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Last checked */}
          <Card className="border-border/50 bg-card/50 backdrop-blur">
            <CardContent className="py-4">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <CalendarClock className="w-4 h-4 opacity-70" />
                <div>
                  <div className="font-medium text-foreground mb-0.5">Última Verificação</div>
                  <span data-testid="text-last-checked">
                    {link.lastChecked ? new Date(link.lastChecked).toLocaleString("pt-BR") : 'Nunca'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Integration panel */}
      {(() => {
        const apiOrigin = import.meta.env.VITE_API_URL ?? window.location.origin;
        const base = `${apiOrigin}/api/links/${id}`;
        const serveUrl = `${base}/serve`;
        const serveAutoUrl = `${base}/serve?autocheck=1`;
        const embedUrl = `${base}/embed`;
        const snippets = [
          {
            label: "Tag <video> — link direto",
            hint: "O browser segue o redirect automaticamente. Funciona em qualquer player HTML5.",
            code: `<video controls>\n  <source src="${serveUrl}" />\n</video>`,
          },
          {
            label: "Tag <video> com verificação automática",
            hint: "Antes de servir, o servidor re-checa e atualiza o URL se estiver expirado.",
            code: `<video controls>\n  <source src="${serveAutoUrl}" />\n</video>`,
          },
          {
            label: "Player via <iframe>",
            hint: "Incorpora o player do VLM Control completo. Aceita ?autoplay=1 e ?muted=1.",
            code: `<iframe\n  src="${embedUrl}"\n  width="100%"\n  style="aspect-ratio:16/9;border:none;"\n  allowfullscreen\n></iframe>`,
          },
          {
            label: "JavaScript / fetch — obter URL ativo",
            hint: "Para usar o URL em qualquer player personalizado (ex: Video.js, Plyr, HLS.js).",
            code: `const res = await fetch("${serveUrl}", { redirect: "manual" });\nconst activeUrl = res.headers.get("Location");\n// use activeUrl no seu player`,
          },
        ];

        return (
          <div className="border border-border/50 rounded-xl overflow-hidden">
            <button
              className="w-full flex items-center justify-between p-4 text-sm font-medium hover:bg-muted/30 transition-colors"
              onClick={() => setIsIntegrationOpen((v) => !v)}
              data-testid="button-toggle-integration"
            >
              <div className="flex items-center gap-2">
                <Code2 className="w-4 h-4 text-muted-foreground" />
                <span>Integrar em outro site</span>
              </div>
              {isIntegrationOpen ? (
                <ChevronUp className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              )}
            </button>

            {isIntegrationOpen && (
              <div className="border-t border-border/50 p-4 space-y-5 bg-muted/10">
                <p className="text-sm text-muted-foreground">
                  O VLM Control serve o link ativo via endpoints públicos. Mesmo que a URL original expire,
                  o outro site continua funcionando — basta clicar em{" "}
                  <strong className="text-foreground">Verificar / Atualizar</strong> aqui.
                </p>

                {/* URL refs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { label: "Serve (redirect)", url: serveUrl },
                    { label: "Embed (iframe)", url: embedUrl },
                  ].map(({ label, url }) => (
                    <div key={url} className="space-y-1">
                      <div className="text-xs text-muted-foreground font-medium">{label}</div>
                      <div className="flex items-center gap-2 bg-background border border-border rounded-lg px-3 py-2">
                        <code className="text-xs text-primary flex-1 truncate">{url}</code>
                        <button
                          onClick={() => { navigator.clipboard.writeText(url); toast.success("Copiado!"); }}
                          className="text-muted-foreground hover:text-foreground flex-shrink-0"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <Separator />

                {/* Code snippets */}
                <div className="space-y-4">
                  {snippets.map((s) => (
                    <div key={s.label} className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-medium text-foreground">{s.label}</div>
                        <button
                          onClick={() => { navigator.clipboard.writeText(s.code); toast.success("Snippet copiado!"); }}
                          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                        >
                          <Copy className="w-3 h-3" />
                          Copiar
                        </button>
                      </div>
                      <p className="text-xs text-muted-foreground">{s.hint}</p>
                      <pre className="bg-background border border-border rounded-lg px-3 py-2.5 text-xs font-mono text-foreground overflow-x-auto whitespace-pre">
                        {s.code}
                      </pre>
                    </div>
                  ))}
                </div>

                <Separator />

                <div className="text-xs text-muted-foreground space-y-1">
                  <p className="font-medium text-foreground">CORS</p>
                  <p>
                    Por padrão todos os domínios são aceitos. Para restringir, defina a variável de ambiente{" "}
                    <code className="bg-muted px-1 rounded">CORS_ORIGINS</code> no servidor com domínios separados por vírgula:
                  </p>
                  <pre className="bg-background border border-border rounded-lg px-3 py-2 font-mono overflow-x-auto">
                    CORS_ORIGINS=https://meusite.com,https://outro.com
                  </pre>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Move dialog */}
      <Dialog open={isMoveOpen} onOpenChange={setIsMoveOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Mover Link</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Selecionar pasta de destino</label>
              <Select value={targetFolderId} onValueChange={setTargetFolderId}>
                <SelectTrigger data-testid="select-target-folder"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma (Raiz)</SelectItem>
                  {folders?.map(f => <SelectItem key={f.id} value={f.id.toString()}>{f.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsMoveOpen(false)}>Cancelar</Button>
            <Button onClick={handleMove} disabled={moveLink.isPending} data-testid="button-confirm-move">Mover</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
