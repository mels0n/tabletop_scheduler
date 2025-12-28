"use client";

import { useState } from "react";
import { sendDiscordMagicLogin } from "@/app/actions";
import { Send, RefreshCw, Lock } from "lucide-react";

export function DiscordLoginSender() {
    const [handle, setHandle] = useState("");
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const handleRecovery = async () => {
        if (!handle) return;
        setLoading(true);
        setMsg(null);

        const res = await sendDiscordMagicLogin(handle);

        if (res.success) {
            setMsg({ type: 'success', text: res.message || "Link sent!" });
        } else {
            setMsg({ type: 'error', text: res.error || "Failed to find user" });
        }
        setLoading(false);
    };

    return (
        <div className="bg-slate-900 border border-slate-700 rounded-xl p-6">
            <h4 className="text-md font-semibold text-slate-200 mb-2 flex items-center gap-2">
                <span className="text-[#5865F2]">Discord</span> Sync
            </h4>
            <p className="text-slate-400 text-sm mb-4">
                Enter your Discord Username to receive a Magic Link in your DMs.
                <br />
                <span className="text-xs text-slate-500 italic">(Requires you to have voted via &quot;Log in with Discord&quot; previously)</span>
            </p>

            <div className="flex flex-col gap-3">
                <input
                    type="text"
                    placeholder="Username"
                    value={handle}
                    onChange={(e) => setHandle(e.target.value)}
                    className="bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-sm text-white focus:ring-2 focus:ring-[#5865F2] outline-none"
                    onKeyDown={(e) => e.key === 'Enter' && handleRecovery()}
                />
                <button
                    onClick={handleRecovery}
                    disabled={loading || !handle}
                    className="bg-[#5865F2] hover:bg-[#4752C4] disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                >
                    {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    Send Link
                </button>
            </div>

            {msg && (
                <div className={`mt-4 p-3 rounded-lg text-sm border ${msg.type === 'success'
                    ? 'bg-green-900/20 border-green-800 text-green-300'
                    : 'bg-amber-900/20 border-amber-800 text-amber-300'
                    }`}>
                    <p className="font-medium mb-1">{msg.text}</p>
                </div>
            )}
        </div>
    );
}
