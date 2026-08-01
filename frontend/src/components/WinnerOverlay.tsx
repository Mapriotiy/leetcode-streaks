import { useMemo } from "react";
import { Trophy } from "lucide-react";

const CONFETTI_COLORS = [
    "#ffa116",
    "#00d9ff",
    "#ff00d4",
    "#2bff88",
    "#7c4dff",
    "#ff2d95",
    "#ffe600",
    "#ff3d00",
];

type ConfettiPiece = {
    left: number;
    delay: number;
    duration: number;
    color: string;
    width: number;
    height: number;
    x: number;
    rot: number;
};

type WinnerOverlayProps = {
    winnerLabel: string | null;
    youWon: boolean;
    accentColor?: string;
    onReplay?: () => void;
};

export function WinnerOverlay({ winnerLabel, youWon, accentColor = "#ffa116", onReplay }: WinnerOverlayProps) {
    const pieces = useMemo<ConfettiPiece[]>(
        () =>
            Array.from({ length: 110 }, (_, i) => ({
                left: (i * 137) % 100,
                delay: (i % 40) * 0.09,
                duration: 2.4 + ((i * 7) % 20) / 10,
                color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
                width: 6 + (i % 4) * 2,
                height: 10 + (i % 3) * 4,
                x: -30 + ((i * 13) % 61),
                rot: 360 + ((i * 47) % 540),
            })),
        [],
    );

    return (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-black/70 backdrop-blur-sm">
            <div className="pointer-events-none absolute inset-0">
                {pieces.map((p, i) => (
                    <span
                        key={i}
                        className="confetti-piece"
                        style={
                            {
                                left: `${p.left}%`,
                                width: p.width,
                                height: p.height,
                                backgroundColor: p.color,
                                borderRadius: p.width === 6 ? "2px" : "50%",
                                "--confetti-x": `${p.x}vw`,
                                "--confetti-rot": `${p.rot}deg`,
                                "--confetti-dur": `${p.duration}s`,
                                "--confetti-delay": `${p.delay}s`,
                            } as React.CSSProperties
                        }
                    />
                ))}
            </div>

            <div className="trophy-pop flex flex-col items-center gap-4 text-center">
                <div
                    className="grid h-28 w-28 place-items-center rounded-full border-2 shadow-2xl"
                    style={{ borderColor: accentColor, boxShadow: `0 0 60px ${accentColor}66`, background: `${accentColor}1a` }}
                >
                    <Trophy size={56} style={{ color: accentColor }} />
                </div>
                <h1 className="text-4xl font-extrabold tracking-tight text-white">
                    {youWon ? "You win!" : "Game over"}
                </h1>
                {winnerLabel ? (
                    <p className="text-lg font-medium" style={{ color: accentColor }}>
                        {winnerLabel}
                    </p>
                ) : null}
                {onReplay ? (
                    <button
                        type="button"
                        onClick={onReplay}
                        className="mt-2 rounded-md bg-[#ffa116] px-5 py-2.5 text-sm font-semibold text-[#111] transition hover:bg-[#ffb84d]"
                    >
                        Back to lobby
                    </button>
                ) : null}
            </div>
        </div>
    );
}
