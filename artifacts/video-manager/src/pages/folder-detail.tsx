import { useState } from "react";
import { useGetFolder, useListLinks, useCreateLink, useDeleteLink, useCheckLink, getGetFolderQueryKey, getListLinksQueryKey } from "@workspace/api-client-react";
import { useParams, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Folder, Plus, ArrowLeft, RefreshCw, Trash2, Link as LinkIcon, Copy } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";

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
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Adicionar Link
        </Button>
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
                <TableHead>Título</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>URL</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {linksLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8">Carregando links...</TableCell>
                </TableRow>
              ) : links?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    <LinkIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    Nenhum link nesta pasta.
                  </TableCell>
                </TableRow>
              ) : (
                links?.map((link) => (
                  <TableRow key={link.id} className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setLocation(`/links/${link.id}`)}>
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
