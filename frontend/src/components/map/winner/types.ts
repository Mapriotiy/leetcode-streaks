import type { ReactNode } from "react";

export type WinVariantProps = {
    winnerLabel: string | null;
    youWon: boolean;
    accentColor?: string;
    onReplay?: () => void;
    stats?: { provinces: number; points: number } | null;
    lobbyId?: number;
    mapKind?: "default" | "generated";
    capturedColors?: Record<string, string>;
    draft?: unknown;
    /** Optional map backdrop rendered behind the overlay. */
    background?: ReactNode;
};
