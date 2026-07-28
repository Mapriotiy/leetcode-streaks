import { Flame } from "lucide-react";

export function FriendFlame({
    count,
    state,
    ignite = false,
    size = "md",
}: {
    count: number;
    state: "lit" | "pending" | "broken";
    ignite?: boolean;
    size?: "md" | "lg";
}) {
    const isLit = state === "lit";
    const outerSize = size === "lg" ? "h-36 w-36" : "h-16 w-16";
    const glowSize = size === "lg" ? "h-28 w-28" : "h-12 w-12";
    const iconSize = size === "lg" ? 88 : 44;

    return (
        <div
            className={`relative grid ${outerSize} shrink-0 place-items-center overflow-hidden rounded-full border transition ${
                isLit
                    ? "border-[#ffa116]/50 bg-[#ffa116]/15 shadow-lg shadow-[#ffa116]/10"
                    : "border-[#3a3a3a] bg-[#303030]"
            }`}
        >
            {isLit ? (
                <div className={`flame-glow absolute ${glowSize} rounded-full bg-[#ffa116]/25 blur-md`} />
            ) : null}

            <Flame
                size={iconSize}
                strokeWidth={2.4}
                className={`relative transition ${
                    isLit
                        ? "fill-[#ffa116] text-[#ffd27a]  drop-shadow-[0_0_10px_rgba(255,161,22,0.55)]"
                        : "fill-[#6b6b6b] text-[#8a8a8a]"
                } ${ignite ? "flame-ignite" : ""}`}
            />

            <span
                className={`absolute font-bold tabular-nums ${
                    size === "lg" ? "text-xl" : "text-sm"
                } ${
                    isLit ? "text-[#111111]" : "text-[#d6d6d6]"
                }`}
            >
                {count}
            </span>
        </div>
    );
}
