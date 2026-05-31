import { useState } from "react";
import { useListLinks, useCreateLink, useDeleteLink, useCheckLink, useCheckAllLinks, getListLinksQueryKey, useListFolders, getListFoldersQueryKey, type ListLinksStatus } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, RefreshCw, Trash2, Link as LinkIcon, Copy, Filter } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { useLocation } from "wouter";

export default function Links() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<ListLinksStatus | "all">("all");

  const queryParams = statusFilter !== "all" ? { status: statusFilter } : {};
  const { data: links, isLoading } = useListLinks(queryParams, { query: { queryKey: getListLinksQueryKey(queryParams) } });
  const { data: folders } = useListFolders({ query: { queryKey: getListFoldersQueryKey() } });

  const createLink = useCreateLink();
  const deleteLink = useDeleteLink();
  const checkLink = useCheckLink();
  const checkAllLinks = useCheckAllLinks();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [pageUrl, setPageUrl] = useState("");
  const [folderId, setFolderId] = useState<string>("none");

  const handleCreate = () => {
    createLink.mutate({
      data: {
        title,
        url,
        pageUrl: pageUrl.trim() || undefined,
        folderId: folderId === "none" ? undefined : Number(folderId),
      }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListLinksQueryKey() });
        setIsCreateOpen(false);
        setTitle("");
        setUrl("");
        setPageUrl("");
        setFolderId("none");
        toast.success("Link adicionado");
      }
    });
  };

  const handleDelete = (id: number) => {
    if (confirm("Tem certeza que deseja remover este link?")) {
      deleteLink.mutate({ id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListLinksQueryKey() });
          toast.success("Link removido");
        }
      });
    }
  };

  const handleCheck = (id: number) => {
    checkLink.mutate({ id }, {
      onSuccess: (res) => {
        queryClient.invalidateQueries({ queryKey: getListLinksQueryKey() });
        if (res.refreshedUrl) {
          toast.success("Link atualizado com sucesso");
        } else {
          toast.info(`Status: ${res.status}`);
        }
      }
    });
  };

  const handleCheckAll = () => {
    checkAllLinks.mutate(undefined, {
      onSuccess: (res) => {
        queryClient.invalidateQueries({ queryKey: getListLinksQueryKey() });
        toast.success(`Verificados: ${res.checked} links — Ativos: ${res.active}, Expirados: ${res.expired}`);
      }
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

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto w-full space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Todos os Links</h1>
          <p className="text-muted-foreground mt-1">Gerencie links de vídeo de todas as pastas.</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="outline" onClick={handleCheckAll} disabled={checkAllLinks.isPending} className="font-semibold text-primary" data-testid="button-check-all">
            <RefreshCw className={`w-4 h-4 mr-2 ${checkAllLinks.isPending ? 'animate-spin' : ''}`} />
            Verificar Todos
          </Button>
          <Button onClick={() => setIsCreateOpen(true)} data-testid="button-add-link">
            <Plus className="w-4 h-4 mr-2" />
            Adicionar Link
          </Button>
        </div>
      </div>

      <Card className="border-border/50 bg-card/50 backdrop-blur">
        <CardHeader className="flex flex-row items-center justify-between pb-2 border-b flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <Select value={statusFilter} onValueChange={(val: ListLinksStatus | "all") => setStatusFilter(val)}>
              <SelectTrigger className="w-[180px] border-none bg-transparent h-8 -ml-3" data-testid="select-status-filter">
                <SelectValue placeholder="Filtrar por status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Status</SelectItem>
                <SelectItem value="active">Ativo</SelectItem>
                <SelectItem value="expired">Expirado</SelectItem>
                <SelectItem value="unknown">Desconhecido</SelectItem>
                <SelectItem value="checking">Verificando</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="text-sm text-muted-foreground">{links?.length || 0} links encontrados</div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="pl-6">Título</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">Pasta</TableHead>
                <TableHead className="hidden sm:table-cell">URL</TableHead>
                <TableHead className="text-right pr-6">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">Carregando links...</TableCell>
                </TableRow>
              ) : links?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                    <LinkIcon className="w-8 h-8 mx-auto mb-3 opacity-50" />
                    Nenhum link encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                links?.map((link) => (
                  <TableRow key={link.id} className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setLocation(`/links/${link.id}`)} data-testid={`row-link-${link.id}`}>
                    <TableCell className="font-medium pl-6">
                      <div>{link.title}</div>
                      {link.pageUrl && <div className="text-xs text-muted-foreground mt-0.5">com página fonte</div>}
                    </TableCell>
                    <TableCell>{getStatusBadge(link.status)}</TableCell>
                    <TableCell className="text-muted-foreground text-sm hidden md:table-cell">{link.folderName || "—"}</TableCell>
                    <TableCell className="font-mono text-xs max-w-[200px] truncate hidden sm:table-cell" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-2">
                        <span className="truncate">{link.refreshedUrl || link.url}</span>
                        <Button variant="ghost" size="icon" className="h-6 w-6 ml-auto flex-shrink-0" onClick={() => copyToClipboard(link.refreshedUrl || link.url)} data-testid={`button-copy-${link.id}`}>
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="text-right pr-6" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleCheck(link.id)} disabled={checkLink.isPending} data-testid={`button-check-${link.id}`}>
                          <RefreshCw className={`w-3 h-3 mr-1 ${checkLink.isPending ? 'animate-spin' : ''}`} />
                          Verificar
                        </Button>
                        <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" onClick={() => handleDelete(link.id)} data-testid={`button-delete-${link.id}`}>
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
            <DialogTitle>Adicionar Link de Vídeo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Título</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Aula 01 - Introdução" data-testid="input-title" />
            </div>
            <div className="space-y-2">
              <Label>URL do Vídeo</Label>
              <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://cdn.exemplo.com/video.mp4" type="url" data-testid="input-url" />
              <p className="text-xs text-muted-foreground">Link direto do arquivo de vídeo (pode conter token de expiração).</p>
            </div>
            <div className="space-y-2">
              <Label>
                URL da Página <span className="text-muted-foreground font-normal">(opcional)</span>
              </Label>
              <Input value={pageUrl} onChange={(e) => setPageUrl(e.target.value)} placeholder="https://site.com/pagina-do-video" type="url" data-testid="input-page-url" />
              <p className="text-xs text-muted-foreground">Quando o link expirar, o sistema abrirá esta página e extrairá o novo URL do vídeo automaticamente.</p>
            </div>
            <div className="space-y-2">
              <Label>Pasta</Label>
              <Select value={folderId} onValueChange={setFolderId}>
                <SelectTrigger data-testid="select-folder">
                  <SelectValue placeholder="Selecionar pasta" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  {folders?.map(f => (
                    <SelectItem key={f.id} value={f.id.toString()}>{f.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={!title || !url || createLink.isPending} data-testid="button-submit-create">Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
