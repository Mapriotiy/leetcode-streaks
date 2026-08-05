import { useEffect, useRef, useState } from "react";
import ProvinceMap from "../../../components/ProvinceMap";
import { GeneratedMapRenderer } from "../../../features/lobby-map/GeneratedMapRenderer";
import type { GeneratedMapDraft } from "../../../features/lobby-map/types";

type WinnerMapBackdropProps = {
    mapKind: "default" | "generated";
    draft?: GeneratedMapDraft | null;
    provinces: { province_id: string }[];
    color: string;
    /** Start with every province already captured. */
    prefilled?: boolean;
    /** Called once the conquest animation has reached the last province. */
    onComplete?: () => void;
    opacity?: number;
    /** Total time the conquest wave takes (ms); spread evenly over provinces. */
    durationMs?: number;
};

/** The played map behind the overlay; its provinces light up one by one in
 *  the winner's color, like a live conquest replay. The wave runs exactly
 *  once per mount, ignoring prop churn from the lobby poll. */
export function WinnerMapBackdrop({
    mapKind,
    draft,
    provinces,
    color,
    prefilled = false,
    onComplete,
    opacity = 0.6,
    durationMs = 3000,
}: WinnerMapBackdropProps) {
    const [captured, setCaptured] = useState<Map<string, string>>(() => {
        if (!prefilled) return new Map();
        return new Map(provinces.map((p) => [p.province_id, color]));
    });

    // Snapshot once: re-renders / new prop references must not restart the wave.
    const provincesRef = useRef(provinces);
    const colorRef = useRef(color);
    const durationRef = useRef(durationMs);
    const onCompleteRef = useRef(onComplete);
    useEffect(() => {
        provincesRef.current = provinces;
        colorRef.current = color;
        durationRef.current = durationMs;
        onCompleteRef.current = onComplete;
    }, [provinces, color, durationMs, onComplete]);

    useEffect(() => {
        if (prefilled) return;
        const ids = provincesRef.current.map((p) => p.province_id);
        if (ids.length === 0) {
            onCompleteRef.current?.();
            return;
        }
        const step = Math.max(80, Math.floor(durationRef.current / ids.length));
        let index = 0;
        const interval = window.setInterval(() => {
            index += 1;
            setCaptured((prev) => {
                const next = new Map(prev);
                const provinceId = ids[Math.min(index - 1, ids.length - 1)];
                next.set(provinceId, colorRef.current);
                return next;
            });
            if (index >= ids.length) {
                window.clearInterval(interval);
                onCompleteRef.current?.();
            }
        }, step);
        return () => window.clearInterval(interval);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
            <div className="w-full max-w-[1200px] blur-[1px]" style={{ opacity }}>
                {mapKind === "generated" && draft ? (
                    <GeneratedMapRenderer
                        draft={draft}
                        captured={captured}
                        zoomable={false}
                        showBack
                    />
                ) : (
                    <ProvinceMap captured={captured} onSelect={() => {}} highlightedProvinces={null} />
                )}
            </div>
        </div>
    );
}
