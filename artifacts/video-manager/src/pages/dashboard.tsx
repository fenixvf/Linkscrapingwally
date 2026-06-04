import { useState, useEffect, useCallback } from "react";
import { useGetStats } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";
import {
  Link as LinkIcon, FolderOpen, Activity, AlertTriangle,
  CheckCircle, HelpCircle, Clock, RefreshCw, Zap, RotateCcw,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

interface SchedulerStatus {
  enabled: boolean;
  intervalHours: number;
  running: boolean;
  lastRunAt: string | null;
  lastRunChecked: number;
  lastRunFixed: number;
  nextRunAt: string | null;
}

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, "") ?? "";

function useScheduler() {
  const [status, setStatus] = useState<SchedulerStatus | null>(null);

  const fetch_ = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/scheduler`);
      if (res.ok) setStatus(await res.json());
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetch_();
    const id = setInterval(fetch_, 10_000);
    return () => clearInterval(id);
  }, [fetch_]);

  return { status, refresh: fetch_ };
}

function fmtRelative(iso: string | null): string {
  if (!iso) return "Nunca";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "agora mesmo";
  if (mins < 60) return `há ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `há ${hrs}h`;
  return `há ${Math.floor(hrs / 24)}d`;
}

function fmtNext(iso: string | null): string {
  if (!iso) return "—";
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return "em breve";
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `em ${mins} min`;
  const hrs = Math.floor(mins / 60);
  return `em ${hrs}h ${mins % 60}min`;
}

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { data: stats, isLoading, refetch } = useGetStats({ query: { queryKey: ["getStats"] } });
  const { status: scheduler, refresh: refreshScheduler } = useScheduler();
  const [triggering, setTriggering] = useState(false);

  const handleTrigger = async () => {
    setTriggering(true);
    try {
      const res = await fetch(`${API_BASE}/api/scheduler/run`, { method: "POST" });
      if (res.ok) {
        toast.success("Verificação automática iniciada — aguarde...");
        setTimeout(() => { refetch(); refreshScheduler(); }, 3000);
      } else {
        const body = await res.json();
        toast.error(body.error ?? "Erro ao iniciar verificação");
      }
    } catch {
      toast.error("Erro de conexão");
    } finally {
      setTriggering(false);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto w-full space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Visão geral da sua infraestrutura de vídeos.</p>
        </div>
        <Button onClick={() => setLocation("/links")}>Ver Links</Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total de Links" value={stats?.totalLinks} icon={<LinkIcon className="w-5 h-5 text-muted-foreground" />} isLoading={isLoading} />
        <StatCard title="Pastas" value={stats?.totalFolders} icon={<FolderOpen className="w-5 h-5 text-muted-foreground" />} isLoading={isLoading} />
        <StatCard title="Ativos" value={stats?.activeLinks} icon={<CheckCircle className="w-5 h-5 text-emerald-500" />} isLoading={isLoading} valueClass="text-emerald-500" />
        <StatCard title="Expirados" value={stats?.expiredLinks} icon={<AlertTriangle className="w-5 h-5 text-destructive" />} isLoading={isLoading} valueClass={stats?.expiredLinks ? "text-destructive" : undefined} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Auto-check card */}
        <Card className="md:col-span-2 border-border/50 bg-card/50 backdrop-blur">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-muted-foreground" />
                <CardTitle className="text-base">Verificação Automática</CardTitle>
              </div>
              {scheduler ? (
                <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 inline-block" />
                  Ativo — a cada {scheduler.intervalHours}h
                </Badge>
              ) : (
                <Skeleton className="h-5 w-24" />
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              O servidor verifica todos os links automaticamente. Se algum expirar, o scraping é disparado
              para renovar a URL — e se ainda falhar, o backup é ativado. Tudo sem intervenção manual.
            </p>

            <div className="grid grid-cols-3 gap-3">
              {[
                {
                  label: "Última execução",
                  value: scheduler ? fmtRelative(scheduler.lastRunAt) : null,
                  sub: scheduler?.lastRunAt ? new Date(scheduler.lastRunAt).toLocaleString("pt-BR") : undefined,
                },
                {
                  label: "Links verificados",
                  value: scheduler ? String(scheduler.lastRunChecked) : null,
                  sub: scheduler?.lastRunFixed ? `${scheduler.lastRunFixed} recuperados` : "nenhum recuperado",
                },
                {
                  label: "Próxima execução",
                  value: scheduler ? fmtNext(scheduler.nextRunAt) : null,
                  sub: scheduler?.running ? "rodando agora..." : undefined,
                },
              ].map(({ label, value, sub }) => (
                <div key={label} className="rounded-lg border border-border/50 bg-background/40 p-3">
                  <div className="text-xs text-muted-foreground mb-1">{label}</div>
                  {value === null
                    ? <Skeleton className="h-5 w-16" />
                    : <div className="font-mono font-semibold text-sm">{value}</div>}
                  {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
                </div>
              ))}
            </div>

            <div className="flex items-center gap-3 pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={handleTrigger}
                disabled={triggering || scheduler?.running}
                className="flex items-center gap-2"
                data-testid="button-trigger-autocheck"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${triggering || scheduler?.running ? "animate-spin" : ""}`} />
                {scheduler?.running ? "Verificando..." : "Rodar agora"}
              </Button>
              <p className="text-xs text-muted-foreground">
                Configura o intervalo via variável de ambiente{" "}
                <code className="bg-muted px-1 rounded">AUTO_CHECK_INTERVAL_HOURS</code>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Quick actions */}
        <Card className="border-border/50 bg-card/50 backdrop-blur flex flex-col">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-muted-foreground" />
              <CardTitle className="text-base">Ações Rápidas</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 flex-1">
            <Button variant="outline" className="justify-start w-full" onClick={() => setLocation("/links?status=expired")}>
              <AlertTriangle className="w-4 h-4 mr-2 text-destructive" />
              Ver Expirados
              {(stats?.expiredLinks ?? 0) > 0 && (
                <Badge variant="destructive" className="ml-auto text-xs">{stats?.expiredLinks}</Badge>
              )}
            </Button>
            <Button variant="outline" className="justify-start w-full" onClick={() => setLocation("/links?status=unknown")}>
              <HelpCircle className="w-4 h-4 mr-2 text-yellow-500" />
              Status Desconhecido
              {(stats?.unknownLinks ?? 0) > 0 && (
                <Badge className="ml-auto text-xs bg-yellow-500/10 text-yellow-500 border-yellow-500/20">{stats?.unknownLinks}</Badge>
              )}
            </Button>
            <Button variant="outline" className="justify-start w-full" onClick={() => setLocation("/folders")}>
              <FolderOpen className="w-4 h-4 mr-2" />
              Gerenciar Pastas
            </Button>
            <Button variant="outline" className="justify-start w-full mt-auto" onClick={() => setLocation("/links")}>
              <Activity className="w-4 h-4 mr-2" />
              Todos os Links
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({
  title, value, icon, isLoading, valueClass,
}: {
  title: string;
  value?: number;
  icon: React.ReactNode;
  isLoading: boolean;
  valueClass?: string;
}) {
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
          <div className={`text-3xl font-bold font-mono ${valueClass ?? ""}`}>{value ?? 0}</div>
        )}
      </CardContent>
    </Card>
  );
}
