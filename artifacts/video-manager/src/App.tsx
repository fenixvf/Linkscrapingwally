import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { Layout } from "@/components/layout";
import Dashboard from "@/pages/dashboard";
import Folders from "@/pages/folders";
import FolderDetail from "@/pages/folder-detail";
import Links from "@/pages/links";
import LinkDetail from "@/pages/link-detail";
import DriveAPlayer from "@/pages/drivea-player";
import SlugFinder from "@/pages/slug-finder";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/folders" component={Folders} />
        <Route path="/folders/:id" component={FolderDetail} />
        <Route path="/links" component={Links} />
        <Route path="/links/:id" component={LinkDetail} />
        <Route path="/drivea" component={DriveAPlayer} />
        <Route path="/slug-finder" component={SlugFinder} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
        <Sonner />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
