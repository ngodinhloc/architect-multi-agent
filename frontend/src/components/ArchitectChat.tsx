"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import SearchBar from "./SearchBar";
import PlanCard from "./PlanCard";
import FinalReplyCard from "./FinalReplyCard";
import LoadingSkeleton from "./LoadingSkeleton";
import { newChat, continueChat, getChat, stopChat } from "@/lib/api";
import {
  AgentStatus, ChatInterface, MessageInterface,
  ReplyInterface, FinalReplyInterface,
} from "@/types/chat";
import { BrainCircuit } from "lucide-react";

const IDLE_TIMEOUT_MS = 30_000;

type ReplyContent = ReplyInterface | FinalReplyInterface | null;

interface CompletedTurn {
  userMessage: string;
  thinkingMessages: MessageInterface[];
  result: ReplyContent;
  reply: string | null;
}

interface Turn {
  userMessage: string;
  agentMessages: MessageInterface[];
  result: ReplyContent;
  reply: string | null;
  error: string | null;
}

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("**") && p.endsWith("**")
          ? <strong key={i}>{p.slice(2, -2)}</strong>
          : <span key={i}>{p}</span>
      )}
    </>
  );
}

function ThinkingContent({ content }: { content: string }) {
  const [header, ...body] = content.split("\n");
  const comments = body.filter((l) => l.trim() && l.trim() !== "Comments:");

  const arrowIdx = header.indexOf(" → ");
  const label = arrowIdx >= 0 ? header.slice(0, arrowIdx) : header;
  const status = arrowIdx >= 0 ? header.slice(arrowIdx + 3) : null;

  return (
    <div className="flex-1">
      <p>{renderInline(label)}</p>
      {status && <p className="mt-0.5 text-indigo-300">→ {status}</p>}
      {comments.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {comments.map((line, i) => (
            <li key={i} className="flex items-start gap-1.5 text-zinc-400">
              <span className="mt-0.5 shrink-0 text-indigo-400">•</span>
              <span>{renderInline(line.replace(/^- /, ""))}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function isReplyInterface(c: unknown): c is ReplyInterface {
  return typeof c === "object" && c !== null && "epic" in c && "tickets" in c;
}

function isFinalReplyInterface(c: unknown): c is FinalReplyInterface {
  return typeof c === "object" && c !== null && "epicId" in c && "ticketIds" in c;
}

function splitTurns(messages: MessageInterface[]): Turn[] {
  const turns: Turn[] = [];
  let userMessage = "";
  let agentMessages: MessageInterface[] = [];

  for (const msg of messages) {
    if (msg.actor === "User") {
      userMessage = typeof msg.content === "string" ? msg.content : "";
      agentMessages = [];
    } else if (msg.actor === "Agent") {
      agentMessages.push(msg);
      if (msg.agentStatus === "hasReplied") {
        const content = msg.content;
        const result: ReplyContent = isReplyInterface(content)
          ? content
          : isFinalReplyInterface(content)
          ? content
          : null;
        const reply: string | null = typeof content === "string" ? content : null;
        turns.push({ userMessage, agentMessages: [...agentMessages], result, reply, error: null });
        userMessage = "";
        agentMessages = [];
      }
    }
  }
  return turns;
}

function buildWsUrl(): string {
  const base = process.env.NEXT_PUBLIC_WS_URL;
  if (base) return `${base}/ws`;
  if (typeof window !== "undefined") {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${window.location.hostname}:8000/ws`;
  }
  return "ws://localhost:8000/ws";
}

export default function ArchitectChat() {
  const searchParams = useSearchParams();
  const session = searchParams.get("session");
  const chatId = searchParams.get("chat");


  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ReplyContent>(null);
  const [reply, setReply] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageInterface[]>([]);
  const [isThinkingIdle, setIsThinkingIdle] = useState(false);
  const [userMessage, setUserMessage] = useState<string | null>(null);
  const [completedTurns, setCompletedTurns] = useState<CompletedTurn[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const idleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeIdRef = useRef<string | null>(null);
  const conversationIdRef = useRef<string | null>(null);
  const agentStatusRef = useRef<AgentStatus | null>(null);
  const prevThinkingCountRef = useRef(0);
  const agentMessageOffsetRef = useRef(0);
  const conversationEndRef = useRef<HTMLDivElement | null>(null);

  function disconnectWs() {
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.close();
      wsRef.current = null;
    }
  }

  function cancelIdleTimer() {
    if (idleTimeoutRef.current) {
      clearTimeout(idleTimeoutRef.current);
      idleTimeoutRef.current = null;
    }
  }

  function endConversation() {
    disconnectWs();
    cancelIdleTimer();
    activeIdRef.current = null;
    agentStatusRef.current = null;
    setLoading(false);
  }

  // New chat — full reset
  useEffect(() => {
    disconnectWs();
    cancelIdleTimer();
    activeIdRef.current = null;
    conversationIdRef.current = null;
    agentStatusRef.current = null;
    prevThinkingCountRef.current = 0;
    agentMessageOffsetRef.current = 0;
    setLoading(false);
    setResult(null);
    setReply(null);
    setError(null);
    setMessages([]);
    setIsThinkingIdle(false);
    setUserMessage(null);
    setCompletedTurns([]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  // Load history chat
  useEffect(() => {
    if (!chatId) return;
    disconnectWs();
    cancelIdleTimer();
    activeIdRef.current = null;
    conversationIdRef.current = null;
    agentStatusRef.current = null;
    prevThinkingCountRef.current = 0;
    agentMessageOffsetRef.current = 0;
    setResult(null);
    setReply(null);
    setError(null);
    setMessages([]);
    setIsThinkingIdle(false);
    setLoading(true);
    setCompletedTurns([]);

    getChat(chatId)
      .then((chat) => {
        const turns = splitTurns(chat.messages);
        if (turns.length === 0) return;

        const lastTurn = turns[turns.length - 1];
        const prevTurns = turns.slice(0, -1);

        setUserMessage(lastTurn.userMessage);
        setMessages(lastTurn.agentMessages);
        if (lastTurn.result) setResult(lastTurn.result);
        else if (lastTurn.reply) setReply(lastTurn.reply);
        else if (lastTurn.error) setError(lastTurn.error);

        setCompletedTurns(
          prevTurns.map((t) => ({
            userMessage: t.userMessage,
            thinkingMessages: t.agentMessages.filter((m) => m.agentStatus === "isThinking"),
            result: t.result,
            reply: t.reply,
          }))
        );
        agentMessageOffsetRef.current = prevTurns.reduce((acc, t) => acc + t.agentMessages.length, 0);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load conversation."))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId]);

  const resetIdleTimer = useCallback(() => {
    if (!activeIdRef.current) return;
    cancelIdleTimer();
    idleTimeoutRef.current = setTimeout(async () => {
      const id = activeIdRef.current;
      if (!id) return;
      if (agentStatusRef.current !== "hasReplied") { resetIdleTimer(); return; }
      endConversation();
      try { await stopChat(id); } catch { /* best-effort */ }
    }, IDLE_TIMEOUT_MS);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const events = ["mousemove", "keydown", "click", "touchstart"] as const;
    events.forEach((e) => window.addEventListener(e, resetIdleTimer));
    return () => {
      events.forEach((e) => window.removeEventListener(e, resetIdleTimer));
      disconnectWs();
      cancelIdleTimer();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetIdleTimer]);

  function subscribeToChat(id: string) {
    disconnectWs();
    const ws = new WebSocket(buildWsUrl());
    wsRef.current = ws;

    ws.onopen = () => ws.send(JSON.stringify({ event: "subscribe", data: id }));

    ws.onmessage = (evt) => {
      try {
        const { event: type, data } = JSON.parse(evt.data as string) as {
          event: string; data: ChatInterface | string;
        };

        if (type === "error") {
          endConversation();
          setError(typeof data === "string" ? data : "Agent error.");
          return;
        }
        if (type !== "chat-update") return;

        const chat = data as ChatInterface;
        agentStatusRef.current = chat.agentStatus ?? null;

        const allAgent = chat.messages.filter((m) => m.actor === "Agent");
        const currentTurn = allAgent.slice(agentMessageOffsetRef.current);
        const thinkingCount = currentTurn.filter((m) => m.agentStatus === "isThinking").length;
        setIsThinkingIdle(thinkingCount === prevThinkingCountRef.current);
        prevThinkingCountRef.current = thinkingCount;
        setMessages(currentTurn);

        if (chat.agentStatus === "hasReplied") {
          endConversation();
          const finalMsg = [...chat.messages].reverse().find((m) => m.agentStatus === "hasReplied");
          if (finalMsg) {
            const c = finalMsg.content;
            if (isReplyInterface(c) || isFinalReplyInterface(c)) {
              setResult(c);
            } else if (typeof c === "string") {
              setReply(c);
            } else {
              setError("The agent did not return a response.");
            }
          }
          stopChat(id).catch(() => {});
          window.dispatchEvent(new CustomEvent("chat-completed"));
        }
      } catch { /* ignore parse errors */ }
    };

    ws.onerror = () => { endConversation(); setError("Connection error. Please try again."); };
    ws.onclose = (evt) => {
      if (!evt.wasClean && activeIdRef.current === id) {
        endConversation(); setError("Connection lost. Please try again.");
      }
    };
  }

  async function handleSearch(message: string) {
    disconnectWs();
    cancelIdleTimer();
    prevThinkingCountRef.current = 0;
    agentMessageOffsetRef.current = 0;
    setLoading(true);
    setError(null);
    setReply(null);
    setResult(null);
    setMessages([]);
    setIsThinkingIdle(false);
    setUserMessage(message);
    setCompletedTurns([]);

    try {
      const { id } = await newChat(message);
      activeIdRef.current = id;
      conversationIdRef.current = id;
      resetIdleTimer();
      subscribeToChat(id);
    } catch (err) {
      setLoading(false);
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  async function handleContinue(message: string) {
    const id = conversationIdRef.current ?? chatId;
    if (!id) return;

    if (userMessage) {
      setCompletedTurns((prev) => [
        ...prev,
        {
          userMessage,
          thinkingMessages: messages.filter((m) => m.agentStatus === "isThinking"),
          result,
          reply,
        },
      ]);
    }

    agentMessageOffsetRef.current += messages.length;
    disconnectWs();
    cancelIdleTimer();
    prevThinkingCountRef.current = 0;
    setLoading(true);
    setError(null);
    setReply(null);
    setResult(null);
    setMessages([]);
    setIsThinkingIdle(false);
    setUserMessage(message);

    try {
      await continueChat(id, message);
      activeIdRef.current = id;
      resetIdleTimer();
      subscribeToChat(id);
    } catch (err) {
      setLoading(false);
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  function handleAccept() {
    handleContinue("Looks good, please create the epic and tickets.");
  }

  const thinkingMessages = messages.filter((m) => m.agentStatus === "isThinking");
  const hasConversation = userMessage !== null || completedTurns.length > 0;
  const currentConversationId = conversationIdRef.current ?? chatId;
  const latestResultIsReply = isReplyInterface(result);

  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, result, isThinkingIdle, completedTurns]);

  if (!hasConversation) {
    return (
      <div className="flex h-full flex-col items-center bg-zinc-50 px-4 pt-16 dark:bg-zinc-950">
        <div className="flex w-full max-w-2xl flex-col items-center gap-6 text-center">
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
            <BrainCircuit size={28} />
            <span className="text-2xl font-bold tracking-tight">Multi-Agent Architect</span>
          </div>
          <p className="max-w-md text-sm text-zinc-500 dark:text-zinc-400">
            Describe a software requirement. The AI will design a solution architecture and create development tickets.
          </p>
          <SearchBar onSearch={handleSearch} loading={loading} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-zinc-50 dark:bg-zinc-950">
      <div className="flex-1 overflow-y-auto px-4 py-8">
        <div className="mx-auto max-w-3xl space-y-6">

          {/* Completed turns */}
          {completedTurns.map((turn, i) => (
            <div key={i} className="space-y-4">
              <div className="flex justify-start">
                <div className="max-w-xl rounded-2xl rounded-tl-none bg-indigo-600 px-4 py-3 text-sm text-white shadow-sm">
                  {turn.userMessage}
                </div>
              </div>
              {turn.thinkingMessages.length > 0 && (
                <ul className="space-y-3 rounded-xl bg-zinc-900 p-4 subpixel-antialiased dark:bg-zinc-950">
                  {turn.thinkingMessages.map((m, j) => (
                    <li key={j} className="flex items-start gap-3 text-sm text-zinc-200">
                      <span className="shrink-0 pt-0.5 text-sm text-zinc-500">
                        {new Date(m.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                      </span>
                      <span className="shrink-0 pt-0.5 text-indigo-400">›</span>
                      <ThinkingContent content={typeof m.content === "string" ? m.content : ""} />
                    </li>
                  ))}
                </ul>
              )}
              {turn.reply && (
                <div className="flex justify-end">
                  <div className="max-w-xl rounded-2xl rounded-tr-none bg-zinc-200 px-4 py-3 text-sm text-zinc-800 shadow-sm dark:bg-zinc-700 dark:text-zinc-100">
                    {turn.reply}
                  </div>
                </div>
              )}
              {turn.result && isReplyInterface(turn.result) && (
                <PlanCard reply={turn.result} showActions={false} />
              )}
              {turn.result && isFinalReplyInterface(turn.result) && (
                <FinalReplyCard reply={turn.result} />
              )}
            </div>
          ))}

          {/* Current turn */}
          {userMessage && (
            <>
              <div className="flex justify-start">
                <div className="max-w-xl rounded-2xl rounded-tl-none bg-indigo-600 px-4 py-3 text-sm text-white shadow-sm">
                  {userMessage}
                </div>
              </div>

              {/* Thinking log */}
              {(thinkingMessages.length > 0 || (isThinkingIdle && loading)) && (
                <ul className="space-y-3 rounded-xl bg-zinc-900 p-4 subpixel-antialiased dark:bg-zinc-950">
                  {thinkingMessages.map((m, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-zinc-200">
                      <span className="shrink-0 pt-0.5 text-sm text-zinc-500">
                        {new Date(m.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                      </span>
                      <span className="shrink-0 pt-0.5 text-indigo-400">›</span>
                      <ThinkingContent content={typeof m.content === "string" ? m.content : ""} />
                    </li>
                  ))}
                  {isThinkingIdle && loading && (
                    <li className="flex items-center gap-3 animate-pulse text-sm text-zinc-500">
                      <span className="text-indigo-400">›</span>
                      Thinking...
                    </li>
                  )}
                </ul>
              )}

              {loading && <LoadingSkeleton />}

              {reply && !loading && (
                <div className="flex justify-end">
                  <div className="max-w-xl rounded-2xl rounded-tr-none bg-zinc-200 px-4 py-3 text-sm text-zinc-800 shadow-sm dark:bg-zinc-700 dark:text-zinc-100">
                    {reply}
                  </div>
                </div>
              )}

              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
                  {error}
                </div>
              )}

              {result && !loading && isReplyInterface(result) && (
                <PlanCard
                  reply={result}
                  showActions
                  onAccept={handleAccept}
                />
              )}

              {result && !loading && isFinalReplyInterface(result) && (
                <FinalReplyCard reply={result} />
              )}
            </>
          )}

          <div ref={conversationEndRef} />
        </div>
      </div>

      {/* Input bar */}
      <div className="border-t border-zinc-200 bg-zinc-50 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto max-w-3xl">
          <SearchBar
            onSearch={currentConversationId ? handleContinue : handleSearch}
            loading={loading}
            placeholder={latestResultIsReply ? "Refine the plan or say 'Looks good'…" : "Ask a follow-up…"}
          />
        </div>
      </div>
    </div>
  );
}
