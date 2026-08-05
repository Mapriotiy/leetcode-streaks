import type { ReactNode } from "react";

export type WinVariantProps = {
    winnerLabel: string | null;
    youWon: boolean;
    accentColor?: string;
    onReplay?: () => void;
    stats?: { provinces: number; points: number } | null;
    /** Optional map backdrop rendered behind the overlay. */
    background?: ReactNode;
};
