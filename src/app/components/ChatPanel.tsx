import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Bot, Check, ChevronRight, History, Loader2, Mail, MoreHorizontal, Plus, RefreshCw,
  Send, Sparkles, Trash, UserPlus, Users, X,
} from "lucide-react";
import { chatApi, ChatContact, Conversation, DirectChatMessage, messagingApi } from "../api";
import { useConfirm, useFormPrompt } from "../form-modals";
import { AVATAR_COLORS, BRAND } from "../lib/brand";
import { cn } from "../lib/format";
import type { ChatMessage, UserProfile } from "../types/app-types";
import { AppAvatar } from "./AppAvatar";

export function ChatPanel({ user, onClose }: { user: UserProfile; onClose: () => void }) {
  const [tab, setTab] = useState<"messages" | "ai">("messages");

  return (
    <div className="w-[22rem] h-full flex flex-col bg-card border-l border-border">
      <div className="h-14 px-4 flex items-center justify-between border-b border-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
            {tab === "messages" ? <Mail className="w-3.5 h-3.5 text-primary" /> : <Sparkles className="w-3.5 h-3.5 text-primary" />}
          </div>
          <div>
            <p className="text-sm font-medium">{tab === "messages" ? "Messages" : "AI Assistant"}</p>
            <p className="text-[10px] text-muted-foreground">{tab === "messages" ? "Chat with teammates" : "Ask about your files"}</p>
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex border-b border-border text-xs">
        <button
          onClick={() => setTab("messages")}
          className={cn("flex-1 py-2 font-medium transition-colors", tab === "messages" ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground")}
        >
          Friends
        </button>
        <button
          onClick={() => setTab("ai")}
          className={cn("flex-1 py-2 font-medium transition-colors", tab === "ai" ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground")}
        >
          AI
        </button>
      </div>

      {tab === "messages" ? <FriendsChatPane currentUserId={user.id} /> : <AiChatPane />}
    </div>
  );
}

export function FriendsChatPane({ currentUserId }: { currentUserId: string }) {
  const [mode, setMode] = useState<"list" | "search" | "thread">("list");
  const [friends, setFriends] = useState<ChatContact[]>([]);
  const [results, setResults] = useState<ChatContact[]>([]);
  const [query, setQuery] = useState("");
  const [peer, setPeer] = useState<ChatContact | null>(null);
  const [messages, setMessages] = useState<DirectChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { confirm, modal: confirmModal } = useConfirm();
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadFriends = useCallback(async () => {
    try {
      setFriends(await messagingApi.friends());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load friends");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadFriends(); }, [loadFriends]);

  useEffect(() => {
    if (!peer) return;
    let cancelled = false;
    messagingApi.history(peer.id)
      .then(history => { if (!cancelled) setMessages(history); })
      .catch(error => toast.error(error instanceof Error ? error.message : "Unable to load chat"));
    const timer = window.setInterval(() => {
      messagingApi.unread(peer.id)
        .then(incoming => {
          if (!incoming.length || cancelled) return;
          setMessages(prev => {
            const seen = new Set(prev.map(m => m.id));
            const next = incoming.filter(m => !seen.has(m.id));
            return next.length ? [...prev, ...next] : prev;
          });
        })
        .catch(() => undefined);
    }, 2000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [peer]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, mode]);

  const searchUsers = async () => {
    try {
      setResults(await messagingApi.search(query.trim()));
      setMode("search");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Search failed");
    }
  };

  const addFriend = async (contact: ChatContact) => {
    try {
      const friend = await messagingApi.addFriend(contact.id);
      toast.success(`Added ${friend.name}`);
      await loadFriends();
      setMode("list");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not add friend");
    }
  };

  const openThread = (contact: ChatContact) => {
    setPeer(contact);
    setMessages([]);
    setMenuOpen(false);
    setMode("thread");
  };

  const clearChat = async () => {
    if (!peer) return;
    setMenuOpen(false);
    const ok = await confirm({
      title: "Clear chat for you?",
      description: `Only your view of this chat with ${peer.name} will be cleared. Their chat stays intact.`,
      confirmLabel: "Clear for me",
      danger: true,
    });
    if (!ok) return;
    try {
      await messagingApi.clear(peer.id);
      setMessages([]);
      toast.success("Chat cleared for you");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not clear chat");
    }
  };

  const deleteChat = async () => {
    if (!peer) return;
    setMenuOpen(false);
    const ok = await confirm({
      title: "Delete chat for you?",
      description: `This hides the chat on your side only. ${peer.name} keeps their messages and can still message you.`,
      confirmLabel: "Delete for me",
      danger: true,
    });
    if (!ok) return;
    try {
      await messagingApi.deleteChat(peer.id);
      setPeer(null);
      setMessages([]);
      setMode("list");
      await loadFriends();
      toast.success("Chat deleted for you");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete chat");
    }
  };

  const send = async () => {
    if (!peer || !input.trim() || sending) return;
    const body = input.trim();
    setInput("");
    setSending(true);
    try {
      const message = await messagingApi.send(peer.id, body);
      setMessages(prev => [...prev, message]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Send failed");
      setInput(body);
    } finally {
      setSending(false);
    }
  };

  if (mode === "thread" && peer) {
    return (
      <div className="flex-1 flex flex-col min-h-0">
        {confirmModal}
        <div className="sticky top-0 z-10 px-3 py-2 border-b border-border bg-card/95 backdrop-blur flex items-center gap-2 relative flex-shrink-0">
          <button onClick={() => { setMode("list"); setPeer(null); setMenuOpen(false); }} className="p-1 rounded-lg hover:bg-secondary">
            <ChevronRight className="w-4 h-4 rotate-180" />
          </button>
          <AppAvatar initials={peer.name.split(" ").map(n => n[0]).join("").slice(0, 2)} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{peer.name}</p>
            <p className="text-[10px] text-muted-foreground truncate">{peer.email}</p>
          </div>
          <button onClick={() => setMenuOpen(v => !v)} className="p-1.5 rounded-lg hover:bg-secondary" title="Chat options">
            <MoreHorizontal className="w-4 h-4" />
          </button>
          {menuOpen && (
            <div className="absolute right-2 top-10 z-20 w-44 rounded-lg border border-border bg-popover shadow-lg py-1 text-xs">
              <button onClick={clearChat} className="w-full px-3 py-2 text-left hover:bg-secondary flex items-center gap-2">
                <History className="w-3.5 h-3.5" /> Clear for me
              </button>
              <button onClick={deleteChat} className="w-full px-3 py-2 text-left hover:bg-secondary text-red-500 flex items-center gap-2">
                <Trash className="w-3.5 h-3.5" /> Delete for me
              </button>
            </div>
          )}
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2" onClick={() => setMenuOpen(false)}>
          {messages.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-8">Say hello to start the conversation</p>
          )}
          {messages.map(msg => {
            const mine = msg.sender_id === currentUserId;
            return (
              <div key={msg.id} className={cn("flex", mine && "justify-end")}>
                <div className={cn(
                  "max-w-[85%] px-3 py-2 rounded-xl text-sm leading-relaxed",
                  mine ? "bg-primary text-primary-foreground" : "bg-secondary",
                )}>
                  <p>{msg.body}</p>
                  <p className={cn("text-[10px] mt-1", mine ? "text-primary-foreground/70" : "text-muted-foreground")}>
                    {new Date(msg.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
        <div className="sticky bottom-0 z-10 p-3 border-t border-border bg-card/95 backdrop-blur flex-shrink-0">
          <div className="flex gap-2">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && send()}
              placeholder="Send a message…"
              className="flex-1 text-sm px-3 py-2 rounded-lg bg-secondary border border-border focus:outline-none focus:border-primary/50"
            />
            <button onClick={send} disabled={!input.trim() || sending} className="p-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40">
              {sending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {confirmModal}
      <div className="p-3 border-b border-border space-y-2">
        <div className="flex gap-2">
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === "Enter" && searchUsers()}
            placeholder="Search by name or email…"
            className="flex-1 text-sm px-3 py-2 rounded-lg bg-secondary border border-border focus:outline-none focus:border-primary/50"
          />
          <button onClick={searchUsers} className="px-3 py-2 rounded-lg bg-secondary text-xs font-medium hover:bg-primary hover:text-primary-foreground transition-colors">
            Search
          </button>
        </div>
        <div className="flex gap-1 text-[10px]">
          <button onClick={() => setMode("list")} className={cn("px-2 py-1 rounded-full", mode === "list" ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground")}>
            Friends
          </button>
          <button onClick={() => { setMode("search"); void searchUsers(); }} className={cn("px-2 py-1 rounded-full", mode === "search" ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground")}>
            Find people
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <p className="text-xs text-muted-foreground text-center py-10">Loading…</p>
        ) : mode === "search" ? (
          results.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-10">No people found</p>
          ) : results.map(contact => (
            <div key={contact.id} className="px-3 py-2.5 flex items-center gap-3 hover:bg-secondary/50 border-b border-border">
              <AppAvatar initials={contact.name.split(" ").map(n => n[0]).join("").slice(0, 2)} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{contact.name}</p>
                <p className="text-[11px] text-muted-foreground truncate">{contact.email}</p>
              </div>
              {contact.is_friend ? (
                <button onClick={() => openThread(contact)} className="text-[11px] px-2 py-1 rounded-lg bg-primary text-primary-foreground">Chat</button>
              ) : (
                <button onClick={() => addFriend(contact)} className="text-[11px] px-2 py-1 rounded-lg bg-secondary hover:bg-primary hover:text-primary-foreground">Add</button>
              )}
            </div>
          ))
        ) : friends.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="text-sm font-medium">No friends yet</p>
            <p className="text-xs text-muted-foreground mt-1">Search teammates in your organization to start chatting</p>
          </div>
        ) : friends.map(friend => (
          <button
            key={friend.id}
            onClick={() => openThread(friend)}
            className="w-full px-3 py-2.5 flex items-center gap-3 hover:bg-secondary/50 border-b border-border text-left"
          >
            <AppAvatar initials={friend.name.split(" ").map(n => n[0]).join("").slice(0, 2)} size="sm" />
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{friend.name}</p>
              <p className="text-[11px] text-muted-foreground truncate">{friend.email}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

const AI_DEFAULT_TITLE = "AI Chat";

const AI_WELCOME: ChatMessage = {
  id: "welcome",
  from: "ai",
  text: "Hi! I'm your NexusStorage AI assistant. I can help you find files, analyze storage usage, and answer questions about your data.",
  time: "now",
};

export function isDefaultAiTitle(title?: string) {
  return !title || title === "AI Chat" || title === "New AI chat" || title === "New conversation";
}

export function mapAiMessages(conversation: Conversation): ChatMessage[] {
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
            placeholder="Ask anything…"
            className="flex-1 text-sm px-3 py-2 rounded-lg bg-secondary border border-border focus:outline-none focus:border-primary/50 transition-colors"
          />
          <button onClick={send} disabled={!input.trim() || !conversationId || sending} className="p-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors">
            {sending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
        <div className="flex gap-1.5 mt-2 flex-wrap">
          {["Find large files", "Storage report", "Shared links"].map(s => (
            <button key={s} onClick={() => setInput(s)} className="text-[10px] px-2 py-1 rounded-full bg-secondary hover:bg-accent hover:text-accent-foreground transition-colors text-muted-foreground">
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
