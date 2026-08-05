import { useEffect, useMemo, useState } from "react";
import type { GeneratedMapDraft } from "../features/lobby-map/types";
import { WinV4 } from "./map/winner/WinV4";
import { WinnerMapBackdrop } from "./map/winner/WinnerMapBackdrop";

type WinnerOverlayProps = {
    winnerLabel: string | null;
    youWon: boolean;
    accentColor?: string;
    onReplay?: () => void;
    mapKind?: "default" | "generated";
    draft?: GeneratedMapDraft | null;
    provinces?: { province_id: string }[];
};

export function WinnerOverlay({
    winnerLabel,
    youWon,
    accentColor = "#ffa116",
    onReplay,
    mapKind,
    draft,
    provinces,
}: WinnerOverlayProps) {
    const [phase, setPhase] = useState<"conquest" | "result">("conquest");
    const hasMap = Boolean(mapKind && provinces && provinces.length > 0);

    useEffect(() => {
        if (!hasMap) {
            setPhase("result");
            return;
        }
        const duration = Math.max(2200, (provinces?.length ?? 0) * 90 + 700);
        const timer = window.setTimeout(() => setPhase("result"), duration);
        return () => window.clearTimeout(timer);
    }, [hasMap, provinces]);

    const backdrop = useMemo(
        () =>
            hasMap ? (
                <WinnerMapBackdrop
                    mapKind={mapKind as "default" | "generated"}
                    draft={draft ?? null}
                    provinces={provinces ?? []}
                    color={accentColor}
                    prefilled={phase === "result"}
                    opacity={phase === "conquest" ? 0.85 : 0.6}
                />
            ) : null,
        [hasMap, mapKind, draft, provinces, accentColor, phase],
    );

    if (phase === "conquest" && hasMap) {
        return (
            <div className="fixed inset-0 z-50 overflow-hidden bg-[#070709]">
                {backdrop}
                <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0"
                    style={{ background: "radial-gradient(80% 80% at 50% 45%, transparent 40%, rgba(0,0,0,0.6) 100%)" }}
                />
                <div className="absolute inset-x-0 bottom-[16%] px-6 text-center">
                    <p className="cinematic-title text-2xl font-light uppercase tracking-[0.35em] text-white sm:text-3xl">
                        {winnerLabel ?? (youWon ? "You" : "The winner")}
                    </p>
                    <p className="cinematic-title mt-3 text-xs uppercase tracking-[0.45em] text-[#a5a5a5]">
                        claims the map
                    </p>
                </div>
            </div>
        );
    }

    return (
        <WinV4
            winnerLabel={winnerLabel}
            youWon={youWon}
            accentColor={accentColor}
            onReplay={onReplay}
            background={backdrop}
        />
    );
}
