"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Bot,
  ChevronDown,
  Clock3,
  ListPlus,
  Loader2,
  MessageSquareText,
  PanelLeft,
  Send,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useChatAssistant } from "@/hooks/use-chat-assistant";
import { useNavigationStore } from "@/store/navigation-store";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { AgentLogEntry, AgentThoughtStep, ChatMessage } from "@/types/chat";

function timeLabel(timestamp: string) {
  return new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function ConversationBadge({ conversationId, index }: { conversationId: string; index: number }) {
  return (
    <span className="rounded-full border border-border/60 bg-background/60 px-2 py-0.5 text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
      #{index + 1} - {conversationId.slice(-4)}
    </span>
  );
}

function MessageBubble({
  message,
  isLatest,
}: {
  message: ChatMessage;
  isLatest: boolean;
}) {
  const isAssistant = message.role === "assistant";
  const isSystem = message.role === "system";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      className={cn("flex w-full", isAssistant ? "justify-start" : "justify-end")}
    >
      <div
        className={cn(
          "max-w-[92%] rounded-3xl border px-4 py-3 text-sm leading-6 shadow-sm sm:max-w-[82%]",
          isAssistant
            ? "border-border/60 bg-card text-card-foreground"
            : "border-primary/20 bg-primary text-primary-foreground",
          isSystem && "mx-auto max-w-[88%] border-dashed bg-background text-muted-foreground",
        )}
      >
        <div className="mb-2 flex items-center justify-between gap-3 text-[11px] uppercase tracking-[0.22em] opacity-80">
          <span>{message.role}</span>
          <span>{timeLabel(message.timestamp)}</span>
        </div>
        <div className="whitespace-pre-wrap">{message.content || (message.status === "streaming" ? " " : "")}</div>
        {isAssistant && message.status === "streaming" && isLatest ? (
          <div className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            streaming response...
          </div>
        ) : null}
      </div>
    </motion.div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1.5 rounded-full border border-border/60 bg-background/80 px-3 py-2 text-xs text-muted-foreground">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current [animation-delay:0ms]" />
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current [animation-delay:150ms]" />
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current [animation-delay:300ms]" />
      <span className="ml-1">thinking...</span>
    </div>
  );
}

function AgentLogLine({ log }: { log: AgentLogEntry }) {
  return (
    <div className="rounded-xl border border-border/50 bg-card/70 px-3 py-2">
      <div className="flex items-center justify-between gap-3 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
        <span>{log.agentName}</span>
        <span>{timeLabel(log.timestamp)}</span>
      </div>
      <p
        className={cn(
          "mt-1 text-xs leading-5",
          log.level === "success"
            ? "text-emerald-600 dark:text-emerald-400"
            : log.level === "warning"
              ? "text-amber-600 dark:text-amber-400"
              : "text-muted-foreground",
        )}
      >
        {log.message}
      </p>
    </div>
  );
}

function AgentTimelineItem({
  step,
  expanded,
  onToggle,
}: {
  step: AgentThoughtStep;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <motion.div layout className="rounded-2xl border border-border/60 bg-background/60 p-3">
      <button
        type="button"
        className="flex w-full items-start justify-between gap-3 rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={onToggle}
        aria-expanded={expanded}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "inline-flex h-2.5 w-2.5 rounded-full",
                step.status === "completed"
                  ? "bg-emerald-500"
                  : step.status === "processing"
                    ? "bg-sky-500"
                    : step.status === "error"
                      ? "bg-rose-500"
                      : "bg-zinc-400",
              )}
            />
            <p className="truncate text-sm font-medium text-foreground">{step.agentName}</p>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{step.currentTask}</p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span className="text-xs text-muted-foreground">{step.progressPercentage}%</span>
          <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", expanded && "rotate-180")} />
        </div>
      </button>

      <div className="mt-3 overflow-hidden rounded-xl">
        <div className="h-1 overflow-hidden rounded-full bg-muted">
          <motion.div
            className="h-full rounded-full bg-primary"
            initial={{ width: 0 }}
            animate={{ width: `${step.progressPercentage}%` }}
            transition={{ duration: 0.4 }}
          />
        </div>
      </div>

      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="mt-3 overflow-hidden"
          >
            <div className="space-y-2 border-l border-border/60 pl-3">
              {step.logs.map((log) => (
                <AgentLogLine key={log.id} log={log} />
              ))}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
}

export function ChatAssistantWorkspace() {
  const {
    conversations,
    activeConversation,
    activeConversationId,
    agentThoughts,
    draft,
    setDraft,
    setActiveConversationId,
    isStreaming,
    streamingText,
    sendMessage,
    stopStreaming,
    startNewConversation,
    isHydrated,
    isLoading,
  } = useChatAssistant();

  const setActivePath = useNavigationStore((state) => state.setActivePath);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const messagesViewportRef = useRef<HTMLDivElement | null>(null);
  const [expandedLogs, setExpandedLogs] = useState<Record<string, boolean>>({});
  const [localDraft, setLocalDraft] = useState("");

  useEffect(() => {
    setActivePath("/chat-assistant");
  }, [setActivePath]);

  useEffect(() => {
    setLocalDraft(draft);
  }, [draft]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [activeConversation?.messages.length, streamingText, isStreaming, activeConversationId]);

  useEffect(() => {
    const viewport = messagesViewportRef.current;
    if (!viewport) return;
    const observer = new ResizeObserver(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    });
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  const activeMessages = activeConversation?.messages ?? [];
  const latestAssistantIndex = activeMessages.map((message) => message.role).lastIndexOf("assistant");

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const prompt = localDraft.trim();
    if (!prompt || isStreaming) return;

    setLocalDraft("");
    setDraft("");
    await sendMessage.mutateAsync(prompt);
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.12),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(168,85,247,0.10),_transparent_24%)]" />
      <div className="absolute inset-0 bg-grid-fade bg-[length:30px_30px] opacity-[0.05]" />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[1600px] flex-col px-4 py-4 lg:px-6 lg:py-6">
        <motion.header
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="mb-4 flex items-center justify-between gap-4 rounded-3xl border border-border/70 bg-card/80 px-4 py-3 shadow-soft backdrop-blur"
        >
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className={cn(buttonVariants({ variant: "outline", size: "icon" }))}
              aria-label="back to dashboard"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <p className="text-sm font-semibold tracking-tight">chat assistant</p>
              <p className="text-xs text-muted-foreground">
                multi-agent orchestration, streaming replies, and persistent memory
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <MessageSquareText className="h-4 w-4" />
            {isHydrated ? `${conversations.length} conversations` : "loading history..."}
          </div>
        </motion.header>

        <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[280px_minmax(0,1fr)_360px]">
          <aside className="min-h-0 rounded-3xl border border-border/70 bg-card/80 p-3 shadow-soft backdrop-blur">
            <div className="flex items-center justify-between px-1 py-2">
              <div>
                <p className="text-sm font-semibold">conversation history</p>
                <p className="text-xs text-muted-foreground">persistent across sessions</p>
              </div>
              <Button variant="outline" size="icon" aria-label="new conversation" onClick={startNewConversation}>
                <ListPlus className="h-4 w-4" />
              </Button>
            </div>

            <Separator className="my-3 bg-border/60" />

            <div className="max-h-[calc(100vh-180px)] space-y-2 overflow-y-auto pr-1">
              {conversations.length === 0 && !isLoading ? (
                <div className="rounded-2xl border border-dashed border-border/60 p-4 text-sm text-muted-foreground">
                  no saved conversations yet.
                </div>
              ) : null}

              {conversations.map((conversation, index) => {
                const lastUser = [...conversation.messages].reverse().find((message) => message.role === "user");
                return (
                  <motion.button
                    key={conversation.id}
                    whileHover={{ x: 2 }}
                    type="button"
                    onClick={() => setActiveConversationId(conversation.id)}
                    className={cn(
                      "w-full rounded-2xl border px-3 py-3 text-left transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      conversation.id === activeConversationId
                        ? "border-primary/40 bg-primary/10"
                        : "border-border/60 bg-background/50 hover:bg-accent/50",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium">{conversation.title.toLowerCase()}</p>
                      <ConversationBadge conversationId={conversation.id} index={index} />
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                      {lastUser?.content ?? "empty conversation"}
                    </p>
                    <div className="mt-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                      <Clock3 className="h-3.5 w-3.5" />
                      {timeLabel(conversation.updatedAt)}
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </aside>

          <section className="grid min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)_auto] rounded-3xl border border-border/70 bg-card/80 shadow-soft backdrop-blur">
            <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
              <div>
                <p className="text-sm font-semibold">{activeConversation?.title.toLowerCase() ?? "new conversation"}</p>
                <p className="text-xs text-muted-foreground">
                  streaming assistant responses with incremental state updates
                </p>
              </div>

              <div className="flex items-center gap-2">
                {isStreaming ? <TypingIndicator /> : null}
                <span className="rounded-full border border-border/60 bg-background/60 px-3 py-1 text-xs text-muted-foreground">
                  {activeConversation?.messages.length ?? 0} messages
                </span>
              </div>
            </div>

            <div
              ref={messagesViewportRef}
              className="min-h-0 overflow-y-auto px-4 py-4"
              aria-live="polite"
              aria-busy={isStreaming}
            >
              <div className="mx-auto flex max-w-4xl flex-col gap-4">
                {!isHydrated || isLoading ? (
                  <div className="space-y-3">
                    <div className="h-16 animate-pulse rounded-3xl bg-muted/70" />
                    <div className="h-24 animate-pulse rounded-3xl bg-muted/70" />
                    <div className="h-20 animate-pulse rounded-3xl bg-muted/70" />
                  </div>
                ) : activeMessages.length === 0 ? (
                  <div className="flex min-h-[420px] flex-col items-center justify-center rounded-3xl border border-dashed border-border/60 bg-background/40 px-6 text-center">
                    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <Bot className="h-6 w-6" />
                    </div>
                    <p className="text-lg font-semibold">start a new strategy session</p>
                    <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                      ask for study plans, research summaries, workspace actions, or anything that should
                      trigger a multi-agent workflow.
                    </p>
                  </div>
                ) : (
                  activeMessages.map((message, index) => (
                    <MessageBubble key={message.id} message={message} isLatest={index === latestAssistantIndex} />
                  ))
                )}

                {isStreaming && streamingText ? (
                  <MessageBubble
                    message={{
                      id: "streaming-preview",
                      role: "assistant",
                      content: streamingText,
                      timestamp: new Date().toISOString(),
                      status: "streaming",
                    }}
                    isLatest
                  />
                ) : null}

                <div ref={messagesEndRef} />
              </div>
            </div>

            <div className="border-t border-border/60 p-4">
              <form onSubmit={handleSubmit} className="mx-auto max-w-4xl">
                <div className="rounded-3xl border border-border/60 bg-background/70 p-3">
                  <Textarea
                    value={localDraft}
                    onChange={(event) => {
                      const next = event.target.value;
                      setLocalDraft(next);
                      setDraft(next);
                    }}
                    placeholder="ask a question, request a plan, or start an orchestration..."
                    className="min-h-[110px] border-0 bg-transparent px-2 py-1 shadow-none focus-visible:ring-0"
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        const prompt = localDraft.trim();
                        if (!prompt || isStreaming) return;
                        setLocalDraft("");
                        setDraft("");
                        void sendMessage.mutateAsync(prompt);
                      }
                    }}
                  />

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="text-xs text-muted-foreground">
                      press <span className="rounded bg-muted px-1.5 py-0.5">enter</span> to send,{" "}
                      <span className="rounded bg-muted px-1.5 py-0.5">shift</span> +{" "}
                      <span className="rounded bg-muted px-1.5 py-0.5">enter</span> for a new line
                    </div>
                    <div className="flex items-center gap-2">
                      {isStreaming ? (
                        <Button type="button" variant="outline" onClick={stopStreaming}>
                          <X className="mr-2 h-4 w-4" />
                          stop
                        </Button>
                      ) : null}
                      <Button type="submit" disabled={!localDraft.trim() || isStreaming}>
                        {isStreaming ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                        send
                      </Button>
                    </div>
                  </div>
                </div>
              </form>
            </div>
          </section>

          <aside className="min-h-0 rounded-3xl border border-border/70 bg-card/80 p-3 shadow-soft backdrop-blur">
            <div className="flex items-center justify-between px-1 py-2">
              <div>
                <p className="text-sm font-semibold">active agent thoughts</p>
                <p className="text-xs text-muted-foreground">execution timeline with expandable logs</p>
              </div>
              <PanelLeft className="h-4 w-4 text-muted-foreground" />
            </div>

            <Separator className="my-3 bg-border/60" />

            <div className="max-h-[calc(100vh-180px)] space-y-3 overflow-y-auto pr-1">
              {agentThoughts.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border/60 p-4 text-sm text-muted-foreground">
                  no active execution yet.
                </div>
              ) : null}

              {agentThoughts.map((step) => {
                const expanded = expandedLogs[step.id] ?? step.status !== "completed";
                return (
                  <AgentTimelineItem
                    key={step.id}
                    step={step}
                    expanded={expanded}
                    onToggle={() =>
                      setExpandedLogs((current) => ({
                        ...current,
                        [step.id]: !current[step.id],
                      }))
                    }
                  />
                );
              })}
            </div>

            <Card className="mt-3 border-border/60 bg-background/70">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">execution summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>progress</span>
                  <span>{agentThoughts.at(-1)?.progressPercentage ?? 0}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <motion.div
                    className="h-full rounded-full bg-primary"
                    animate={{ width: `${agentThoughts.at(-1)?.progressPercentage ?? 0}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
                <p className="text-xs leading-5 text-muted-foreground">
                  simulated inter-agent communication is routed through memory, research, planner, and
                  scheduler agents.
                </p>
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>
    </main>
  );
}
