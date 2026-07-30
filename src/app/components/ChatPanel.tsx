/**
 * Chat shell — tabs only. Friends and AI live in their own components.
 */
import { useState } from "react";
import { Mail, Sparkles, X } from "lucide-react";
import { cn } from "../lib/format";
import type { UserProfile } from "../types/app-types";
import { AiChatPane } from "./chat/AiChatPane";
import { FriendsChatPane } from "./chat/FriendsChatPane";

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
