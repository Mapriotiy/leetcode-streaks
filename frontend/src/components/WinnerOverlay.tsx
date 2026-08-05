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
    const background =
        mapKind && provinces && provinces.length > 0 ? (
            <WinnerMapBackdrop
                mapKind={mapKind}
                draft={draft ?? null}
                provinces={provinces}
                color={accentColor}
            />
        ) : null;

    return (
        <WinV4
            winnerLabel={winnerLabel}
            youWon={youWon}
            accentColor={accentColor}
            onReplay={onReplay}
            background={background}
        />
    );
}
