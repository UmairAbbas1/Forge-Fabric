import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Sparkles, X, Send, RotateCcw, Check, Ban, AlertTriangle, CheckCircle2 } from "lucide-react";
import { supabase, isRealSupabase } from "../../lib/supabase";
import { useAuth } from "../../hooks/useAuth";

// n8n webhook that runs the F&F Assistant workflow. Every request carries the
// user's own Supabase access token; n8n verifies it and applies the user's F&F
// role (customers only ever see their own company's data), so nothing typed
// here can change who the assistant thinks you are.
// Set VITE_N8N_ASSISTANT_URL (e.g. on Vercel) to the hosted n8n webhook. Local dev falls
// back to a local n8n; a production build without it hides the assistant entirely
// rather than showing a button that can't connect.
const ASSISTANT_URL =
  (import.meta.env.VITE_N8N_ASSISTANT_URL as string | undefined) ||
  (import.meta.env.DEV ? "http://localhost:5678/webhook/ff-assistant" : "");

type Msg = { id: string; role: "user" | "assistant" | "error"; text: string };

const STAFF_COPY = {
  title: "F&F Ops Assistant",
  subtitle: "Live data · you confirm every change",
  intro: "Ask about any order, stage, QC result, material, shipment or application. You can also ask me to make a change. I'll show a preview first, and nothing changes until you confirm.",
  suggestions: ["Which orders are late?", "Applications waiting for review", "What is in Sewing right now?", "Where is FF-2026-00010?"],
};
const CUSTOMER_COPY = {
  title: "F&F Assistant",
  subtitle: "Your orders, shipments and quotes",
  intro: "Ask about your orders, shipments, quality checks, quotes or applications. I can also send a change request or answer a quote for you. I'll show a preview first, and nothing is sent until you confirm.",
  suggestions: ["Where are my orders?", "Any quotes waiting for me?", "Show my shipments", "Request a change to an order"],
};

const CODE_RE = /confirm\s+([A-Z0-9]{6})\b/;
const SUCCESS_RE = /^(change applied|done[.:!]|cancelled\. nothing)/i;

function newId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// Minimal, safe formatting: line breaks, "- " bullets, **bold**, `code`. No HTML from the server is ever rendered.
function renderInline(line: string): ReactNode {
  return line.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, pi) => {
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={pi} className="font-semibold">{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`")) return <code key={pi} className="font-mono text-[11px] px-1 py-0.5 rounded bg-black/5">{part.slice(1, -1)}</code>;
    return <span key={pi}>{part}</span>;
  });
}

function renderText(text: string): ReactNode {
  // Code-fence markers (```) carry no meaning in a chat bubble; drop them, keep the content.
  return text.split("\n").filter((l) => !/^\s*```\w*\s*$/.test(l)).map((raw, li) => {
    const line = raw.trimEnd();
    const bullet = line.match(/^\s*[-*•]\s+(.*)$/);
    if (bullet) {
      return (
        <span key={li} className="flex gap-1.5 pl-1">
          <span aria-hidden className="text-muted-foreground">•</span>
          <span>{renderInline(bullet[1])}</span>
        </span>
      );
    }
    return <span key={li} className="block min-h-[0.9em]">{renderInline(line)}</span>;
  });
}

function TypingBubble() {
  return (
    <div className="flex justify-start ff-msg-in" aria-label="Assistant is typing">
      <div className="flex items-center gap-1 px-3.5 py-3 rounded-2xl rounded-bl-md bg-muted">
        {[0, 1, 2].map((i) => (
          <span key={i} className="ff-dot block w-1.5 h-1.5 rounded-full bg-[#0071E3]" style={{ animationDelay: `${i * 0.15}s` }} />
        ))}
      </div>
    </div>
  );
}

export function OpsAssistant() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [usedCodes, setUsedCodes] = useState<Record<string, "confirmed" | "cancelled">>({});
  const [sessionId, setSessionId] = useState<string>(() => {
    try {
      const saved = sessionStorage.getItem("ff_assistant_session");
      if (saved) return saved;
    } catch { /* storage unavailable */ }
    return newId();
  });
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const isCustomer = user?.role === "customer";
  const copy = isCustomer ? CUSTOMER_COPY : STAFF_COPY;

  useEffect(() => {
    try { sessionStorage.setItem("ff_assistant_session", sessionId); } catch { /* storage unavailable */ }
  }, [sessionId]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  const close = useCallback(() => {
    setClosing(true);
    setTimeout(() => { setOpen(false); setClosing(false); }, 170);
  }, []);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 80);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => { clearTimeout(t); window.removeEventListener("keydown", onKey); };
  }, [open, close]);

  // Auto-grow the composer up to its max height.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 112) + "px";
  }, [input]);

  const send = useCallback(async (raw: string) => {
    const text = raw.trim();
    if (!text || sending) return;
    setInput("");
    setMessages((m) => [...m, { id: newId(), role: "user", text }]);
    setSending(true);
    try {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      if (!accessToken) throw new Error("Your session has expired. Please sign in again.");
      const res = await fetch(ASSISTANT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatInput: text, sessionId, accessToken }),
      });
      if (!res.ok) throw new Error(res.status === 404
        ? "The assistant is not switched on in n8n yet."
        : `The assistant returned an error (${res.status}). Please try again.`);
      const body = await res.json().catch(() => ({}));
      const reply = String(body.output ?? body.text ?? body.response ?? "").trim();
      setMessages((m) => [...m, { id: newId(), role: "assistant", text: reply || "I didn't get an answer. Please try again." }]);
    } catch (err) {
      const msg = err instanceof TypeError
        ? "Can't reach the assistant right now. Please try again in a moment."
        : (err as Error).message;
      setMessages((m) => [...m, { id: newId(), role: "error", text: msg }]);
    } finally {
      setSending(false);
    }
  }, [sending, sessionId]);

  const decide = (code: string, decision: "confirmed" | "cancelled") => {
    setUsedCodes((u) => ({ ...u, [code]: decision }));
    send(`${decision === "confirmed" ? "confirm" : "cancel"} ${code}`);
  };

  const resetChat = () => {
    setMessages([]);
    setUsedCodes({});
    setSessionId(newId());
  };

  if (!user || !isRealSupabase || !ASSISTANT_URL) return null;

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`Open ${copy.title}`}
          className="ff-launcher fixed bottom-6 right-6 z-40 flex items-center gap-2 pl-3.5 pr-4 h-11 rounded-full bg-[#0071E3] text-white text-xs font-semibold shadow-lg hover:bg-[#0071E3]/90 hover:shadow-xl transition-all duration-200"
        >
          <Sparkles className="w-4 h-4" />
          Ask F&amp;F
        </button>
      )}

      {open && (
        <div
          role="dialog"
          aria-label={copy.title}
          className={`${closing ? "ff-chat-close" : "ff-chat-open"} fixed bottom-6 right-6 z-40 w-[calc(100vw-3rem)] sm:w-[400px] h-[min(600px,calc(100vh-6rem))] flex flex-col bg-white border border-border rounded-3xl shadow-2xl overflow-hidden`}
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border/60">
            <div className="relative w-8 h-8 rounded-xl bg-[#0071E3] text-white flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4" />
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold text-foreground leading-tight">{copy.title}</div>
              <div className="text-[11px] text-muted-foreground truncate">{copy.subtitle}</div>
            </div>
            <button type="button" onClick={resetChat} title="New chat" aria-label="Start a new chat"
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
              <RotateCcw className="w-4 h-4" />
            </button>
            <button type="button" onClick={close} title="Close" aria-label="Close assistant"
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3" aria-live="polite">
            {messages.length === 0 && (
              <div className="space-y-3 ff-msg-in">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Hi {user.full_name?.split(" ")[0] || "there"}. {copy.intro}
                </p>
                <div className="flex flex-wrap gap-2">
                  {copy.suggestions.map((s, i) => (
                    <button key={s} type="button" onClick={() => send(s)}
                      style={{ animationDelay: `${0.06 * (i + 1)}s` }}
                      className="ff-msg-in text-[11px] font-medium px-3 py-1.5 rounded-full border border-border bg-background hover:border-[#0071E3]/50 hover:text-[#0071E3] hover:-translate-y-0.5 transition-all">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m) => {
              if (m.role === "user") {
                return (
                  <div key={m.id} className="flex justify-end ff-msg-in">
                    <div className="max-w-[85%] px-3.5 py-2 rounded-2xl rounded-br-md bg-[#0071E3] text-white text-xs leading-relaxed whitespace-pre-wrap">{m.text}</div>
                  </div>
                );
              }
              if (m.role === "error") {
                return (
                  <div key={m.id} className="flex items-start gap-2 px-3 py-2 rounded-xl bg-destructive/10 text-destructive text-xs border border-destructive/20 ff-msg-in">
                    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span>{m.text}</span>
                  </div>
                );
              }
              const code = m.text.match(CODE_RE)?.[1];
              const used = code ? usedCodes[code] : undefined;
              const success = !code && SUCCESS_RE.test(m.text);
              return (
                <div key={m.id} className="flex justify-start ff-msg-in">
                  <div className="max-w-[90%] space-y-2">
                    <div className={`px-3.5 py-2.5 rounded-2xl rounded-bl-md text-xs leading-relaxed text-foreground ${
                      code ? "bg-amber-50 border border-amber-200" : success ? "bg-emerald-50 border border-emerald-200" : "bg-muted"
                    }`}>
                      {success && (
                        <CheckCircle2 className="ff-success-pop inline-block w-4 h-4 text-emerald-600 mr-1.5 -mt-0.5 align-middle" aria-hidden />
                      )}
                      {renderText(m.text)}
                    </div>
                    {code && (
                      used ? (
                        <div className="text-[11px] font-semibold text-muted-foreground pl-1 ff-msg-in">
                          {used === "confirmed" ? "Confirmation sent" : "Cancelled"}
                        </div>
                      ) : (
                        <div className="flex gap-2 ff-msg-in" style={{ animationDelay: "0.12s" }}>
                          <button type="button" disabled={sending} onClick={() => decide(code, "confirmed")}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0071E3] text-white text-[11px] font-semibold hover:bg-[#0071E3]/90 active:scale-95 transition-all disabled:opacity-50">
                            <Check className="w-3.5 h-3.5" /> {isCustomer ? "Confirm" : "Confirm change"}
                          </button>
                          <button type="button" disabled={sending} onClick={() => decide(code, "cancelled")}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-background text-[11px] font-semibold text-foreground hover:bg-accent active:scale-95 transition-all disabled:opacity-50">
                            <Ban className="w-3.5 h-3.5" /> Cancel
                          </button>
                        </div>
                      )
                    )}
                  </div>
                </div>
              );
            })}

            {sending && <TypingBubble />}
          </div>

          {/* Composer */}
          <form
            onSubmit={(e) => { e.preventDefault(); send(input); }}
            className="flex items-end gap-2 px-3 py-3 border-t border-border/60"
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
              rows={1}
              maxLength={2000}
              placeholder={isCustomer ? "Ask about your orders…" : "Ask or request a change…"}
              aria-label="Message"
              className="flex-1 resize-none max-h-28 px-3 py-2 rounded-xl border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-[#0071E3]/30 transition-shadow"
            />
            <button type="submit" disabled={!input.trim() || sending} aria-label="Send"
              className="h-9 w-9 shrink-0 flex items-center justify-center rounded-xl bg-[#0071E3] text-white disabled:opacity-40 hover:bg-[#0071E3]/90 active:scale-90 transition-all">
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
