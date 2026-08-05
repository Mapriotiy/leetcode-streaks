import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { WinV1 } from "../components/map/winner/WinV1";
import { WinV2 } from "../components/map/winner/WinV2";
import { WinV3 } from "../components/map/winner/WinV3";
import { WinV4 } from "../components/map/winner/WinV4";
import { WinV5 } from "../components/map/winner/WinV5";

const VARIANTS = [
    { name: "V1 · Cinematic letterbox", node: WinV1 },
    { name: "V2 · Color flood + sweep", node: WinV2 },
    { name: "V3 · Stats recap", node: WinV3 },
    { name: "V4 · Glitch / scanline", node: WinV4 },
    { name: "V5 · Minimal cinematic", node: WinV5 },
];

export function WinnerPreviewPage() {
    const [index, setIndex] = useState(0);
    const [youWon, setYouWon] = useState(true);

    const Variant = VARIANTS[index].node;

    return (
        <>
            <Variant
                winnerLabel={youWon ? "mapriotii" : "jambikkk"}
                youWon={youWon}
                accentColor={youWon ? "#ffa116" : "#ff2d55"}
                stats={{ provinces: 18, points: 6400 }}
            />

            <div className="fixed bottom-4 left-1/2 z-[100] flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/10 bg-[#1a1b1e]/90 px-3 py-2 shadow-2xl backdrop-blur">
                <button
                    type="button"
                    onClick={() => setIndex((index - 1 + VARIANTS.length) % VARIANTS.length)}
                    className="grid h-8 w-8 place-items-center rounded-full text-[#8a8a8a] transition hover:text-white"
                >
                    <ChevronLeft size={18} />
                </button>
                <button
                    type="button"
                    onClick={() => setYouWon((value) => !value)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                        youWon ? "bg-[#2bff88]/20 text-[#7ef7bb]" : "bg-red-500/20 text-red-300"
                    }`}
                >
                    {youWon ? "WIN" : "LOSE"}
                </button>
                <span className="text-xs font-semibold text-white">{VARIANTS[index].name}</span>
                <button
                    type="button"
                    onClick={() => setIndex((index + 1) % VARIANTS.length)}
                    className="grid h-8 w-8 place-items-center rounded-full text-[#8a8a8a] transition hover:text-white"
                >
                    <ChevronRight size={18} />
                </button>
            </div>
        </>
    );
}
