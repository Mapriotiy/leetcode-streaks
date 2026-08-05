import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Copy, Pause, Play, RotateCcw } from "lucide-react";
import { apiRequest } from "../api/client";
import ProvinceMap from "../components/ProvinceMap";
import { GeneratedMapRenderer } from "../features/lobby-map/GeneratedMapRenderer";
import { normalizeLobbyMapSelection } from "../features/lobby-map/api";
import type { LobbyMapSelection } from "../features/lobby-map/types";

const PLAYER_COLORS = ["#00c2ff", "#ff4d6d", "#ffb020", "#27d980", "#9b7cff", "#4f9cff", "#ff7a59", "#a3e635"];
const STEP_MS = 700;

type ReplayEvent = {
    id: number;
    province_id: string | null;
    event_type: string;
    actor_user_id: number;
    actor_faction_id: number | null;
};

type ReplayPlayer = {
    user_id: number;
    leetcode_username: string | null;
    faction_id: number | null;
};

type ReplayFaction = {
    id: number;
    name: string;
    color: string;
};

type ReplayData = {
    game_mode: string;
    status: string;
    map_selection?: LobbyMapSelection | null;
    provinces: unknown[];
    events: ReplayEvent[];
    players: ReplayPlayer[];
    factions: ReplayFaction[];
};

function colorFor(event: ReplayEvent, factions: ReplayFaction[], players: ReplayPlayer[]): string {
    if (factions.length > 0 && event.actor_faction_id != null) {
        return factions.find((f) => f.id === event.actor_faction_id)?.color ?? "#888";
    }
    const index = players.findIndex((p) => p.user_id === event.actor_user_id);
    return PLAYER_COLORS[index >= 0 ? index % PLAYER_COLORS.length : 0];
}

export function ReplayPage({ lobbyId }: { lobbyId: number }) {
    const [data, setData] = useState<ReplayData | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [captured, setCaptured] = useState<Map<string, string>>(new Map());
    const [playing, setPlaying] = useState(false);
    const [step, setStep] = useState(0);

    useEffect(() => {
        apiRequest<ReplayData>(`/lobbies/${lobbyId}/replay`)
            .then(setData)
            .catch((e) => setError(e instanceof Error ? e.message : "Failed to load replay"));
    }, [lobbyId]);

    const captureEvents = useMemo(
        () =>
            (data?.events ?? []).filter(
                (event) =>
                    event.province_id &&
                    ["capture", "recapture", "defense"].includes(event.event_type),
            ),
        [data],
    );

    const mapSelection = useMemo(
        () => normalizeLobbyMapSelection(data?.map_selection ?? null),
        [data],
    );

    const applyUpTo = useCallback(
        (count: number) => {
            const map = new Map<string, string>();
            const limit = Math.min(count, captureEvents.length);
            for (let i = 0; i < limit; i += 1) {
                const event = captureEvents[i];
                if (event.province_id) {
                    map.set(event.province_id, colorFor(event, data?.factions ?? [], data?.players ?? []));
                }
            }
            setCaptured(map);
        },
        [captureEvents, data],
    );

    useEffect(() => {
        if (!playing) return;
        if (step >= captureEvents.length) {
            setPlaying(false);
            return;
        }
        const timer = window.setTimeout(() => {
            const event = captureEvents[step];
            const provinceId = event.province_id;
            if (provinceId) {
                setCaptured((prev) => {
                    const next = new Map(prev);
                    next.set(provinceId, colorFor(event, data?.factions ?? [], data?.players ?? []));
                    return next;
                });
            }
            setStep((value) => value + 1);
        }, STEP_MS);
        return () => window.clearTimeout(timer);
    }, [playing, step, captureEvents, data]);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(window.location.href);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2000);
        } catch {
            /* ignore */
        }
    };

    if (error) {
        return (
            <main className="min-h-screen bg-transparent p-6 text-white">
                <p className="mx-auto max-w-md rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-center text-sm text-red-300">
                    {error}
                </p>
            </main>
        );
    }

    if (!data) {
        return <main className="min-h-screen bg-transparent p-6 text-center text-[#8a8a8a]">Loading replay…</main>;
    }

    const progress = captureEvents.length > 0 ? step / captureEvents.length : 0;

    return (
        <main className="min-h-screen bg-transparent p-4 text-white sm:p-6">
            <div className="mx-auto max-w-5xl">
                <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-4">
                        <a
                            href="/"
                            className="grid h-10 w-10 place-items-center rounded-md border border-[#3a3a3a] bg-[#262626] text-[#b3b3b3] transition hover:border-[#ffa116]/60 hover:text-[#ffa116]"
                        >
                            <ArrowLeft size={20} />
                        </a>
                        <div>
                            <h1 className="text-2xl font-semibold tracking-tight">Match replay</h1>
                            <p className="mt-1 text-sm text-[#8a8a8a]">Lobby #{lobbyId} · capture timeline</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => void handleCopy()}
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[#3a3a3a] bg-[#262626] px-4 text-sm font-medium text-[#d7d7d7] transition hover:border-[#ffa116]/60 hover:text-[#ffa116]"
                    >
                        <Copy size={16} />
                        {copied ? "Copied!" : "Copy replay link"}
                    </button>
                </header>

                <section className="relative mt-6 overflow-hidden rounded-lg border border-[#3a3a3a] bg-[#262626] p-4 shadow-xl shadow-black/20">
                    {mapSelection.kind === "generated" && mapSelection.draft ? (
                        <GeneratedMapRenderer
                            draft={mapSelection.draft}
                            captured={captured}
                            zoomable
                            onSelect={() => {}}
                        />
                    ) : (
                        <ProvinceMap captured={captured} onSelect={() => {}} highlightedProvinces={null} />
                    )}

                    <div className="mt-4 border-t border-[#2a2a2a] pt-3">
                        <div
                            className="group h-1.5 cursor-pointer overflow-hidden rounded-full bg-[#333]"
                            onClick={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                                const target = Math.round(ratio * captureEvents.length);
                                setStep(target);
                                applyUpTo(target);
                            }}
                        >
                            <div
                                className="h-full rounded-full bg-[#ffa116] transition-all"
                                style={{ width: `${progress * 100}%` }}
                            />
                        </div>
                        <div className="mt-3 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (step >= captureEvents.length) {
                                            setStep(0);
                                            setCaptured(new Map());
                                        }
                                        setPlaying((value) => !value);
                                    }}
                                    className="grid h-9 w-9 place-items-center rounded-md border border-[#3a3a3a] bg-[#1f1f1f] text-[#d7d7d7] transition hover:border-[#ffa116]/60 hover:text-[#ffa116]"
                                    aria-label={playing ? "Pause" : "Play"}
                                >
                                    {playing ? <Pause size={16} /> : <Play size={16} />}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setPlaying(false);
                                        setStep(0);
                                        setCaptured(new Map());
                                    }}
                                    className="grid h-9 w-9 place-items-center rounded-md border border-[#3a3a3a] bg-[#1f1f1f] text-[#d7d7d7] transition hover:border-[#ffa116]/60 hover:text-[#ffa116]"
                                    aria-label="Restart"
                                >
                                    <RotateCcw size={15} />
                                </button>
                                <span className="text-xs tabular-nums text-[#8a8a8a]">
                                    {step}/{captureEvents.length} captures
                                </span>
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        </main>
    );
}
