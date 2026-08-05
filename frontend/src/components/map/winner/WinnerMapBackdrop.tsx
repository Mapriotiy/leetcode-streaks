import { useEffect, useState } from "react";
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
 *  the winner's color, like a live conquest replay. */
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

    useEffect(() => {
        if (prefilled) return;
        setCaptured(new Map());
        if (provinces.length === 0) {
            onComplete?.();
            return;
        }
        const step = Math.max(80, Math.floor(durationMs / provinces.length));
        let index = 0;
        const interval = window.setInterval(() => {
            index += 1;
            setCaptured((prev) => {
                const next = new Map(prev);
                const provinceId = provinces[Math.min(index - 1, provinces.length - 1)]?.province_id;
                if (provinceId) next.set(provinceId, color);
                return next;
            });
            if (index >= provinces.length) {
                window.clearInterval(interval);
                onComplete?.();
            }
        }, step);
        return () => window.clearInterval(interval);
    }, [provinces, color, prefilled, onComplete, durationMs]);

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
