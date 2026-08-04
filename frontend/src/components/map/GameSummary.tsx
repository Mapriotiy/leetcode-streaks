import { X } from "lucide-react";

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
    onClose: () => void;
};

export function GameSummary({ open, winner, rows, totalCount, currentUserId, onClose }: GameSummaryProps) {
    if (!open) return null;

    const youWon = winner?.winner_user_id === currentUserId;
    const ranked = [...rows].sort((a, b) => b.points - a.points);

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
                    onClick={onClose}
                    className="mt-5 w-full rounded-md bg-[#ffa116] px-4 py-2.5 text-sm font-semibold text-[#111] transition hover:bg-[#ffb84d]"
                >
                    Continue
                </button>
            </div>
        </div>
    );
}
