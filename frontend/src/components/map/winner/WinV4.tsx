import { useState } from "react";
import { Share2 } from "lucide-react";
import { EpicParticles, SideBeams } from "./EpicEffects";
import { ShareCardModal } from "./ShareCardModal";
import type { WinVariantProps } from "./types";

const SCANLINES = `repeating-linear-gradient(0deg, rgba(255,255,255,0.03) 0px, rgba(255,255,255,0.03) 1px, transparent 1px, transparent 4px)`;

export function WinV4({
    winnerLabel,
    youWon,
    accentColor = "#00d9ff",
    onReplay,
    stats,
    lobbyId,
    mapKind,
    capturedColors,
    draft,
    background,
}: WinVariantProps) {
    const [shareOpen, setShareOpen] = useState(false);
    const title = youWon ? "VICTORY" : "SYSTEM FAILURE";
    const replayUrl = `${window.location.origin}${window.location.pathname}?replay=${lobbyId}`;

    return (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-[#0a0a0c]">
            {background}
            <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: SCANLINES }} />
            <div
                aria-hidden
                className="pointer-events-none absolute inset-0"
                style={{ background: `radial-gradient(45% 35% at 50% 50%, ${accentColor}14, transparent 75%)` }}
            />
            <EpicParticles color={accentColor} />
            <SideBeams color={accentColor} />

            <div className="cinematic-title relative z-10 flex flex-col items-center px-6 text-center">
                <div
                    aria-hidden
                    className="pointer-events-none absolute -inset-12"
                    style={{ background: "radial-gradient(70% 70% at 50% 50%, rgba(0,0,0,0.55), transparent 78%)" }}
                />
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
                    <p className="relative mt-6 font-mono text-base uppercase tracking-[0.25em]" style={{ color: accentColor }}>
                        &gt; {winnerLabel} claims the map
                    </p>
                ) : null}

                {stats ? (
                    <div className="relative mt-8 flex gap-3">
                        <div
                            className="rounded-md border px-6 py-2.5 text-center"
                            style={{ borderColor: accentColor + "55", backgroundColor: "rgba(10,10,12,0.6)" }}
                        >
                            <p className="font-mono text-xs uppercase tracking-widest text-[#8a8a8a]">Provinces</p>
                            <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-[#7fe8ff]">
                                {stats.provinces}
                            </p>
                        </div>
                        <div
                            className="rounded-md border px-6 py-2.5 text-center"
                            style={{ borderColor: accentColor + "55", backgroundColor: "rgba(10,10,12,0.6)" }}
                        >
                            <p className="font-mono text-xs uppercase tracking-widest text-[#8a8a8a]">Points</p>
                            <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-[#ffa116]">
                                {stats.points}
                            </p>
                        </div>
                    </div>
                ) : null}

                <div className="relative mt-10 flex items-center gap-3">
                    {onReplay ? (
                        <button
                            type="button"
                            onClick={onReplay}
                            className="relative z-10 border px-8 py-3 font-mono text-sm uppercase tracking-widest transition hover:bg-white/5"
                            style={{ borderColor: accentColor, color: accentColor }}
                        >
                            Reboot &gt;
                        </button>
                    ) : null}
                    {stats ? (
                        <button
                            type="button"
                            onClick={() => setShareOpen(true)}
                            className="relative z-10 inline-flex items-center gap-2 border border-white/25 px-5 py-3 font-mono text-sm uppercase tracking-widest text-white transition hover:bg-white/5"
                        >
                            <Share2 size={15} />
                            Share
                        </button>
                    ) : null}
                </div>
            </div>

            {shareOpen ? (
                <ShareCardModal
                    data={{
                        title,
                        name: winnerLabel ?? "MapCode",
                        accentColor,
                        points: stats?.points ?? 0,
                        provinces: stats?.provinces ?? 0,
                        mapKind,
                        capturedColors,
                        draft,
                    }}
                    replayUrl={replayUrl}
                    onClose={() => setShareOpen(false)}
                />
            ) : null}
        </div>
    );
}
