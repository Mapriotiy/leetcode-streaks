export type WinVariantProps = {
    winnerLabel: string | null;
    youWon: boolean;
    accentColor?: string;
    onReplay?: () => void;
    stats?: { provinces: number; points: number } | null;
};
