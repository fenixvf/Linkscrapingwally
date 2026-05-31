import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useGetLink, useCheckLink, useUpdateLink, useDeleteLink, useMoveLink, getGetLinkQueryKey, useListFolders, getListFoldersQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, RefreshCw, Trash2, FolderOutput, CalendarClock, Copy, Globe } from "lucide-react";
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
  const { data: folders } = useListFolders({ query: { queryKey: getListFoldersQueryKey() } });

  const checkLink = useCheckLink();
  const updateLink = useUpdateLink();
  const deleteLink = useDeleteLink();
  const moveLink = useMoveLink();

  const [notes, setNotes] = useState("");
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [isMoveOpen, setIsMoveOpen] = useState(false);
  const [isEditingPageUrl, setIsEditingPageUrl] = useState(false);
  const [pageUrlInput, setPageUrlInput] = useState("");
  const [targetFolderId, setTargetFolderId] = useState<string>("none");

  if (link && notes === "" && link.notes && !isEditingNotes) {
    setNotes(link.notes);
  }

  const handleCheck = () => {
    checkLink.mutate({ id }, {
      onSuccess: (res) => {
        queryClient.invalidateQueries({ queryKey: getGetLinkQueryKey(id) });
        if (res.refreshedUrl) {
          toast.success("URL do vídeo atualizado com sucesso!");
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

  const handleSaveNotes = () => {
    updateLink.mutate({ id, data: { notes } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetLinkQueryKey(id) });
        setIsEditingNotes(false);
        toast.success("Notas atualizadas");
      }
    });
  };

  const handleSavePageUrl = () => {
    updateLink.mutate({ id, data: { pageUrl: pageUrlInput.trim() } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetLinkQueryKey(id) });
        setIsEditingPageUrl(false);
        toast.success("URL da página salva");
      }
    });
  };

  const handleMove = () => {
    moveLink.mutate({ id, data: { folderId: targetFolderId === "none" ? null : Number(targetFolderId) } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetLinkQueryKey(id) });
        setIsMoveOpen(false);
        toast.success("Link movido com sucesso");
      }
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado!");
  };

  if (isLoading) {
    return <div className="p-8 text-center">Carregando...</div>;
  }

  if (!link) {
    return <div className="p-8 text-center text-destructive">Link não encontrado.</div>;
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active": return <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 px-3 py-1">Ativo</Badge>;
      case "expired": return <Badge variant="destructive" className="bg-destructive/10 text-destructive border-destructive/20 px-3 py-1">Expirado</Badge>;
      case "checking": return <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20 px-3 py-1">Verificando...</Badge>;
      default: return <Badge variant="secondary" className="px-3 py-1">Desconhecido</Badge>;
    }
  };

  const displayUrl = link.refreshedUrl || link.url;

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto w-full space-y-8">
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
            variant="outline"
            onClick={handleCheck}
            disabled={checkLink.isPending}
            className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/20"
            data-testid="button-check-status"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${checkLink.isPending ? 'animate-spin' : ''}`} />
            {checkLink.isPending ? "Verificando..." : "Verificar / Atualizar"}
          </Button>
          <Button variant="destructive" onClick={handleDelete} data-testid="button-delete">
            <Trash2 className="w-4 h-4 mr-2" />
            Deletar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: player + title */}
        <div className="lg:col-span-2 space-y-6">
          <div>
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <h1 className="text-3xl font-bold tracking-tight">{link.title}</h1>
              {getStatusBadge(link.status)}
            </div>
            {link.folderName && (
              <p className="text-muted-foreground">na pasta: <span className="font-medium text-foreground">{link.folderName}</span></p>
            )}
          </div>

          <Card className="border-border/50 bg-black overflow-hidden shadow-xl shadow-black/50">
            <div className="aspect-video w-full bg-black relative flex items-center justify-center">
              {link.status === "expired" && !link.refreshedUrl ? (
                <div className="text-center p-6 text-destructive/80">
                  <RefreshCw className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p className="font-medium mb-1">Link expirado</p>
                  <p className="text-sm opacity-70">Clique em "Verificar / Atualizar" para tentar renovar.</p>
                </div>
              ) : (
                <video
                  key={displayUrl}
                  src={displayUrl}
                  controls
                  className="w-full h-full object-contain"
                  data-testid="video-player"
                >
                  Seu navegador não suporta o player de vídeo.
                </video>
              )}
            </div>
          </Card>

          {/* Page URL section */}
          <Card className="border-border/50 bg-card/50 backdrop-blur">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-muted-foreground" />
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Página Fonte</CardTitle>
              </div>
              {!isEditingPageUrl && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs px-2"
                  onClick={() => { setPageUrlInput(link.pageUrl ?? ""); setIsEditingPageUrl(true); }}
                  data-testid="button-edit-page-url"
                >
                  {link.pageUrl ? "Editar" : "Adicionar"}
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {isEditingPageUrl ? (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">URL da página onde o vídeo está hospedado</Label>
                  <Input
                    value={pageUrlInput}
                    onChange={(e) => setPageUrlInput(e.target.value)}
                    placeholder="https://site.com/pagina-do-video"
                    type="url"
                    className="bg-background/50"
                    data-testid="input-page-url"
                  />
                  <p className="text-xs text-muted-foreground">Ao verificar, o sistema abrirá esta página e extrairá o novo URL do vídeo automaticamente.</p>
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setIsEditingPageUrl(false)}>Cancelar</Button>
                    <Button size="sm" onClick={handleSavePageUrl} disabled={updateLink.isPending} data-testid="button-save-page-url">Salvar</Button>
                  </div>
                </div>
              ) : link.pageUrl ? (
                <div className="space-y-1">
                  <a
                    href={link.pageUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm font-mono break-all text-primary hover:underline"
                    data-testid="link-page-url"
                  >
                    {link.pageUrl}
                  </a>
                  <p className="text-xs text-muted-foreground mt-1">Ao verificar, o sistema scrapeará esta página para encontrar o URL atualizado.</p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  Nenhuma página fonte definida. Adicione para renovação automática via scraping.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: URLs, notes, last checked */}
        <div className="space-y-6">
          <Card className="border-border/50 bg-card/50 backdrop-blur">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">URLs</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
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

              {link.refreshedUrl && link.refreshedUrl !== link.url && (
                <>
                  <Separator />
                  <div className="space-y-1">
                    <div className="text-xs text-emerald-500/80 flex justify-between">
                      URL Atualizado
                      <button onClick={() => copyToClipboard(link.refreshedUrl!)} className="hover:text-emerald-500" data-testid="button-copy-refreshed-url">
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                    <a href={link.refreshedUrl} target="_blank" rel="noreferrer" className="block text-sm font-mono break-all text-emerald-500 hover:underline" title={link.refreshedUrl}>
                      {link.refreshedUrl}
                    </a>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

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
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Adicione notas sobre este vídeo..."
                    className="min-h-[100px] resize-none text-sm bg-background/50"
                    data-testid="textarea-notes"
                  />
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

      <Dialog open={isMoveOpen} onOpenChange={setIsMoveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mover Link</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Selecionar pasta de destino</label>
              <Select value={targetFolderId} onValueChange={setTargetFolderId}>
                <SelectTrigger data-testid="select-target-folder">
                  <SelectValue placeholder="Selecionar pasta" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma (Raiz)</SelectItem>
                  {folders?.map(f => (
                    <SelectItem key={f.id} value={f.id.toString()}>{f.name}</SelectItem>
                  ))}
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
