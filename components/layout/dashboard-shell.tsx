"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  BarChart3,
  Bot,
  CalendarClock,
  ChevronRight,
  ChevronsLeft,
  BellRing,
  LayoutDashboard,
  Menu,
  PanelsTopLeft,
  Puzzle,
  RefreshCw,
  Settings,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo } from "react";
import type { ElementType } from "react";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { useNavigationStore } from "@/store/navigation-store";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { layoutContainer } from "@/lib/layout";
import { cn } from "@/lib/utils";
import type { DashboardRow } from "@/types/dashboard";

type NavItem = {
  href: string;
  label: string;
  icon: ElementType;
};

const sidebarNav: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/memory-graph", label: "Memory Graph", icon: BarChart3 },
  { href: "/connected-apps", label: "Connected Apps", icon: Puzzle },
  { href: "/chat-assistant", label: "Chat Assistant", icon: Bot },
  { href: "/automations", label: "Automations", icon: BellRing },
  { href: "/settings", label: "Settings", icon: Settings },
];

const widgetSpecs = {
  memories: {
    title: "Recent Memory Captures",
    subtitle: "Automated captures from workspace activity",
    icon: Sparkles,
    accent: "from-cyan-500/20 to-sky-500/5",
  },
  deadlines: {
    title: "Upcoming Deadlines detected from Gmail",
    subtitle: "AI surfaced commitments from inbox",
    icon: CalendarClock,
    accent: "from-amber-500/20 to-orange-500/5",
  },
  agents: {
    title: "Active Background AI Agents",
    subtitle: "Monitoring and inference processes",
    icon: Bot,
    accent: "from-emerald-500/20 to-teal-500/5",
  },
  calendar: {
    title: "Recent Calendar Activity",
    subtitle: "Events and changes inferred from Google Calendar",
    icon: CalendarClock,
    accent: "from-violet-500/20 to-fuchsia-500/5",
  },
  apps: {
    title: "Connected Google Apps Status",
    subtitle: "Live integration health",
    icon: PanelsTopLeft,
    accent: "from-blue-500/20 to-indigo-500/5",
  },
} as const;

function SidebarNavLink({
  item,
  active,
  onClick,
}: {
  item: NavItem;
  active: boolean;
  onClick?: () => void;
}) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href as never}
      onClick={onClick}
      className={cn(
        "group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
      )}
      aria-current={active ? "page" : undefined}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="flex-1">{item.label}</span>
      {active ? <ChevronRight className="h-4 w-4" /> : null}
    </Link>
  );
}

function formatTimestamp(timestamp: string) {
  return new Date(timestamp).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function DashboardWidget({
  title,
  subtitle,
  icon: Icon,
  accent,
  rows,
  isLoading,
  isError,
  errorMessage,
  onRetry,
  index,
}: {
  title: string;
  subtitle: string;
  icon: ElementType;
  accent: string;
  rows: DashboardRow[];
  isLoading: boolean;
  isError: boolean;
  errorMessage?: string;
  onRetry?: () => void;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.06 * index }}
      whileHover={{ y: -3 }}
      className="h-full"
    >
      <Card className="h-full overflow-hidden border-border/70 bg-card/90 backdrop-blur">
        <div className={cn("h-1 w-full bg-gradient-to-r", accent)} />
        <CardHeader className="space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">{title}</CardTitle>
              <CardDescription className="mt-1">{subtitle}</CardDescription>
            </div>
            <div className="rounded-xl border bg-background p-2 text-muted-foreground">
              <Icon className="h-4 w-4" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <>
              <Skeleton className="h-16 rounded-xl" />
              <Skeleton className="h-16 rounded-xl" />
              <Skeleton className="h-16 rounded-xl" />
            </>
          ) : isError ? (
            <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
              <p className="font-medium">Widget unavailable</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {errorMessage ?? "Mock data could not be loaded at the moment."}
              </p>
              {onRetry ? (
                <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
                  Retry
                </Button>
              ) : null}
            </div>
          ) : rows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/60 bg-background/40 p-4 text-sm text-muted-foreground">
              No activity captured yet.
            </div>
          ) : (
            rows.map((row, rowIndex) => (
              <motion.div
                key={`${row.label}-${rowIndex}`}
                whileHover={{ x: 2 }}
                className="group rounded-xl border border-border/60 bg-background/60 px-4 py-3 transition-colors hover:bg-accent/60"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-foreground">{row.label}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{row.meta}</p>
                  </div>
                  <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-medium text-secondary-foreground">
                    {row.tone}
                  </span>
                </div>
              </motion.div>
            ))
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
      {Array.from({ length: 5 }).map((_, index) => (
        <Card key={index} className="border-border/70 bg-card/80">
          <CardHeader className="space-y-3">
            <Skeleton className="h-4 w-40 rounded-full" />
            <Skeleton className="h-3 w-64 rounded-full" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-16 rounded-xl" />
            <Skeleton className="h-16 rounded-xl" />
            <Skeleton className="h-16 rounded-xl" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function DashboardShell() {
  const pathname = usePathname();
  const {
    memoriesQuery,
    googleContextQuery,
    agentsQuery,
    recentMemories,
    upcomingDeadlines,
    activeAgents,
    recentCalendarActivity,
    connectedApps,
    isLoading,
    isError,
    error,
    tick,
    refetchAll,
  } = useDashboardData();

  const activePath = useNavigationStore((state) => state.activePath);
  const mobileNavOpen = useNavigationStore((state) => state.mobileNavOpen);
  const setActivePath = useNavigationStore((state) => state.setActivePath);
  const closeMobileNav = useNavigationStore((state) => state.closeMobileNav);
  const toggleMobileNav = useNavigationStore((state) => state.toggleMobileNav);

  useEffect(() => {
    setActivePath(pathname);
  }, [pathname, setActivePath]);

  useEffect(() => {
    if (!mobileNavOpen) return;

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMobileNav();
    };

    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [mobileNavOpen, closeMobileNav]);

  useEffect(() => {
    if (!pathname) return;

    const interval = window.setInterval(() => {
      if (!tick.isPending) {
        tick.mutate();
      }
    }, 12_000);

    return () => window.clearInterval(interval);
  }, [pathname, tick]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!tick.isPending) {
        tick.mutate();
      }
    }, 2_500);

    return () => window.clearTimeout(timer);
  }, [tick]);

  const dashboardRows = useMemo(
    () => ({
      memories: recentMemories.map<DashboardRow>((memory) => ({
        label: memory.content,
        meta: `${memory.sourceApp} - ${formatTimestamp(memory.timestamp)}`,
        tone: `Score ${memory.importanceScore.toFixed(2)}`,
      })),
      deadlines: upcomingDeadlines.map<DashboardRow>((item) => ({
        label: item.title,
        meta: item.summary,
        tone: item.type,
      })),
      agents: activeAgents.map<DashboardRow>((agent) => ({
        label: agent.agentName,
        meta: agent.currentTask,
        tone: `${agent.status} - ${agent.progressPercentage}%`,
      })),
      calendar: recentCalendarActivity.map<DashboardRow>((item) => ({
        label: item.title,
        meta: item.summary,
        tone: `${item.type} - ${formatTimestamp(item.createdAt)}`,
      })),
      apps: connectedApps.map<DashboardRow>((app) => ({
        label: app.label,
        meta: app.meta,
        tone: app.tone,
      })),
    }),
    [activeAgents, connectedApps, recentCalendarActivity, recentMemories, upcomingDeadlines],
  );

  const pendingCount = useMemo(() => {
    const inboxSignals = (googleContextQuery.data ?? []).filter((item) => item.type === "email").length;
    return `${inboxSignals} inbox signals`;
  }, [googleContextQuery.data]);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.12),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(168,85,247,0.10),_transparent_24%)]" />
      <div className="absolute inset-0 bg-grid-fade bg-[length:30px_30px] opacity-[0.05]" />

      <div className={layoutContainer("relative z-10 min-h-screen")}>
        <div className="grid min-h-screen gap-6 py-4 lg:grid-cols-[280px_minmax(0,1fr)] lg:py-6">
          <aside className="hidden lg:block">
            <motion.div
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.35 }}
              className="sticky top-6 flex h-[calc(100vh-3rem)] flex-col rounded-3xl border border-border/70 bg-card/80 p-4 shadow-soft backdrop-blur"
            >
              <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-background/70 p-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold leading-none">Google Nexus Memory</p>
                  <p className="mt-1 text-xs text-muted-foreground">Enterprise AI workspace</p>
                </div>
              </div>

              <Separator className="my-5 bg-border/60" />

              <nav className="space-y-1" aria-label="Sidebar navigation">
                {sidebarNav.map((item) => (
                  <SidebarNavLink key={item.href} item={item} active={activePath === item.href} />
                ))}
              </nav>

              <div className="mt-auto rounded-2xl border border-border/60 bg-background/60 p-4">
                <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">
                  Workspace status
                </p>
                <p className="mt-2 text-sm font-medium">All systems operational</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Memory sync, calendar ingestion, and agent routing are ready to expand.
                </p>
              </div>
            </motion.div>
          </aside>

          <div className="flex min-w-0 flex-col gap-6">
            <motion.header
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
              className="sticky top-4 z-30 rounded-3xl border border-border/70 bg-card/80 px-4 py-3 shadow-soft backdrop-blur"
            >
              <div className="flex items-center gap-3 lg:hidden">
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Open navigation"
                  onClick={toggleMobileNav}
                >
                  <Menu className="h-4 w-4" />
                </Button>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">Google Nexus Memory</p>
                  <p className="truncate text-xs text-muted-foreground">
                    Intelligent workspace assistant
                  </p>
                </div>
              </div>

              <div className="hidden items-center justify-between gap-4 lg:flex">
                <div className="min-w-0">
                  <p className="text-sm font-semibold tracking-tight">Dashboard</p>
                  <p className="text-sm text-muted-foreground">
                    Operational overview for memory, agents, and Google app integrations
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="hidden rounded-2xl border border-border/60 bg-background/70 px-3 py-2 text-xs text-muted-foreground xl:block">
                    {pendingCount}
                  </div>
                  <ThemeToggle />
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between gap-3 lg:hidden">
                <div className="rounded-2xl border border-border/60 bg-background/70 px-3 py-2 text-xs text-muted-foreground">
                  {pendingCount}
                </div>
                <ThemeToggle />
              </div>
            </motion.header>

            <AnimatePresence>
              {mobileNavOpen ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-40 bg-black/45 backdrop-blur-sm lg:hidden"
                  onClick={closeMobileNav}
                  aria-hidden="true"
                >
                  <motion.aside
                    initial={{ x: -280 }}
                    animate={{ x: 0 }}
                    exit={{ x: -280 }}
                    transition={{ type: "spring", stiffness: 320, damping: 34 }}
                    className="absolute left-0 top-0 h-full w-[280px] border-r border-border/70 bg-card p-4 shadow-2xl"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                          <Sparkles className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold">Google Nexus Memory</p>
                          <p className="text-xs text-muted-foreground">Enterprise AI workspace</p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="icon"
                        aria-label="Close navigation"
                        onClick={closeMobileNav}
                      >
                        <ChevronsLeft className="h-4 w-4" />
                      </Button>
                    </div>

                    <Separator className="my-5 bg-border/60" />

                    <nav className="space-y-1" aria-label="Mobile sidebar navigation">
                      {sidebarNav.map((item) => (
                        <SidebarNavLink
                          key={item.href}
                          item={item}
                          active={activePath === item.href}
                          onClick={closeMobileNav}
                        />
                      ))}
                    </nav>
                  </motion.aside>
                </motion.div>
              ) : null}
            </AnimatePresence>

            <section className="flex-1 pb-6">
              <div className="grid gap-6">
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: 0.05 }}
                  className="rounded-[1.75rem] border border-border/70 bg-card/80 p-6 shadow-soft backdrop-blur"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div className="max-w-2xl">
                      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
                        Dashboard
                      </p>
                      <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
                        Intelligent workspace overview
                      </h1>
                      <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                        A premium enterprise shell for memory capture, AI agents, and connected Google
                        app intelligence.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <Button
                        variant="outline"
                        className="border-border/60 bg-background/60"
                        onClick={() => refetchAll()}
                        disabled={tick.isPending}
                      >
                        <RefreshCw className={cn("mr-2 h-4 w-4", tick.isPending && "animate-spin")} />
                        Refresh signals
                      </Button>
                      <Button onClick={() => window.location.assign("/connected-apps")}>
                        <Sparkles className="mr-2 h-4 w-4" />
                        Connected apps
                      </Button>
                    </div>
                  </div>

                  <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {[
                      ["Memories", String(recentMemories.length)],
                      ["Agents", `${activeAgents.length} live`],
                      ["Signals", String((googleContextQuery.data ?? []).length)],
                      ["Deadlines", String(upcomingDeadlines.length)],
                    ].map(([label, value]) => (
                      <div
                        key={label}
                        className="rounded-2xl border border-border/60 bg-background/60 px-4 py-3"
                      >
                        <p className="text-xs text-muted-foreground">{label}</p>
                        <p className="mt-1 text-sm font-semibold">{value}</p>
                      </div>
                    ))}
                  </div>
                </motion.div>

                <AnimatePresence mode="wait">
                  {isLoading ? (
                    <motion.div
                      key="dashboard-skeleton"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <DashboardSkeleton />
                    </motion.div>
                  ) : isError ? (
                    <motion.div
                      key="dashboard-error"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="rounded-[1.75rem] border border-destructive/40 bg-destructive/5 p-6 text-sm text-destructive"
                    >
                      <p className="font-medium">The dashboard could not hydrate from workspace data.</p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {error?.message ?? "Unknown error"}
                      </p>
                      <Button className="mt-4" variant="outline" onClick={() => window.location.reload()}>
                        Retry
                      </Button>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="dashboard-content"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3"
                    >
                      <DashboardWidget
                        {...widgetSpecs.memories}
                        rows={dashboardRows.memories}
                        isLoading={memoriesQuery.isLoading || memoriesQuery.isFetching}
                        isError={memoriesQuery.isError}
                        errorMessage={memoriesQuery.error?.message}
                        onRetry={() => void memoriesQuery.refetch()}
                        index={0}
                      />
                      <DashboardWidget
                        {...widgetSpecs.deadlines}
                        rows={dashboardRows.deadlines}
                        isLoading={googleContextQuery.isLoading || googleContextQuery.isFetching}
                        isError={googleContextQuery.isError}
                        errorMessage={googleContextQuery.error?.message}
                        onRetry={() => void googleContextQuery.refetch()}
                        index={1}
                      />
                      <DashboardWidget
                        {...widgetSpecs.agents}
                        rows={dashboardRows.agents}
                        isLoading={agentsQuery.isLoading || agentsQuery.isFetching}
                        isError={agentsQuery.isError}
                        errorMessage={agentsQuery.error?.message}
                        onRetry={() => void agentsQuery.refetch()}
                        index={2}
                      />
                      <DashboardWidget
                        {...widgetSpecs.calendar}
                        rows={dashboardRows.calendar}
                        isLoading={googleContextQuery.isFetching}
                        isError={googleContextQuery.isError}
                        errorMessage={googleContextQuery.error?.message}
                        onRetry={() => void googleContextQuery.refetch()}
                        index={3}
                      />
                      <DashboardWidget
                        {...widgetSpecs.apps}
                        rows={dashboardRows.apps}
                        isLoading={false}
                        isError={false}
                        index={4}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
