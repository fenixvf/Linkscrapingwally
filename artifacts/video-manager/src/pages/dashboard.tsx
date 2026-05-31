import { useGetStats } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { Link as LinkIcon, FolderOpen, Activity, AlertTriangle, CheckCircle, HelpCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { data: stats, isLoading } = useGetStats({ query: { queryKey: ["getStats"] } });

  return (
    <div className="p-8 max-w-6xl mx-auto w-full space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Overview of your video infrastructure.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={() => setLocation("/links")}>View Links</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Total Links" 
          value={stats?.totalLinks} 
          icon={<LinkIcon className="w-5 h-5 text-muted-foreground" />} 
          isLoading={isLoading} 
        />
        <StatCard 
          title="Folders" 
          value={stats?.totalFolders} 
          icon={<FolderOpen className="w-5 h-5 text-muted-foreground" />} 
          isLoading={isLoading} 
        />
        <StatCard 
          title="Active Links" 
          value={stats?.activeLinks} 
          icon={<CheckCircle className="w-5 h-5 text-emerald-500" />} 
          isLoading={isLoading} 
        />
        <StatCard 
          title="Expired Links" 
          value={stats?.expiredLinks} 
          icon={<AlertTriangle className="w-5 h-5 text-destructive" />} 
          isLoading={isLoading} 
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2 border-border/50 bg-card/50 backdrop-blur">
          <CardHeader>
            <CardTitle>System Health</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg bg-background/50">
                  <div className="flex items-center gap-3">
                    <Activity className="w-5 h-5 text-primary" />
                    <div>
                      <p className="font-medium">Recently Checked</p>
                      <p className="text-sm text-muted-foreground">Links checked in the last 24h</p>
                    </div>
                  </div>
                  <span className="text-2xl font-bold font-mono">{stats?.recentlyChecked || 0}</span>
                </div>
                <div className="flex items-center justify-between p-4 border rounded-lg bg-background/50">
                  <div className="flex items-center gap-3">
                    <HelpCircle className="w-5 h-5 text-yellow-500" />
                    <div>
                      <p className="font-medium">Unknown Status</p>
                      <p className="text-sm text-muted-foreground">Requires manual verification</p>
                    </div>
                  </div>
                  <span className="text-2xl font-bold font-mono">{stats?.unknownLinks || 0}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50 backdrop-blur flex flex-col">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 flex-1">
            <Button variant="outline" className="justify-start w-full" onClick={() => setLocation("/links?status=expired")}>
              <AlertTriangle className="w-4 h-4 mr-2 text-destructive" />
              Review Expired
            </Button>
            <Button variant="outline" className="justify-start w-full" onClick={() => setLocation("/folders")}>
              <FolderOpen className="w-4 h-4 mr-2" />
              Manage Folders
            </Button>
            <Button variant="default" className="justify-start w-full mt-auto" onClick={() => setLocation("/links")}>
              <Activity className="w-4 h-4 mr-2" />
              Run Health Check
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, isLoading }: { title: string, value?: number, icon: React.ReactNode, isLoading: boolean }) {
  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-8 w-16" />
        ) : (
          <div className="text-3xl font-bold font-mono">{value || 0}</div>
        )}
      </CardContent>
    </Card>
  );
}
