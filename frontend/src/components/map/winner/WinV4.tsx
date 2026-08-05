import type { WinVariantProps } from "./types";

const SCANLINES = `repeating-linear-gradient(0deg, rgba(255,255,255,0.03) 0px, rgba(255,255,255,0.03) 1px, transparent 1px, transparent 4px)`;

export function WinV4({ winnerLabel, youWon, accentColor = "#00d9ff", onReplay, background }: WinVariantProps) {
    const title = youWon ? "VICTORY" : "SYSTEM FAILURE";
    return (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-[#0a0a0c]">
            {background}
            <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: SCANLINES }} />
            <div
                aria-hidden
                className="pointer-events-none absolute inset-0"
                style={{ background: `radial-gradient(45% 35% at 50% 50%, ${accentColor}14, transparent 75%)` }}
            />

            <div className="cinematic-title relative z-10 flex flex-col items-center px-6 text-center">
                <div aria-hidden className="pointer-events-none absolute -inset-12" style={{ background: "radial-gradient(70% 70% at 50% 50%, rgba(0,0,0,0.55), transparent 78%)" }} />
                <h1
                    className="relative font-mono text-5xl font-black tracking-tight sm:text-7xl"
                    style={{ color: "#f2f2f2" }}
                >
                    <span
                        aria-hidden
                        className="glitch-a absolute inset-0 text-[#ff2d55]"
                        style={{ clipPath: "inset(0 0 86% 0)" }}
                    >
                        {title}
                    </span>
                    <span
                        aria-hidden
                        className="glitch-b absolute inset-0"
                        style={{ color: accentColor, clipPath: "inset(60% 0 20% 0)" }}
                    >
                        {title}
                    </span>
                    {title}
                </h1>

                {winnerLabel ? (
                    <p className="mt-6 font-mono text-base uppercase tracking-[0.25em]" style={{ color: accentColor }}>
                        &gt; {winnerLabel} claims the map
                    </p>
                ) : null}

                {onReplay ? (
                    <button
                        type="button"
                        onClick={onReplay}
                        className="relative z-10 mt-12 border px-8 py-3 font-mono text-sm uppercase tracking-widest transition hover:bg-white/5"
                        style={{ borderColor: accentColor, color: accentColor }}
                    >
                        Reboot &gt;
                    </button>
                ) : null}
            </div>
        </div>
    );
}
