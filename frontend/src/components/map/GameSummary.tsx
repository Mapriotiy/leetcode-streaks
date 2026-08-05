import { useState } from "react";
import { Copy, Download, Share2, X } from "lucide-react";
import { generateShareCard, type ShareCardData } from "../../utils/shareCard";

export type WinnerInfo = {
    winner_user_id: number | null;
    winner_faction_id: number | null;
    label: string | null;
};

export type SummaryRow = {
    key: number;
    label: string;
    color: string;
    count: number;
    points: number;
    breakdown: string;
    regionControlPoints: number;
};

type GameSummaryProps = {
    open: boolean;
    winner: WinnerInfo | null;
    rows: SummaryRow[];
    totalCount: number;
    currentUserId: number;
    lobbyId: number;
    onClose: () => void;
};

export function GameSummary({ open, winner, rows, totalCount, currentUserId, lobbyId, onClose }: GameSummaryProps) {
    const [shareOpen, setShareOpen] = useState(false);
    const [cardUrl, setCardUrl] = useState<string | null>(null);
    const [generating, setGenerating] = useState(false);
    const [copied, setCopied] = useState(false);

    if (!open) return null;

    const youWon = winner?.winner_user_id === currentUserId;
    const ranked = [...rows].sort((a, b) => b.points - a.points);
    const top = ranked[0];

    const handleShare = async () => {
        setGenerating(true);
        try {
            const data: ShareCardData = {
                title: youWon ? "VICTORY" : "DEFEAT",
                name: winner?.label ?? top?.label ?? "MapCode",
                accentColor: top?.color ?? "#ffa116",
                points: top?.points ?? 0,
                provinces: top?.count ?? 0,
            };
            setCardUrl(await generateShareCard(data));
            setShareOpen(true);
        } finally {
            setGenerating(false);
        }
    };

    const replayUrl = `${window.location.origin}${window.location.pathname}?replay=${lobbyId}`;

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(replayUrl);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2000);
        } catch {
            /* ignore */
        }
    };

    return (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-lg border border-[#3a3a3a] bg-[#202020] p-6 shadow-2xl">
                <div className="flex items-start justify-between">
                    <div>
                        <h2 className="text-xl font-semibold text-[#eff1f6]">
                            {winner?.label
                                ? youWon
                                    ? "🏆 You win!"
                                    : `🏆 ${winner.label} wins!`
                                : "It's a draw"}
                        </h2>
                        <p className="mt-1 text-sm text-[#8a8a8a]">
                            {totalCount} provinces on the map
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="grid h-8 w-8 place-items-center rounded-md border border-[#3a3a3a] text-[#8a8a8a] transition hover:border-white/30 hover:text-white"
                    >
                        <X size={16} />
                    </button>
                </div>

                <div className="mt-4 space-y-2">
                    {ranked.map((row, index) => {
                        const isYou = row.key === currentUserId;
                        const isWinner =
                            winner?.winner_user_id === row.key ||
                            (winner?.winner_faction_id != null && row.key === winner.winner_faction_id);
                        return (
                            <div
                                key={row.key}
                                className={`flex items-center gap-3 rounded-md border px-3 py-2.5 ${
                                    isYou ? "border-[#00d9ff]/50 bg-[#00d9ff]/10" : "border-[#3a3a3a] bg-[#1f1f1f]"
                                }`}
                            >
                                <span className="w-5 text-center text-sm font-bold text-[#8a8a8a]">
                                    {index + 1}
                                </span>
                                <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: row.color }} />
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-semibold text-[#eff1f6]">
                                        {row.label}
                                        {isWinner ? " 🏆" : ""}
                                        {isYou ? " (you)" : ""}
                                    </p>
                                    <p className="truncate text-xs text-[#8a8a8a]">
                                        {row.count} provinces · {row.breakdown}
                                    </p>
                                </div>
                                <span className="text-sm font-bold tabular-nums text-[#ffa116]">
                                    {row.points}
                                </span>
                            </div>
                        );
                    })}
                </div>

                <button
                    type="button"
                    onClick={() => void handleShare()}
                    disabled={generating}
                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md border border-[#00d9ff]/50 bg-[#00d9ff]/10 px-4 py-2.5 text-sm font-semibold text-[#7fe8ff] transition hover:bg-[#00d9ff]/20 disabled:opacity-60"
                >
                    <Share2 size={16} />
                    {generating ? "Making your card…" : "Share victory card"}
                </button>

                <button
                    type="button"
                    onClick={onClose}
                    className="mt-2 w-full rounded-md bg-[#ffa116] px-4 py-2.5 text-sm font-semibold text-[#111] transition hover:bg-[#ffb84d]"
                >
                    Continue
                </button>
            </div>

            {shareOpen && cardUrl ? (
                <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-sm overflow-hidden rounded-lg border border-[#3a3a3a] bg-[#202020] shadow-2xl">
                        <img src={cardUrl} alt="Share card" className="block w-full" />
                        <div className="flex flex-col gap-2 p-4">
                            <a
                                href={cardUrl}
                                download="mapcode-share.png"
                                className="inline-flex items-center justify-center gap-2 rounded-md bg-[#ffa116] px-4 py-2.5 text-sm font-semibold text-[#111] transition hover:bg-[#ffb84d]"
                            >
                                <Download size={16} />
                                Download image
                            </a>
                            <button
                                type="button"
                                onClick={() => void handleCopy()}
                                className="inline-flex items-center justify-center gap-2 rounded-md border border-[#3a3a3a] bg-[#1f1f1f] px-4 py-2.5 text-sm font-semibold text-[#d7d7d7] transition hover:border-[#00d9ff]/60 hover:text-[#7fe8ff]"
                            >
                                <Copy size={16} />
                                {copied ? "Replay link copied!" : "Copy replay link"}
                            </button>
                            <button
                                type="button"
                                onClick={() => setShareOpen(false)}
                                className="text-sm text-[#8a8a8a] transition hover:text-white"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
