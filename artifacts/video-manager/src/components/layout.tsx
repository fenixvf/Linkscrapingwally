import { useLocation } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { LayoutDashboard, FolderOpen, Link as LinkIcon, Activity, Film, Hash } from "lucide-react";
import { ReactNode } from "react";

export function Layout({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();

  const navItems = [
    { title: "Dashboard", icon: LayoutDashboard, url: "/" },
    { title: "Folders", icon: FolderOpen, url: "/folders" },
    { title: "All Links", icon: LinkIcon, url: "/links" },
    { title: "DriveA Player", icon: Film, url: "/drivea" },
    { title: "Slug Finder", icon: Hash, url: "/slug-finder" },
  ];

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <Sidebar className="border-r border-border bg-sidebar">
          <SidebarHeader className="h-16 flex items-center px-4 border-b border-sidebar-border">
            <div className="flex items-center gap-2 font-bold text-sidebar-foreground">
              <div className="bg-primary text-primary-foreground p-1 rounded-md">
                <Activity className="w-5 h-5" />
              </div>
              <span>VLM Control</span>
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Menu</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {navItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        isActive={
                          location === item.url ||
                          (item.url !== "/" && location.startsWith(item.url))
                        }
                        onClick={() => setLocation(item.url)}
                        tooltip={item.title}
                      >
                        <item.icon />
                        <span>{item.title}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarRail />
        </Sidebar>

        <div className="flex-1 flex flex-col min-w-0 overflow-auto">
          {/* Mobile top bar */}
          <header className="flex md:hidden items-center gap-3 h-14 px-4 border-b border-border bg-background sticky top-0 z-10">
            <SidebarTrigger data-testid="button-mobile-menu" />
            <div className="flex items-center gap-2 font-bold text-foreground">
              <div className="bg-primary text-primary-foreground p-1 rounded-md">
                <Activity className="w-4 h-4" />
              </div>
              <span className="text-sm">VLM Control</span>
            </div>
          </header>

          <main className="flex-1 flex flex-col min-w-0">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
