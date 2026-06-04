import { useState } from "react";
import { useGetFolder, useListLinks, useCreateLink, useDeleteLink, useCheckLink, getGetFolderQueryKey, getListLinksQueryKey } from "@workspace/api-client-react";
import { useParams, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Folder, Plus, ArrowLeft, RefreshCw, Trash2, Link as LinkIcon, Copy, Share2, Code2, List } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, "") ?? "";

function ExportModal({ folderId, folderName, open, onOpenChange }: {
  folderId: number;
  folderName: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const playlistUrl = `${API_BASE}/api/folders/${folderId}/episodes`;
  const episodeServeUrl = `${API_BASE}/api/folders/${folderId}/episode/{n}`;
  const episodeEmbedUrl = `${API_BASE}/api/folders/${folderId}/episode/{n}/embed`;

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado!");
  };

  const fetchSnippet = `const res = await fetch("${playlistUrl}");
const episodes = await res.json();
// episodes = [{ episodeNumber, title, videoSlug, ... }, ...]

episodes.forEach(ep => {
  console.log(ep.episodeNumber, ep.title, ep.videoSlug);
});`;

  const iframeSnippet = `<!-- Substitua {n} pelo número do episódio -->
<iframe
  src="${episodeEmbedUrl.replace("{n}", "1")}"
  width="854"
  height="480"
  allowfullscreen
  frameborder="0"
></iframe>`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="w-5 h-5 text-primary" />
            Distribuir pasta: {folderName}
          </DialogTitle>
          <DialogDescription>
            Use estas URLs para integrar os vídeos desta pasta em qualquer site. Os links sempre apontam para a versão mais recente — o VLM renova automaticamente quando expiram.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="playlist" className="mt-2">
          <TabsList className="w-full">
            <TabsTrigger value="playlist" className="flex-1 flex items-center gap-1.5">
              <List className="w-3.5 h-3.5" />
              Playlist JSON
            </TabsTrigger>
            <TabsTrigger value="episode" className="flex-1 flex items-center gap-1.5">
              <LinkIcon className="w-3.5 h-3.5" />
              Por episódio
            </TabsTrigger>
            <TabsTrigger value="embed" className="flex-1 flex items-center gap-1.5">
              <Code2 className="w-3.5 h-3.5" />
              Embed iframe
            </TabsTrigger>
          </TabsList>

          {/* Playlist JSON */}
          <TabsContent value="playlist" className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">
              Endpoint público que retorna todos os episódios da pasta em ordem, com o link de serve permanente de cada um.
            </p>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">URL da Playlist</Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-muted px-3 py-2 rounded-lg font-mono break-all">{playlistUrl}</code>
                <Button variant="outline" size="sm" onClick={() => copy(playlistUrl)} className="flex-shrink-0">
                  <Copy className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Exemplo de uso (JavaScript)</Label>
              <div className="relative">
                <pre className="text-xs bg-muted px-3 py-3 rounded-lg font-mono overflow-x-auto whitespace-pre">{fetchSnippet}</pre>
                <Button variant="ghost" size="sm" className="absolute top-2 right-2 h-6 w-6 p-0" onClick={() => copy(fetchSnippet)}>
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
            </div>
            <div className="rounded-lg border border-border/50 bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
              <p><span className="font-semibold text-foreground">episodeNumber</span> — número do episódio</p>
              <p><span className="font-semibold text-foreground">title</span> — título do vídeo</p>
              <p><span className="font-semibold text-foreground">videoSlug</span> — URL de serve permanente (sempre atualizado)</p>
            </div>
          </TabsContent>

          {/* Por episódio */}
          <TabsContent value="episode" className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">
              Redireciona direto para o vídeo do episódio N. Use como <code className="bg-muted px-1 rounded">src</code> de um <code className="bg-muted px-1 rounded">&lt;video&gt;</code> ou botão de download.
            </p>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">URL de Serve (substitua {"{n}"} pelo número)</Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-muted px-3 py-2 rounded-lg font-mono break-all">{episodeServeUrl}</code>
                <Button variant="outline" size="sm" onClick={() => copy(episodeServeUrl)} className="flex-shrink-0">
                  <Copy className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
            <div className="rounded-lg border border-border/50 bg-primary/5 border-primary/20 p-3 text-xs text-muted-foreground">
              Exemplo: <code className="font-mono text-primary">{`${API_BASE}/api/folders/${folderId}/episode/1`}</code> serve o episódio 1.
            </div>
          </TabsContent>

          {/* Embed iframe */}
          <TabsContent value="embed" className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">
              Player HTML embutível via iframe. Funciona em qualquer site sem configuração extra.
            </p>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">URL do Embed (substitua {"{n}"} pelo número)</Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-muted px-3 py-2 rounded-lg font-mono break-all">{episodeEmbedUrl}</code>
                <Button variant="outline" size="sm" onClick={() => copy(episodeEmbedUrl)} className="flex-shrink-0">
                  <Copy className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Código HTML</Label>
              <div className="relative">
                <pre className="text-xs bg-muted px-3 py-3 rounded-lg font-mono overflow-x-auto whitespace-pre">{iframeSnippet}</pre>
                <Button variant="ghost" size="sm" className="absolute top-2 right-2 h-6 w-6 p-0" onClick={() => copy(iframeSnippet)}>
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              Parâmetros opcionais: <code className="bg-muted px-1 rounded">?autoplay=1</code> e <code className="bg-muted px-1 rounded">?muted=1</code>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function FolderDetail() {
  const params = useParams();
  const folderId = Number(params.id);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data: folder, isLoading: folderLoading } = useGetFolder(folderId, { query: { enabled: !!folderId, queryKey: getGetFolderQueryKey(folderId) } });
  const { data: links, isLoading: linksLoading } = useListLinks({ folderId }, { query: { enabled: !!folderId, queryKey: getListLinksQueryKey({ folderId }) } });

  const createLink = useCreateLink();
  const deleteLink = useDeleteLink();
  const checkLink = useCheckLink();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [pageUrl, setPageUrl] = useState("");

  const handleCreate = () => {
    createLink.mutate({ data: { title, url, pageUrl: pageUrl.trim() || undefined, folderId } }, {
      onSuccess: (created) => {
        queryClient.invalidateQueries({ queryKey: getListLinksQueryKey({ folderId }) });
        queryClient.invalidateQueries({ queryKey: getGetFolderQueryKey(folderId) });
        setIsCreateOpen(false);
        setTitle("");
        setUrl("");
        setPageUrl("");
        toast.success("Link adicionado! Redirecionando...");
        setLocation(`/links/${created.id}`);
      },
      onError: (err) => {
        toast.error(`Erro ao adicionar link: ${err.message}`);
      },
    });
  };

  const handleDelete = (id: number) => {
    if (confirm("Tem certeza que deseja remover este link?")) {
      deleteLink.mutate({ id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListLinksQueryKey({ folderId }) });
          queryClient.invalidateQueries({ queryKey: getGetFolderQueryKey(folderId) });
          toast.success("Link removido");
        },
        onError: (err) => {
          toast.error(`Erro ao remover link: ${err.message}`);
        },
      });
    }
  };

  const handleCheck = (id: number) => {
    checkLink.mutate({ id }, {
      onSuccess: (res) => {
        queryClient.invalidateQueries({ queryKey: getListLinksQueryKey({ folderId }) });
        if (res.refreshedUrl) {
          toast.success("Link atualizado com sucesso");
        } else {
          toast.info(`Status: ${res.status}`);
        }
      },
      onError: (err) => {
        toast.error(`Erro ao verificar link: ${err.message}`);
      },
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado para a área de transferência");
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active": return <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">Ativo</Badge>;
      case "expired": return <Badge variant="destructive" className="bg-destructive/10 text-destructive border-destructive/20">Expirado</Badge>;
      case "checking": return <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20">Verificando...</Badge>;
      default: return <Badge variant="secondary">Desconhecido</Badge>;
    }
  };

  if (folderLoading) {
    return <div className="p-8 text-center">Carregando pasta...</div>;
  }

  if (!folder) {
    return <div className="p-8 text-center">Pasta não encontrada.</div>;
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto w-full space-y-8">
      <Button variant="ghost" onClick={() => setLocation("/folders")} className="-ml-4 mb-4 text-muted-foreground">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Voltar para Pastas
      </Button>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-3">
            <Folder className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold tracking-tight">{folder.name}</h1>
          </div>
          {folder.description && (
            <p className="text-muted-foreground mt-2">{folder.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setIsExportOpen(true)}>
            <Share2 className="w-4 h-4 mr-2" />
            Distribuir
          </Button>
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Adicionar Link
          </Button>
        </div>
      </div>

      <Card className="border-border/50 bg-card/50 backdrop-blur">
        <CardHeader>
          <CardTitle>Links em {folder.name}</CardTitle>
          <CardDescription>Gerencie e monitore os links de vídeo desta pasta.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">Ep.</TableHead>
                <TableHead>Título</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>URL</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {linksLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">Carregando links...</TableCell>
                </TableRow>
              ) : links?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    <LinkIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    Nenhum link nesta pasta.
                  </TableCell>
                </TableRow>
              ) : (
                links?.map((link) => (
                  <TableRow key={link.id} className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setLocation(`/links/${link.id}`)}>
                    <TableCell className="text-muted-foreground text-sm font-mono">
                      {link.episodeOrder != null ? link.episodeOrder : <span className="opacity-30">—</span>}
                    </TableCell>
                    <TableCell className="font-medium">
                      <div>{link.title}</div>
                      {link.pageUrl && <div className="text-xs text-muted-foreground mt-0.5">com página fonte</div>}
                    </TableCell>
                    <TableCell>{getStatusBadge(link.status)}</TableCell>
                    <TableCell className="font-mono text-xs max-w-[200px] truncate" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-2">
                        <span className="truncate">{link.refreshedUrl || link.url}</span>
                        <Button variant="ghost" size="icon" className="h-6 w-6 ml-auto flex-shrink-0" onClick={() => copyToClipboard(link.refreshedUrl || link.url)}>
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleCheck(link.id)} disabled={checkLink.isPending}>
                          <RefreshCw className={`w-3 h-3 mr-1 ${checkLink.isPending ? 'animate-spin' : ''}`} />
                          Verificar
                        </Button>
                        <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" onClick={() => handleDelete(link.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ExportModal folderId={folderId} folderName={folder.name} open={isExportOpen} onOpenChange={setIsExportOpen} />

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Link à Pasta</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Título</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Aula 01 - Introdução" />
            </div>
            <div className="space-y-2">
              <Label>URL do Vídeo</Label>
              <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://cdn.exemplo.com/video.mp4" type="url" />
              <p className="text-xs text-muted-foreground">Link direto do arquivo de vídeo (pode conter token de expiração).</p>
            </div>
            <div className="space-y-2">
              <Label>
                URL da Página <span className="text-muted-foreground font-normal">(opcional)</span>
              </Label>
              <Input value={pageUrl} onChange={(e) => setPageUrl(e.target.value)} placeholder="https://site.com/pagina-do-video" type="url" />
              <p className="text-xs text-muted-foreground">Quando o link expirar, o sistema abrirá esta página e extrairá o novo URL do vídeo automaticamente.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={!title || !url || createLink.isPending}>Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
