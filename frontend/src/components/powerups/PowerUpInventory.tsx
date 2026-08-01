import type { ComponentType } from "react";
import { FortifyIcon, RerollIcon, SiegeIcon } from "./PowerUpIcons";

export type PowerUpKind = "reroll" | "fortify" | "siege";

const ORDER: PowerUpKind[] = ["reroll", "fortify", "siege"];

const POWERUP_LABELS: Record<PowerUpKind, string> = {
    reroll: "Reroll",
    fortify: "Fortify",
    siege: "Siege",
};

const POWERUP_HINTS: Record<PowerUpKind, string> = {
    reroll: "Pick a free province to reroll its problem",
    fortify: "Pick one of your provinces to shield it",
    siege: "Pick a free province to make its problem easier",
};

const ICONS: Record<PowerUpKind, ComponentType<{ className?: string }>> = {
    reroll: RerollIcon,
    fortify: FortifyIcon,
    siege: SiegeIcon,
};

function buildSlots(powerups: Record<string, number>): (PowerUpKind | null)[] {
    const slots: (PowerUpKind | null)[] = [];
    for (const kind of ORDER) {
        const count = powerups[kind] ?? 0;
        for (let i = 0; i < count && slots.length < 2; i++) {
            slots.push(kind);
        }
    }
    while (slots.length < 2) slots.push(null);
    return slots;
}

type PowerUpInventoryProps = {
    powerups: Record<string, number>;
    armed: PowerUpKind | null;
    onArm: (kind: PowerUpKind | null) => void;
};

export function PowerUpInventory({ powerups, armed, onArm }: PowerUpInventoryProps) {
    const slots = buildSlots(powerups);

    return (
        <div className="pointer-events-none absolute bottom-4 left-1/2 z-30 flex -translate-x-1/2 gap-3">
            {slots.map((kind, index) => {
                const isArmed = kind != null && armed === kind;
                return (
                    <div key={index} className="pointer-events-auto group relative">
                        <button
                            type="button"
                            onClick={() => onArm(kind ? (isArmed ? null : kind) : null)}
                            className={`grid h-14 w-14 place-items-center rounded-full border-2 transition ${
                                kind
                                    ? isArmed
                                        ? "border-[#ffa116] bg-[#ffa116]/25 text-[#ffa116] ring-2 ring-[#ffa116]/40"
                                        : "border-[#3a3a3a] bg-[#262626] text-[#d7d7d7] hover:border-[#ffa116]/60 hover:text-[#ffa116]"
                                    : "border-dashed border-[#3a3a3a] bg-[#1f1f1f]/80 text-[#555]"
                            }`}
                        >
                            {kind ? (() => {
                                const Cmp = ICONS[kind];
                                return <Cmp className="h-7 w-7" />;
                            })() : null}
                        </button>
                        <span className="pointer-events-none absolute bottom-full left-1/2 mb-2 w-max max-w-44 -translate-x-1/2 rounded-md border border-[#3a3a3a] bg-[#1f1f1f] px-2 py-1 text-center text-[11px] opacity-0 transition group-hover:opacity-100">
                            {kind ? (
                                <span className="text-[#d7d7d7]">
                                    <span className="font-semibold text-[#ffa116]">{POWERUP_LABELS[kind]}</span>
                                    {" — "}
                                    {POWERUP_HINTS[kind]}
                                </span>
                            ) : (
                                <span className="text-[#8a8a8a]">
                                    Capture a region to get a power-up
                                </span>
                            )}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}
