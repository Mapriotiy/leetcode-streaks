import { X } from "lucide-react";

const SECTIONS = [
    {
        title: "Capture provinces",
        body: "Click a province to open its LeetCode problem. Solve it to plant your flag. If someone already owns it, beat their runtime to steal it.",
    },
    {
        title: "Points",
        body: "Easy +200, Medium +350, Hard +500. First capture of a province pays a bonus. Holding every province in a region gives region control points while you keep it.",
    },
    {
        title: "Power-ups",
        body: "Completing a region grants a random power-up (you hold up to 2). Reroll swaps a free province's problem, Fortify shields your province from recapture for 6 hours, Siege downgrades a free province's problem.",
    },
    {
        title: "Winning",
        body: "Own over half the map to win. In region-domination games, control most regions instead.",
    },
];

export function HowToPlayModal({ onClose }: { onClose: () => void }) {
    return (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-lg border border-[#3a3a3a] bg-[#202020] p-6 shadow-2xl">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-[#eff1f6]">How to play</h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className="grid h-8 w-8 place-items-center rounded-md border border-[#3a3a3a] text-[#8a8a8a] transition hover:border-white/30 hover:text-white"
                    >
                        <X size={16} />
                    </button>
                </div>

                <div className="mt-4 space-y-3">
                    {SECTIONS.map((section) => (
                        <div key={section.title} className="rounded-md border border-[#3a3a3a] bg-[#1f1f1f] p-3">
                            <p className="text-sm font-semibold text-[#ffd08a]">{section.title}</p>
                            <p className="mt-1 text-sm leading-relaxed text-[#b3b3b3]">{section.body}</p>
                        </div>
                    ))}
                </div>

                <button
                    type="button"
                    onClick={onClose}
                    className="mt-5 w-full rounded-md bg-[#ffa116] px-4 py-2.5 text-sm font-semibold text-[#111] transition hover:bg-[#ffb84d]"
                >
                    Got it
                </button>
            </div>
        </div>
    );
}
