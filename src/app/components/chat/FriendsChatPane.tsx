/**
 * Friends chat pane — TanStack Query + small UI pieces.
 * Beginner: useQuery loads friends/history; useMutation sends messages.
 */
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ChevronRight, History, MoreHorizontal, RefreshCw, Send, Trash,
} from "lucide-react";
import { ChatContact, messagingApi } from "../../api";
import { useConfirm } from "../../form-modals";
import {
  useAddFriendMutation,
  useChatHistoryQuery,
  useFriendsQuery,
  useSendDirectMessageMutation,
} from "../../hooks/useFriends";
import { cn } from "../../lib/format";
import { AppAvatar } from "../AppAvatar";

export function FriendsChatPane({ currentUserId }: { currentUserId: string }) {
  const [mode, setMode] = useState<"list" | "search" | "thread">("list");
  const [results, setResults] = useState<ChatContact[]>([]);
  const [query, setQuery] = useState("");
  const [peer, setPeer] = useState<ChatContact | null>(null);
  const [input, setInput] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const { confirm, modal: confirmModal } = useConfirm();
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: friends = [], isLoading } = useFriendsQuery();
  const { data: messages = [], refetch: refetchHistory } = useChatHistoryQuery(peer?.id);
  const addFriendMutation = useAddFriendMutation();
  const sendMutation = useSendDirectMessageMutation(peer?.id);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, mode]);

  const searchUsers = async () => {
    try {
      setResults(await messagingApi.search(query.trim()));
      setMode("search");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Search failed");
    }
  };

  const openThread = (contact: ChatContact) => {
    setPeer(contact);
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
      await refetchHistory();
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
      setMode("list");
      toast.success("Chat deleted for you");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete chat");
    }
  };

  const send = () => {
    if (!peer || !input.trim() || sendMutation.isPending) return;
    const body = input.trim();
    setInput("");
    sendMutation.mutate(body, {
      onError: () => setInput(body),
    });
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
            <button onClick={send} disabled={!input.trim() || sendMutation.isPending} className="p-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40">
              {sendMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
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
        {isLoading ? (
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
                <button
                  onClick={() => addFriendMutation.mutate(contact.id, { onSuccess: () => setMode("list") })}
                  className="text-[11px] px-2 py-1 rounded-lg bg-secondary hover:bg-primary hover:text-primary-foreground"
                >
                  Add
                </button>
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
