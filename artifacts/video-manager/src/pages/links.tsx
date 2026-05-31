import { useState } from "react";
import { useListLinks, useCreateLink, useDeleteLink, useCheckLink, useCheckAllLinks, getListLinksQueryKey, useListFolders, getListFoldersQueryKey, type ListLinksStatus } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  const [folderId, setFolderId] = useState<string>("none");

  const handleCreate = () => {
    createLink.mutate({ 
      data: { 
        title, 
        url, 
        folderId: folderId === "none" ? undefined : Number(folderId) 
      } 
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListLinksQueryKey() });
        setIsCreateOpen(false);
        setTitle("");
        setUrl("");
        setFolderId("none");
        toast.success("Link added");
      }
    });
  };

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to remove this link?")) {
      deleteLink.mutate({ id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListLinksQueryKey() });
          toast.success("Link removed");
        }
      });
    }
  };

  const handleCheck = (id: number) => {
    checkLink.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListLinksQueryKey() });
        toast.success("Link checked");
      }
    });
  };

  const handleCheckAll = () => {
    checkAllLinks.mutate(undefined, {
      onSuccess: (res) => {
        queryClient.invalidateQueries({ queryKey: getListLinksQueryKey() });
        toast.success(`Checked ${res.checked} links. Active: ${res.active}, Expired: ${res.expired}`);
      }
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active": return <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">Active</Badge>;
      case "expired": return <Badge variant="destructive" className="bg-destructive/10 text-destructive border-destructive/20">Expired</Badge>;
      case "checking": return <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20">Checking...</Badge>;
      default: return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto w-full space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">All Links</h1>
          <p className="text-muted-foreground mt-1">Manage video links across all folders.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={handleCheckAll} disabled={checkAllLinks.isPending} className="font-semibold text-primary">
            <RefreshCw className={`w-4 h-4 mr-2 ${checkAllLinks.isPending ? 'animate-spin' : ''}`} />
            Check All Links
          </Button>
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Link
          </Button>
        </div>
      </div>

      <Card className="border-border/50 bg-card/50 backdrop-blur">
        <CardHeader className="flex flex-row items-center justify-between pb-2 border-b">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <Select value={statusFilter} onValueChange={(val: any) => setStatusFilter(val)}>
              <SelectTrigger className="w-[180px] border-none bg-transparent h-8 -ml-3">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="unknown">Unknown</SelectItem>
                <SelectItem value="checking">Checking</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="text-sm text-muted-foreground">
            {links?.length || 0} links found
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="pl-6">Title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Folder</TableHead>
                <TableHead>URL</TableHead>
                <TableHead className="text-right pr-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">Loading links...</TableCell>
                </TableRow>
              ) : links?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                    <LinkIcon className="w-8 h-8 mx-auto mb-3 opacity-50" />
                    No links found.
                  </TableCell>
                </TableRow>
              ) : (
                links?.map((link) => (
                  <TableRow key={link.id} className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setLocation(`/links/${link.id}`)}>
                    <TableCell className="font-medium pl-6">{link.title}</TableCell>
                    <TableCell>{getStatusBadge(link.status)}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{link.folderName || "—"}</TableCell>
                    <TableCell className="font-mono text-xs max-w-[200px] truncate" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-2">
                        <span className="truncate">{link.refreshedUrl || link.url}</span>
                        <Button variant="ghost" size="icon" className="h-6 w-6 ml-auto flex-shrink-0" onClick={() => copyToClipboard(link.refreshedUrl || link.url)}>
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="text-right pr-6" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleCheck(link.id)} disabled={checkLink.isPending}>
                          <RefreshCw className={`w-3 h-3 mr-1 ${checkLink.isPending ? 'animate-spin' : ''}`} />
                          Check
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
            <DialogTitle>Add Global Link</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Promo Video" />
            </div>
            <div className="space-y-2">
              <Label>URL</Label>
              <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." type="url" />
            </div>
            <div className="space-y-2">
              <Label>Folder</Label>
              <Select value={folderId} onValueChange={setFolderId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select folder" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {folders?.map(f => (
                    <SelectItem key={f.id} value={f.id.toString()}>{f.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!title || !url || createLink.isPending}>Add Link</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
