import type { WinVariantProps } from "./types";

export function WinV1({ winnerLabel, youWon, accentColor = "#ffa116", onReplay }: WinVariantProps) {
    const title = youWon ? "VICTORY" : "DEFEAT";
    return (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-[#050506]">
            <div
                aria-hidden
                className="pointer-events-none absolute inset-0"
                style={{ background: `radial-gradient(52% 42% at 50% 45%, ${accentColor}22, transparent 72%)` }}
            />
            <div aria-hidden className="absolute inset-x-0 top-0 h-[7vh] bg-black" />
            <div aria-hidden className="absolute inset-x-0 bottom-0 h-[7vh] bg-black" />

            <div className="cinematic-title flex flex-col items-center px-6 text-center">
                <h1 className="text-5xl font-black tracking-[0.32em] text-white sm:text-7xl">
                    {title}
                </h1>
                <div className="mt-6 h-px w-28" style={{ background: accentColor }} />
                {winnerLabel ? (
                    <p className="mt-6 text-lg font-medium text-[#c9c9c9] sm:text-xl">{winnerLabel}</p>
                ) : null}
                {onReplay ? (
                    <button
                        type="button"
                        onClick={onReplay}
                        className="mt-12 border border-white/20 px-8 py-3 text-sm uppercase tracking-[0.25em] text-white transition hover:border-white/60 hover:bg-white/5"
                    >
                        Back to lobby
                    </button>
                ) : null}
            </div>
        </div>
    );
}
