import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useGetLink, useCheckLink, useUpdateLink, useDeleteLink, useMoveLink, getGetLinkQueryKey, useListFolders, getListFoldersQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, RefreshCw, Trash2, Link as LinkIcon, FolderOutput, ExternalLink, CalendarClock, Copy } from "lucide-react";
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
  const [isMoveOpen, setIsMoveOpen] = useState(false);
  const [targetFolderId, setTargetFolderId] = useState<string>("none");

  const [isEditingNotes, setIsEditingNotes] = useState(false);

  // Initialize notes once link is loaded
  if (link && notes === "" && link.notes && !isEditingNotes) {
    setNotes(link.notes);
  }

  const handleCheck = () => {
    checkLink.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetLinkQueryKey(id) });
        toast.success("Link status checked");
      }
    });
  };

  const handleDelete = () => {
    if (confirm("Are you sure you want to delete this link?")) {
      deleteLink.mutate({ id }, {
        onSuccess: () => {
          toast.success("Link deleted");
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
        toast.success("Notes updated");
      }
    });
  };

  const handleMove = () => {
    moveLink.mutate({ id, data: { folderId: targetFolderId === "none" ? null : Number(targetFolderId) } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetLinkQueryKey(id) });
        setIsMoveOpen(false);
        toast.success("Link moved successfully");
      }
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  if (isLoading) {
    return <div className="p-8 text-center">Loading link details...</div>;
  }

  if (!link) {
    return <div className="p-8 text-center text-destructive">Link not found.</div>;
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active": return <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 px-3 py-1">Active</Badge>;
      case "expired": return <Badge variant="destructive" className="bg-destructive/10 text-destructive border-destructive/20 px-3 py-1">Expired</Badge>;
      case "checking": return <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20 px-3 py-1">Checking...</Badge>;
      default: return <Badge variant="secondary" className="px-3 py-1">Unknown</Badge>;
    }
  };

  const displayUrl = link.refreshedUrl || link.url;

  return (
    <div className="p-8 max-w-5xl mx-auto w-full space-y-8">
      <div className="flex items-center justify-between mb-2">
        <Button variant="ghost" onClick={() => setLocation(link.folderId ? `/folders/${link.folderId}` : "/links")} className="-ml-4 text-muted-foreground">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setIsMoveOpen(true)}>
            <FolderOutput className="w-4 h-4 mr-2" />
            Move
          </Button>
          <Button variant="outline" onClick={handleCheck} disabled={checkLink.isPending} className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/20">
            <RefreshCw className={`w-4 h-4 mr-2 ${checkLink.isPending ? 'animate-spin' : ''}`} />
            Check Status
          </Button>
          <Button variant="destructive" onClick={handleDelete}>
            <Trash2 className="w-4 h-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold tracking-tight">{link.title}</h1>
              {getStatusBadge(link.status)}
            </div>
            {link.folderName && (
              <p className="text-muted-foreground">in folder: <span className="font-medium text-foreground">{link.folderName}</span></p>
            )}
          </div>

          <Card className="border-border/50 bg-black overflow-hidden shadow-xl shadow-black/50">
            <div className="aspect-video w-full bg-black relative flex items-center justify-center">
              {link.status === "expired" && !link.refreshedUrl ? (
                <div className="text-center p-6 text-destructive/80">
                  <Trash2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Video link is expired and cannot be played.</p>
                </div>
              ) : (
                <video 
                  src={displayUrl} 
                  controls 
                  className="w-full h-full object-contain"
                  poster=""
                >
                  Your browser does not support the video tag.
                </video>
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-border/50 bg-card/50 backdrop-blur">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">URLs</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground flex justify-between">
                  Original URL
                  <button onClick={() => copyToClipboard(link.url)} className="hover:text-primary"><Copy className="w-3 h-3" /></button>
                </div>
                <a href={link.url} target="_blank" rel="noreferrer" className="block text-sm font-mono truncate text-primary hover:underline" title={link.url}>
                  {link.url}
                </a>
              </div>
              
              {link.refreshedUrl && (
                <>
                  <Separator />
                  <div className="space-y-1">
                    <div className="text-xs text-emerald-500/80 flex justify-between">
                      Refreshed URL
                      <button onClick={() => copyToClipboard(link.refreshedUrl!)} className="hover:text-emerald-500"><Copy className="w-3 h-3" /></button>
                    </div>
                    <a href={link.refreshedUrl} target="_blank" rel="noreferrer" className="block text-sm font-mono truncate text-emerald-500 hover:underline" title={link.refreshedUrl}>
                      {link.refreshedUrl}
                    </a>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card/50 backdrop-blur">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Notes</CardTitle>
              {!isEditingNotes && (
                <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={() => setIsEditingNotes(true)}>Edit</Button>
              )}
            </CardHeader>
            <CardContent>
              {isEditingNotes ? (
                <div className="space-y-2">
                  <Textarea 
                    value={notes} 
                    onChange={(e) => setNotes(e.target.value)} 
                    placeholder="Add notes about this video..."
                    className="min-h-[100px] resize-none text-sm bg-background/50"
                  />
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setIsEditingNotes(false)}>Cancel</Button>
                    <Button size="sm" onClick={handleSaveNotes} disabled={updateLink.isPending}>Save</Button>
                  </div>
                </div>
              ) : (
                <div className="text-sm whitespace-pre-wrap min-h-[40px] text-muted-foreground">
                  {link.notes || <span className="italic opacity-50">No notes added.</span>}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card/50 backdrop-blur">
            <CardContent className="py-4">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <CalendarClock className="w-4 h-4 opacity-70" />
                <div>
                  <div className="font-medium text-foreground mb-0.5">Last Checked</div>
                  {link.lastChecked ? new Date(link.lastChecked).toLocaleString() : 'Never'}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={isMoveOpen} onOpenChange={setIsMoveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move Link</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Select destination folder</label>
              <Select value={targetFolderId} onValueChange={setTargetFolderId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select folder" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (Root)</SelectItem>
                  {folders?.map(f => (
                    <SelectItem key={f.id} value={f.id.toString()}>{f.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsMoveOpen(false)}>Cancel</Button>
            <Button onClick={handleMove} disabled={moveLink.isPending}>Move</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
