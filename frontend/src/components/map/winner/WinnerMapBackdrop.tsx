import { useEffect, useState } from "react";
import ProvinceMap from "../../../components/ProvinceMap";
import { GeneratedMapRenderer } from "../../../features/lobby-map/GeneratedMapRenderer";
import type { GeneratedMapDraft } from "../../../features/lobby-map/types";

type WinnerMapBackdropProps = {
    mapKind: "default" | "generated";
    draft?: GeneratedMapDraft | null;
    provinces: { province_id: string }[];
    color: string;
};

/** The played map dimmed behind the overlay; its provinces light up one by
 *  one in the winner's color, like a live conquest replay. */
export function WinnerMapBackdrop({ mapKind, draft, provinces, color }: WinnerMapBackdropProps) {
    const [captured, setCaptured] = useState<Map<string, string>>(new Map());

    useEffect(() => {
        setCaptured(new Map());
        if (provinces.length === 0) return;
        let index = 0;
        const interval = window.setInterval(() => {
            index += 1;
            setCaptured((prev) => {
                const next = new Map(prev);
                const provinceId = provinces[Math.min(index - 1, provinces.length - 1)]?.province_id;
                if (provinceId) next.set(provinceId, color);
                return next;
            });
            if (index >= provinces.length) window.clearInterval(interval);
        }, 90);
        return () => window.clearInterval(interval);
    }, [provinces, color]);

    return (
        <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
            <div className="w-full max-w-[1200px] opacity-40 blur-[1px]">
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
