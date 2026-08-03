/**
 * AI assistant pane (component).
 * Loads conversations with chatApi; keep simple local state for the active thread.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Bot, History, MoreHorizontal, Plus, RefreshCw, Send, Trash } from "lucide-react";
import { chatApi, Conversation } from "../../api";
import { useConfirm } from "../../form-modals";
import { cn } from "../../lib/format";
import type { ChatMessage } from "../../types/app-types";

const AI_DEFAULT_TITLE = "AI Chat";

const AI_WELCOME: ChatMessage = {
  id: "welcome",
  from: "ai",
  text: "Hi! I'm your Cloud Based Storage System AI assistant. I can summarize PDF, Word, Excel, and PowerPoint files of any size from your storage — try “summarize report.pdf” or “summarize budget.xlsx”.",
  time: "now",
};

function isDefaultAiTitle(title?: string) {
  return !title || title === "AI Chat" || title === "New AI chat" || title === "New conversation";
}

function mapAiMessages(conversation: Conversation): ChatMessage[] {
  if (!conversation.messages.length) return [{ ...AI_WELCOME, id: `welcome-${conversation.id}` }];
  return conversation.messages.map(message => ({
    id: message.id,
    from: message.role === "user" ? "user" : "ai",
    text: message.text,
    time: new Date(message.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  }));
}

export function AiChatPane() {
  const [messages, setMessages] = useState<ChatMessage[]>([AI_WELCOME]);
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [sending, setSending] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const { confirm, modal: confirmModal } = useConfirm();
  const bottomRef = useRef<HTMLDivElement>(null);

  const applyConversation = (conversation: Conversation, all?: Conversation[]) => {
    setConversationId(conversation.id);
    setMessages(mapAiMessages(conversation));
    if (all) setConversations(all);
  };

  const loadConversations = useCallback(async (preferId?: string | null) => {
    const list = await chatApi.conversations();
    if (!list.length) {
      const created = await chatApi.create();
      applyConversation(created, [created]);
      return;
    }
    const preferred = (preferId && list.find(c => c.id === preferId)) || list[0];
    applyConversation(preferred, list);
  }, []);

  useEffect(() => {
    loadConversations().catch(error => toast.error(error instanceof Error ? error.message : "Unable to load chat"));
  }, [loadConversations]);

  const startNewChat = async () => {
    setMenuOpen(false);
    setListOpen(false);
    try {
      const created = await chatApi.create();
      const list = await chatApi.conversations();
      applyConversation(created, list);
      toast.success("New chat started");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create chat");
    }
  };

  const clearChat = async () => {
    if (!conversationId) return;
    setMenuOpen(false);
    const ok = await confirm({
      title: "Clear AI chat?",
      description: "All messages in this conversation will be removed.",
      confirmLabel: "Clear chat",
      danger: true,
    });
    if (!ok) return;
    try {
      const cleared = await chatApi.clear(conversationId);
      applyConversation(cleared);
      toast.success("Chat cleared");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not clear chat");
    }
  };

  const deleteChat = async () => {
    if (!conversationId) return;
    setMenuOpen(false);
    const ok = await confirm({
      title: "Delete AI chat?",
      description: "This conversation will be permanently deleted.",
      confirmLabel: "Delete chat",
      danger: true,
    });
    if (!ok) return;
    try {
      await chatApi.remove(conversationId);
      await loadConversations();
      toast.success("Chat deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete chat");
    }
  };

  const switchConversation = async (id: string) => {
    setListOpen(false);
    try {
      const list = await chatApi.conversations();
      const next = list.find(c => c.id === id);
      if (next) applyConversation(next, list);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not open chat");
    }
  };

  const send = async () => {
    if (!input.trim() || !conversationId || sending) return;
    const prompt = input.trim();
    const userMsg: ChatMessage = { id: Date.now().toString(), from: "user", text: input, time: "now" };
    setMessages(p => [...p, userMsg]);
    setInput("");
    setSending(true);
    try {
      const result = await chatApi.send(conversationId, prompt);
      const aiMsg: ChatMessage = {
        id: result.assistant_message.id,
        from: "ai",
        text: result.assistant_message.text,
        time: "now",
      };
      setMessages(p => [...p, aiMsg]);
      setConversations(prev => prev.map(c => (
        c.id === conversationId
          ? { ...c, title: isDefaultAiTitle(c.title) ? prompt.slice(0, 40) : c.title }
          : c
      )));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Assistant unavailable");
    } finally {
      setSending(false);
    }
  };

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const activeTitle = conversations.find(c => c.id === conversationId)?.title || AI_DEFAULT_TITLE;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {confirmModal}
      <div className="sticky top-0 z-10 px-3 py-2 border-b border-border bg-card/95 backdrop-blur flex items-center gap-2 relative flex-shrink-0">
        <button
          onClick={() => { setListOpen(v => !v); setMenuOpen(false); }}
          className="min-w-0 flex-1 text-left px-2 py-1 rounded-lg hover:bg-secondary"
          title="Switch conversation"
        >
          <p className="text-xs font-medium truncate">{activeTitle}</p>
          <p className="text-[10px] text-muted-foreground">{conversations.length} chat{conversations.length === 1 ? "" : "s"}</p>
        </button>
        <button onClick={startNewChat} className="p-1.5 rounded-lg hover:bg-secondary text-primary" title="New AI chat">
          <Plus className="w-4 h-4" />
        </button>
        <button onClick={() => { setMenuOpen(v => !v); setListOpen(false); }} className="p-1.5 rounded-lg hover:bg-secondary" title="Chat options">
          <MoreHorizontal className="w-4 h-4" />
        </button>
        {menuOpen && (
          <div className="absolute right-2 top-10 z-20 w-40 rounded-lg border border-border bg-popover shadow-lg py-1 text-xs">
            <button onClick={startNewChat} className="w-full px-3 py-2 text-left hover:bg-secondary flex items-center gap-2">
              <Plus className="w-3.5 h-3.5" /> New AI chat
            </button>
            <button onClick={clearChat} className="w-full px-3 py-2 text-left hover:bg-secondary flex items-center gap-2">
              <History className="w-3.5 h-3.5" /> Clear chat
            </button>
            <button onClick={deleteChat} className="w-full px-3 py-2 text-left hover:bg-secondary text-red-500 flex items-center gap-2">
              <Trash className="w-3.5 h-3.5" /> Delete chat
            </button>
          </div>
        )}
        {listOpen && (
          <div className="absolute left-2 right-2 top-10 z-20 max-h-48 overflow-y-auto rounded-lg border border-border bg-popover shadow-lg py-1 text-xs">
            {conversations.map(c => (
              <button
                key={c.id}
                onClick={() => switchConversation(c.id)}
                className={cn(
                  "w-full px-3 py-2 text-left hover:bg-secondary truncate",
                  c.id === conversationId && "bg-accent text-accent-foreground font-medium",
                )}
              >
                {isDefaultAiTitle(c.title) ? AI_DEFAULT_TITLE : c.title}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3" onClick={() => { setMenuOpen(false); setListOpen(false); }}>
        {messages.map(msg => (
          <div key={msg.id} className={cn("flex gap-2", msg.from === "user" && "flex-row-reverse")}>
            {msg.from === "ai" && (
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Bot className="w-3.5 h-3.5 text-primary" />
              </div>
            )}
            <div className={cn(
              "max-w-[85%] px-3 py-2 rounded-xl text-sm leading-relaxed",
              msg.from === "ai" ? "bg-secondary" : "bg-primary text-primary-foreground"
            )}>
              {msg.text}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="sticky bottom-0 z-10 p-3 border-t border-border bg-card/95 backdrop-blur flex-shrink-0">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && send()}
            placeholder="Ask about storage or summarize a file…"
            className="flex-1 text-sm px-3 py-2 rounded-lg bg-secondary border border-border focus:outline-none focus:border-primary/50 transition-colors"
          />
          <button onClick={send} disabled={!input.trim() || !conversationId || sending} className="p-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors">
            {sending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
        <div className="flex gap-1.5 mt-2 flex-wrap">
          {["Find large files", "Storage report", "Summarize a file"].map(s => (
            <button
              key={s}
              onClick={() => setInput(s === "Summarize a file" ? "summarize " : s)}
              className="text-[10px] px-2 py-1 rounded-full bg-secondary hover:bg-accent hover:text-accent-foreground transition-colors text-muted-foreground"
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
