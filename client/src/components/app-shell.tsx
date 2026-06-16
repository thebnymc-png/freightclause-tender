import { useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, FileText, Route as RouteIcon, Users, Settings as SettingsIcon,
  Sun, Moon, Search, Menu, X,
} from "lucide-react";
import { Wordmark } from "./logo";
import { useTheme } from "./theme-provider";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/tenders", label: "Tenders", icon: FileText },
  { href: "/routes", label: "Routes", icon: RouteIcon },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
];

function isActive(loc: string, href: string) {
  if (href === "/") return loc === "/" || loc === "";
  return loc === href || loc.startsWith(href + "/");
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const [loc] = useLocation();
  return (
    <nav className="flex flex-col gap-1 px-3" role="list">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = isActive(loc, href);
        return (
          <Link key={href} href={href}>
            <a
              onClick={onNavigate}
              data-testid={`link-nav-${label.toLowerCase()}`}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover-elevate",
                active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-muted-foreground"
              )}
              aria-current={active ? "page" : undefined}
            >
              <Icon className={cn("h-[18px] w-[18px]", active && "text-primary")} />
              {label}
            </a>
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({ children, title }: { children: ReactNode; title: string }) {
  const { theme, toggle } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Sidebar — desktop */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
        <div className="flex h-16 items-center px-5 border-b border-sidebar-border">
          <Wordmark />
        </div>
        <div className="flex-1 overflow-y-auto py-4">
          <NavLinks />
        </div>
        <div className="border-t border-sidebar-border p-4">
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-primary/15 text-primary text-xs font-semibold">OM</AvatarFallback>
            </Avatar>
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-medium">Ops Manager</p>
              <p className="truncate text-xs text-muted-foreground">ops@jdt.com.au</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col bg-sidebar border-r border-sidebar-border">
            <div className="flex h-16 items-center justify-between px-5 border-b border-sidebar-border">
              <Wordmark />
              <button onClick={() => setMobileOpen(false)} data-testid="button-close-menu" aria-label="Close menu">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto py-4">
              <NavLinks onNavigate={() => setMobileOpen(false)} />
            </div>
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="lg:pl-60">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur lg:px-6">
          <button className="lg:hidden" onClick={() => setMobileOpen(true)} data-testid="button-open-menu" aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </button>
          <h1 className="text-base font-semibold tracking-tight lg:text-lg" data-testid="text-page-title">{title}</h1>
          <div className="ml-auto flex items-center gap-2">
            <div className="relative hidden sm:block">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search" placeholder="Search…"
                className="h-9 w-40 pl-8 md:w-56" data-testid="input-search"
              />
            </div>
            <Button
              variant="ghost" size="icon" onClick={toggle}
              data-testid="button-theme-toggle" aria-label="Toggle dark mode" className="h-9 w-9"
            >
              {theme === "dark" ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
            </Button>
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-primary/15 text-primary text-xs font-semibold">OM</AvatarFallback>
            </Avatar>
          </div>
        </header>
        <main className="mx-auto max-w-[1400px] p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
