import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { ArrowLeft, HelpCircle, LogOut, UserPlus } from 'lucide-react';
import ProvinceMap from '../components/ProvinceMap';
import ProvincePopup from '../components/ProvincePopup';
import { WinnerOverlay } from '../components/WinnerOverlay';
import { EventLogPanel } from '../components/map/EventLogPanel';
import { Footer } from '../components/Footer';
import { HowToPlayModal } from '../components/map/HowToPlayModal';
import { MapLegend } from '../components/map/MapLegend';
import { REGIONS } from '../mapRegions';
import { apiRequest } from '../api/client';
import { useLobbyEvents } from '../hooks/useLobbyEvents';
import { GeneratedMapRenderer } from '../features/lobby-map/GeneratedMapRenderer';
import { PowerUpInventory, type PowerUpKind } from '../components/powerups/PowerUpInventory';
import { DebugPanel } from '../components/debug/DebugPanel';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { AnimatedNumber } from '../components/AnimatedNumber';
import { generatedRegionsAsLegend } from '../features/lobby-map/generator';
import { writeLobbyMapSelection } from '../features/lobby-map/storage';
import { normalizeLobbyMapSelection } from '../features/lobby-map/api';
import type { LobbyMapSelection } from '../features/lobby-map/types';

const FACTION_COLORS = ['#00c2ff', '#ff4d6d', '#ffb020', '#27d980'];

type ProvinceData = {
    province_id: string;
    region_id: string;
    province_name?: string | null;
    region_name?: string | null;
    problem: { title: string; title_slug: string; difficulty: string; url: string } | null;
    captured_by: number | null;
    captured_by_username: string | null;
    captured_at: string | null;
    captured_runtime_ms: number | null;
    captured_submission_url: string | null;
    capturer_leetcode_username: string | null;
    first_captured_by: number | null;
    fortified_until: string | null;
};

type ScoreEntry = {
    team_id: number;
    label: string;
    color: string;
    provinces: number;
    base_points: number;
    bonus_points: number;
    region_control_points: number;
    total_points: number;
};

type WinnerInfo = {
    winner_user_id: number | null;
    winner_faction_id: number | null;
    label: string | null;
};

type MapApiResponse = {
    lobby_id: number;
    map_selection?: LobbyMapSelection | null;
    status: string;
    winner: WinnerInfo | null;
    provinces: ProvinceData[];
    score: ScoreEntry[];
    powerups?: Record<number, Record<string, number>> | null;
    win_target?: number | null;
};

type SyncApiResponse = MapApiResponse & {
    captured_count: number;
    recaptured_count: number;
};

type LobbyPlayer = {
    user_id: number;
    leetcode_username: string | null;
    faction_id: number | null;
    status: string;
};

type Faction = {
    id: number;
    name: string;
    color: string;
};

type LobbyMapPageProps = {
    lobbyId: number;
    currentUserId: number;
    players: LobbyPlayer[];
    factions: Faction[];
    isAdmin: boolean;
    onBack: () => void;
    onReplay: () => void;
    onLeft: () => void;
};

const STATE_POLL_INTERVAL_MS = 7_500;
const SYNC_INTERVAL_MS = 60_000;
const SYNC_JITTER_MS = 15_000;
const STATIC_PROVINCE_ORDER = REGIONS.flatMap((region) => region.provinces);
const STATIC_PROVINCE_ORDER_INDEX = new Map(STATIC_PROVINCE_ORDER.map((provinceId, index) => [provinceId, index]));

function orderServerProvincesForGeneratedMap(provinces: ProvinceData[]) {
    return [...provinces].sort((a, b) => {
        const aIndex = STATIC_PROVINCE_ORDER_INDEX.get(a.province_id) ?? Number.MAX_SAFE_INTEGER;
        const bIndex = STATIC_PROVINCE_ORDER_INDEX.get(b.province_id) ?? Number.MAX_SAFE_INTEGER;
        if (aIndex !== bIndex) return aIndex - bIndex;
        return a.province_id.localeCompare(b.province_id);
    });
}

export function LobbyMapPage({ lobbyId, currentUserId, players, factions, isAdmin, onBack, onReplay, onLeft }: LobbyMapPageProps) {
    const [provincesData, setProvincesData] = useState<ProvinceData[]>([]);
    const [scoreEntries, setScoreEntries] = useState<ScoreEntry[]>([]);
    const [gameStatus, setGameStatus] = useState<string>('active');
    const [winner, setWinner] = useState<WinnerInfo | null>(null);
    const [winTarget, setWinTarget] = useState<number | null>(null);
    const [syncTick, setSyncTick] = useState(0);
    const [loading, setLoading] = useState(true);
    const [isLeaving, setIsLeaving] = useState(false);
    const [leaveError, setLeaveError] = useState<string | null>(null);
    const [showHelp, setShowHelp] = useState(false);
    const [selectedProvince, setSelectedProvince] = useState<string | null>(null);
    const [popPos, setPopPos] = useState<{ x: number; y: number } | null>(null);
    const [hoveredProvinces, setHoveredProvinces] = useState<string[] | null>(null);
    const [mapSelection, setMapSelection] = useState<LobbyMapSelection>({ kind: 'default' });
    const [powerups, setPowerups] = useState<Record<number, Record<string, number>>>({});
    const [powerupError, setPowerupError] = useState<string | null>(null);
    const [armedPowerup, setArmedPowerup] = useState<PowerUpKind | null>(null);
    const [confirmLeave, setConfirmLeave] = useState(false);
    const [leftPlayers, setLeftPlayers] = useState<LobbyPlayer[]>([]);
    const [reinvitingUserId, setReinvitingUserId] = useState<number | null>(null);
    const [lobbyInfo, setLobbyInfo] = useState<{ left_players: LobbyPlayer[]; players: LobbyPlayer[]; max_players: number; faction_mode: boolean } | null>(null);
    const [friends, setFriends] = useState<{ friendship_id: number; friend: { id: number; leetcode_username: string | null } }[]>([]);
    const [showAddPlayer, setShowAddPlayer] = useState(false);
    const [bursts, setBursts] = useState<Map<string, string>>(new Map());
    const prevOwnersRef = useRef<Map<string, number | null>>(new Map());
    const loadedRef = useRef(false);

    const debugEnabled =
        isAdmin && (() => {
            try {
                return localStorage.getItem('mapcode.debugMode') === '1';
            } catch {
                return false;
            }
        })();

    useEffect(() => {
        setMapSelection({ kind: 'default' });
        setHoveredProvinces(null);
        setSelectedProvince(null);
        setPopPos(null);
    }, [lobbyId]);

    const factionByPlayer = useMemo(() => {
        const map = new Map<number, number>();
        for (const p of players) {
            if (p.faction_id) map.set(p.user_id, p.faction_id);
        }
        return map;
    }, [players]);

    const factionById = useMemo(() => {
        const map = new Map<number, Faction>();
        for (const faction of factions) {
            map.set(faction.id, faction);
        }
        return map;
    }, [factions]);

    const displayedProvincesData = useMemo(() => {
        if (mapSelection.kind !== 'generated') return provincesData;

        const generatedIds = new Set(mapSelection.draft.provinces.map((province) => province.provinceId));
        if (provincesData.some((province) => generatedIds.has(province.province_id))) {
            return provincesData;
        }

        const orderedServerProvinces = orderServerProvincesForGeneratedMap(provincesData);
        return mapSelection.draft.provinces.map((generatedProvince, index) => {
            const source = orderedServerProvinces[index] ?? null;
            return {
                province_id: generatedProvince.provinceId,
                region_id: generatedProvince.regionId,
                province_name: generatedProvince.name,
                region_name: mapSelection.draft.regions.find((region) => region.regionId === generatedProvince.regionId)?.name ?? null,
                problem: source?.problem ?? null,
                captured_by: source?.captured_by ?? null,
                captured_by_username: source?.captured_by_username ?? null,
                captured_at: source?.captured_at ?? null,
                captured_runtime_ms: source?.captured_runtime_ms ?? null,
                captured_submission_url: source?.captured_submission_url ?? null,
                capturer_leetcode_username: source?.capturer_leetcode_username ?? null,
                first_captured_by: source?.first_captured_by ?? null,
                fortified_until: source?.fortified_until ?? null,
            } satisfies ProvinceData;
        });
    }, [mapSelection, provincesData]);

    const captured = useMemo(() => {
        const map = new Map<string, string>();
        for (const p of displayedProvincesData) {
            if (!p.captured_by) continue;
            const fid = factionByPlayer.get(p.captured_by) ?? 0;
            const faction = factionById.get(fid);
            if (faction) {
                map.set(p.province_id, faction.color);
            } else if (fid > 0 && fid <= FACTION_COLORS.length) {
                map.set(p.province_id, FACTION_COLORS[fid - 1]);
            } else {
                map.set(p.province_id, '#888');
            }
        }
        return map;
    }, [displayedProvincesData, factionByPlayer, factionById]);

    const legendRegions = useMemo(
        () => (mapSelection.kind === 'generated' ? generatedRegionsAsLegend(mapSelection.draft) : REGIONS),
        [mapSelection],
    );

    const ownerColor = useCallback((userId: number | null): string | undefined => {
        if (!userId) return undefined;
        const fid = factionByPlayer.get(userId) ?? 0;
        const faction = factionById.get(fid);
        if (faction) return faction.color;
        if (fid > 0 && fid <= FACTION_COLORS.length) return FACTION_COLORS[fid - 1];
        return '#888888';
    }, [factionByPlayer, factionById]);

    // Live captures pushed over SSE are applied on top of the server-derived
    // state so the map reacts instantly; the next poll reconciles anyway.
    const [liveCaptures, setLiveCaptures] = useState<Map<string, string>>(new Map());
    const appliedEventIdsRef = useRef<Set<number>>(new Set());

    const displayCaptured = useMemo(() => {
        const map = new Map(captured);
        for (const [id, color] of liveCaptures) map.set(id, color);
        return map;
    }, [captured, liveCaptures]);

    const { events } = useLobbyEvents(lobbyId, syncTick);

    useEffect(() => {
        for (const event of events) {
            if (appliedEventIdsRef.current.has(event.id)) continue;
            if (
                (event.event_type === 'capture' ||
                    event.event_type === 'recapture' ||
                    event.event_type === 'defense') &&
                event.province_id
            ) {
                appliedEventIdsRef.current.add(event.id);
                const color = ownerColor(event.actor_user_id);
                if (!color) continue;
                const provinceId = event.province_id;
                setLiveCaptures((prev) => {
                    const next = new Map(prev);
                    next.set(provinceId, color);
                    return next;
                });
                setBursts((prev) => {
                    const next = new Map(prev);
                    next.set(provinceId, color);
                    return next;
                });
                window.setTimeout(() => {
                    setBursts((prev) => {
                        const next = new Map(prev);
                        next.delete(provinceId);
                        return next;
                    });
                }, 1200);
            }
        }
    }, [events, ownerColor]);

    const applyMapData = useCallback((data: MapApiResponse) => {
        const serverSelection = normalizeLobbyMapSelection(data.map_selection);
        setMapSelection(serverSelection);
        writeLobbyMapSelection(lobbyId, serverSelection);
        if (data.provinces.length > 0) setProvincesData(data.provinces);

        const nowOwners = new Map<string, number | null>();
        const nextBursts: Array<[string, string]> = [];
        for (const p of data.provinces) {
            nowOwners.set(p.province_id, p.captured_by);
            if (!loadedRef.current) continue;
            const prev = prevOwnersRef.current.get(p.province_id);
            if (p.captured_by != null && p.captured_by !== prev) {
                const color = ownerColor(p.captured_by);
                if (color) nextBursts.push([p.province_id, color]);
            }
        }
        prevOwnersRef.current = nowOwners;
        loadedRef.current = true;

        if (nextBursts.length > 0) {
            setBursts((prev) => {
                const next = new Map(prev);
                for (const [id, color] of nextBursts) next.set(id, color);
                return next;
            });
            const ids = nextBursts.map(([id]) => id);
            window.setTimeout(() => {
                setBursts((prev) => {
                    const next = new Map(prev);
                    for (const id of ids) next.delete(id);
                    return next;
                });
            }, 1000);
        }

        setScoreEntries(data.score ?? []);
        setGameStatus(data.status);
        setWinner(data.winner ?? null);
        setWinTarget(data.win_target ?? null);
        setPowerups(data.powerups ?? {});
    }, [lobbyId, ownerColor]);

    const loadMap = useCallback(async () => {
        try {
            const data = await apiRequest<MapApiResponse>(`/lobbies/${lobbyId}/map`);
            applyMapData(data);
        } catch (e) {
            console.error(e);
        }
    }, [lobbyId, applyMapData]);

    const sync = useCallback(async () => {
        try {
            const data = await apiRequest<SyncApiResponse>(
                `/lobbies/${lobbyId}/map/sync`, { method: 'POST' }
            );
            applyMapData(data);
            setSyncTick((tick) => tick + 1);
        } catch (e) {
            console.error(e);
        }
    }, [lobbyId, applyMapData]);

    const usePowerup = useCallback(async (kind: string, provinceId: string) => {
        setPowerupError(null);
        try {
            const data = await apiRequest<MapApiResponse>(
                `/lobbies/${lobbyId}/provinces/${provinceId}/${kind}`,
                { method: 'POST' },
            );
            applyMapData(data);
        } catch (e) {
            setPowerupError(e instanceof Error ? e.message : 'Failed to use power-up');
            throw e;
        }
    }, [lobbyId, applyMapData]);

    useEffect(() => {
        setLoading(true);
        loadMap()
            .then(() => sync())
            .finally(() => setLoading(false));
    }, [loadMap, sync]);

    type LobbyInfo = {
        left_players: LobbyPlayer[];
        players: LobbyPlayer[];
        max_players: number;
        faction_mode: boolean;
    };

    const loadLobbyInfo = useCallback(async () => {
        try {
            const data = await apiRequest<LobbyInfo>(`/lobbies/${lobbyId}`);
            setLobbyInfo(data);
            setLeftPlayers(data.left_players ?? []);
        } catch (e) {
            console.error(e);
        }
    }, [lobbyId]);

    useEffect(() => {
        loadLobbyInfo();
        apiRequest<{ friendship_id: number; friend: { id: number; leetcode_username: string | null } }[]>(
            '/friends/',
        )
            .then(setFriends)
            .catch(() => {});
        const interval = setInterval(() => void loadLobbyInfo(), 5000);
        return () => clearInterval(interval);
    }, [loadLobbyInfo]);

    const handleInvitePlayer = useCallback(async (userId: number) => {
        setReinvitingUserId(userId);
        try {
            const data = await apiRequest<LobbyInfo>(`/lobbies/${lobbyId}/invite-user`, {
                method: 'POST',
                body: JSON.stringify({ user_id: userId }),
            });
            setLobbyInfo(data);
            setLeftPlayers(data.left_players ?? []);
        } catch (e) {
            console.error(e);
        } finally {
            setReinvitingUserId(null);
        }
    }, [lobbyId]);

    useEffect(() => {
        if (gameStatus === 'finished') return;
        const interval = setInterval(loadMap, STATE_POLL_INTERVAL_MS);
        return () => clearInterval(interval);
    }, [loadMap, gameStatus]);

    useEffect(() => {
        if (gameStatus === 'finished') return;
        let timeoutId: number | null = null;
        let isActive = true;

        function scheduleSync() {
            if (!isActive) return;
            const delay = SYNC_INTERVAL_MS + Math.floor(Math.random() * SYNC_JITTER_MS);
            timeoutId = window.setTimeout(() => {
                void sync().finally(() => {
                    if (isActive) scheduleSync();
                });
            }, delay);
        }

        scheduleSync();

        return () => {
            isActive = false;
            if (timeoutId !== null) window.clearTimeout(timeoutId);
        };
    }, [sync, gameStatus]);

    const handleSelect = useCallback((id: string, pos: { x: number; y: number }) => {
        if (armedPowerup) {
            const clicked = displayedProvincesData.find((p) => p.province_id === id);
            const owner: 'player' | 'enemy' | undefined = (() => {
                if (!clicked?.captured_by) return undefined;
                if (clicked.captured_by === currentUserId) return 'player';
                const myFaction = factionByPlayer.get(currentUserId);
                if (myFaction != null && factionByPlayer.get(clicked.captured_by) === myFaction) {
                    return 'player';
                }
                return 'enemy';
            })();
            const valid =
                (armedPowerup === 'reroll' && owner === undefined) ||
                (armedPowerup === 'fortify' && owner === 'player') ||
                (armedPowerup === 'siege' && owner === undefined);
            if (!valid) {
                setPowerupError('This power-up cannot be used on that province');
                return;
            }
            const kind = armedPowerup;
            setArmedPowerup(null);
            void usePowerup(kind, id).catch(() => {});
            return;
        }
        setSelectedProvince(id);
        setPopPos(pos);
    }, [armedPowerup, displayedProvincesData, factionByPlayer, currentUserId, usePowerup]);

    const handleClose = useCallback(() => {
        setSelectedProvince(null);
        setPopPos(null);
    }, []);

    const handleLeave = useCallback(async () => {
        setIsLeaving(true);
        setLeaveError(null);
        try {
            await apiRequest(`/lobbies/${lobbyId}/leave`, { method: 'DELETE' });
            onLeft();
        } catch (e) {
            setLeaveError(e instanceof Error ? e.message : 'Failed to leave lobby');
        } finally {
            setIsLeaving(false);
        }
    }, [lobbyId, onLeft]);

    const selectedGeneratedProvince =
        selectedProvince && mapSelection.kind === 'generated'
            ? mapSelection.draft.provinces.find((p) => p.provinceId === selectedProvince) ?? null
            : null;

    const selectedProvinceData = selectedProvince
        ? displayedProvincesData.find((p) => p.province_id === selectedProvince) ??
          (mapSelection.kind === 'generated'
              ? ({
                    province_id: selectedProvince,
                    region_id: selectedGeneratedProvince?.regionId ?? '',
                    province_name: selectedGeneratedProvince?.name ?? null,
                    region_name:
                        mapSelection.kind === 'generated'
                            ? mapSelection.draft.regions.find((region) => region.regionId === selectedGeneratedProvince?.regionId)?.name ?? null
                            : null,
                    problem: null,
                    captured_by: null,
                    captured_by_username: null,
                    captured_at: null,
                    captured_runtime_ms: null,
                    captured_submission_url: null,
                    capturer_leetcode_username: null,
                    first_captured_by: null,
                    fortified_until: null,
                } satisfies ProvinceData)
              : null)
        : null;

    const myFactionId = factionByPlayer.get(currentUserId);
    const isSameTeam = (userId: number | null) => {
        if (!userId) return false;
        if (userId === currentUserId) return true;
        return myFactionId != null && factionByPlayer.get(userId) === myFactionId;
    };

    const owner = selectedProvinceData?.captured_by
        ? isSameTeam(selectedProvinceData.captured_by)
            ? 'player'
            : 'enemy'
        : undefined;

    const firstCaptureOwner = selectedProvinceData?.first_captured_by
        ? isSameTeam(selectedProvinceData.first_captured_by)
            ? ('player' as const)
            : ('enemy' as const)
        : undefined;

    const myPowerups = powerups[currentUserId] ?? { reroll: 0, fortify: 0, siege: 0 };
    const selectedFortified =
        selectedProvinceData?.fortified_until != null &&
        new Date(selectedProvinceData.fortified_until).getTime() > Date.now();

    const inGameIds = useMemo(() => new Set((lobbyInfo?.players ?? []).map((p) => p.user_id)), [lobbyInfo]);
    const leftIds = useMemo(() => new Set(leftPlayers.map((p) => p.user_id)), [leftPlayers]);
    const invitableFriends = useMemo(
        () => friends.filter((f) => !inGameIds.has(f.friend.id) && !leftIds.has(f.friend.id)),
        [friends, inGameIds, leftIds],
    );
    const hasSlots = lobbyInfo ? lobbyInfo.faction_mode || lobbyInfo.max_players > (lobbyInfo.players?.length ?? 0) : true;
    const slotLabel = lobbyInfo && !lobbyInfo.faction_mode
        ? `${(lobbyInfo.players?.length ?? 0)}/${lobbyInfo.max_players}`
        : null;

    const fortifiedIds = useMemo(
        () =>
            new Set(
                displayedProvincesData
                    .filter(
                        (p) =>
                            p.fortified_until != null &&
                            new Date(p.fortified_until).getTime() > Date.now(),
                    )
                    .map((p) => p.province_id),
            ),
        [displayedProvincesData],
    );

    const winnerAccent = useMemo(() => {
        if (!winner) return '#c86f3c';
        if (winner.winner_faction_id != null) {
            return factionById.get(winner.winner_faction_id)?.color ?? '#c86f3c';
        }
        if (winner.winner_user_id != null) {
            const fid = factionByPlayer.get(winner.winner_user_id) ?? 0;
            return factionById.get(fid)?.color ?? FACTION_COLORS[fid - 1] ?? '#c86f3c';
        }
        return '#c86f3c';
    }, [winner, factionById, factionByPlayer]);

    const youWon =
        winner?.winner_user_id != null && winner.winner_user_id === currentUserId
            ? true
            : winner?.winner_faction_id != null &&
                factionByPlayer.get(currentUserId) === winner.winner_faction_id;

    const neutralCount = displayedProvincesData.filter((p) => !p.captured_by).length;
    const totalCount = displayedProvincesData.length;
    const scoreRows = scoreEntries.map((entry) => {
        const breakdown = [
            `${entry.base_points} flags`,
            entry.bonus_points > 0 ? `+${entry.bonus_points} first captures` : null,
            entry.region_control_points > 0 ? `+${entry.region_control_points} region control` : null,
        ].filter(Boolean).join(', ');
        return {
            key: entry.team_id,
            label: entry.label,
            color: entry.color,
            count: entry.provinces,
            points: entry.total_points,
            regionControlPoints: entry.region_control_points,
            breakdown,
        };
    });
    const winnerScoreRow = (() => {
        if (!winner) return null;
        if (winner.winner_faction_id != null) {
            return scoreRows.find((row) => row.key === winner.winner_faction_id) ?? null;
        }
        if (winner.winner_user_id != null) {
            return scoreRows.find((row) => row.key === winner.winner_user_id) ?? null;
        }

        const leaderPoints = Math.max(0, ...scoreRows.map((row) => row.points));
        return scoreRows.find((row) => row.points === leaderPoints) ?? null;
    })();

    return (
        <main className="min-h-screen bg-transparent p-4 text-white sm:p-6">
            <div className="mx-auto max-w-7xl">
                <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            type="button"
                            onClick={onBack}
                            className="grid h-10 w-10 place-items-center rounded-md border border-[#3a3a3a] bg-[#262626] text-[#b3b3b3] transition hover:border-[#c86f3c]/60 hover:text-[#c86f3c]"
                        >
                            <ArrowLeft size={20} />
                        </button>
                        <div>
                            <h1 className="text-2xl font-semibold tracking-tight">Lobby Map</h1>
                            <p className="mt-1 text-sm text-[#8a8a8a]">Capture provinces by solving problems</p>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        {gameStatus !== 'finished' && (invitableFriends.length > 0 || leftPlayers.length > 0) && (
                            <button
                                type="button"
                                onClick={() => setShowAddPlayer((v) => !v)}
                                className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[#c86f3c]/50 bg-[#c86f3c]/10 px-3 text-sm font-medium text-[#e8b691] transition hover:bg-[#c86f3c]/20"
                            >
                                <UserPlus size={16} />
                                Add player
                                {slotLabel ? ` (${slotLabel})` : ''}
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => setShowHelp(true)}
                            title="How to play"
                            aria-label="How to play"
                            className="grid h-10 w-10 place-items-center rounded-md border border-[#3a3a3a] bg-[#262626] text-[#b3b3b3] transition hover:border-[#c86f3c]/60 hover:text-[#c86f3c]"
                        >
                            <HelpCircle size={18} />
                        </button>
                        <button
                            type="button"
                            onClick={() => setConfirmLeave(true)}
                            disabled={isLeaving}
                            className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[#3a3a3a] bg-[#262626] px-4 text-sm font-medium text-[#d7d7d7] transition hover:border-red-400/60 hover:bg-red-500/10 hover:text-red-200 disabled:cursor-not-allowed disabled:border-[#3a3a3a] disabled:bg-[#262626] disabled:text-[#777]"
                        >
                            <LogOut size={16} />
                            {isLeaving ? 'Leaving...' : 'Leave Lobby'}
                        </button>
                    </div>
                </header>
                {powerupError && (
                    <p className="mt-3 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                        {powerupError}
                    </p>
                )}
                {leaveError && (
                    <p className="mt-3 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                        {leaveError}
                    </p>
                )}

                {showAddPlayer && (
                    <section className="mt-4 rounded-lg border border-[#3a3a3a] bg-[#262626] p-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-sm font-semibold text-[#d7d7d7]">Add players</h2>
                            <button
                                type="button"
                                onClick={() => setShowAddPlayer(false)}
                                className="text-xs text-[#8a8a8a] transition hover:text-[#d7d7d7]"
                            >
                                Close
                            </button>
                        </div>
                        {slotLabel && (
                            <p className="mt-1 text-xs text-[#8a8a8a]">Players: {slotLabel}</p>
                        )}
                        {!hasSlots && (
                            <p className="mt-3 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                                Lobby is full — no free slots.
                            </p>
                        )}
                        {leftPlayers.length > 0 && (
                            <div className="mt-3">
                                <p className="text-xs font-medium text-[#8a8a8a]">Recently left</p>
                                <ul className="mt-2 grid gap-2">
                                    {leftPlayers.map((player) => (
                                        <li
                                            key={player.user_id}
                                            className="flex items-center gap-3 rounded-md border border-[#3a3a3a] bg-[#1f1f1f] px-3 py-2 text-sm"
                                        >
                                            <span className="text-[#b3b3b3]">
                                                {player.leetcode_username ?? `User #${player.user_id}`}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => void handleInvitePlayer(player.user_id)}
                                                disabled={reinvitingUserId === player.user_id || !hasSlots}
                                                className="ml-auto rounded-md border border-[#c86f3c]/50 bg-[#c86f3c]/10 px-3 py-1 text-xs font-medium text-[#e8b691] transition hover:bg-[#c86f3c]/20 disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                {reinvitingUserId === player.user_id ? 'Adding...' : 'Re-invite'}
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        {invitableFriends.length > 0 && (
                            <div className="mt-3">
                                <p className="text-xs font-medium text-[#8a8a8a]">Friends</p>
                                <ul className="mt-2 grid gap-2">
                                    {invitableFriends.map((f) => (
                                        <li
                                            key={f.friendship_id}
                                            className="flex items-center gap-3 rounded-md border border-[#3a3a3a] bg-[#1f1f1f] px-3 py-2 text-sm"
                                        >
                                            <span className="text-[#b3b3b3]">
                                                {f.friend.leetcode_username ?? `User #${f.friend.id}`}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => void handleInvitePlayer(f.friend.id)}
                                                disabled={reinvitingUserId === f.friend.id || !hasSlots}
                                                className="ml-auto rounded-md border border-[#c86f3c]/50 bg-[#c86f3c]/10 px-3 py-1 text-xs font-medium text-[#e8b691] transition hover:bg-[#c86f3c]/20 disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                {reinvitingUserId === f.friend.id ? 'Adding...' : 'Add'}
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        {leftPlayers.length === 0 && invitableFriends.length === 0 && (
                            <p className="mt-3 text-sm text-[#8a8a8a]">No one to add right now.</p>
                        )}
                    </section>
                )}

                {gameStatus === 'finished' && (
                    <section className="mt-6 rounded-lg border border-[#c86f3c]/40 bg-[#c86f3c]/10 px-4 py-4 text-center shadow-xl shadow-black/20">
                        <p className="text-xl font-semibold text-[#c86f3c]">
                            {winner?.label
                                ? winner.winner_user_id === currentUserId
                                    ? '🏆 You win!'
                                    : `🏆 ${winner.label} wins!`
                                : "It's a draw"}
                        </p>
                        <p className="mt-1 text-sm text-[#b3b3b3]">Game over — the map is frozen.</p>
                    </section>
                )}

                <section className="mt-6 rounded-lg border border-[#3a3a3a] bg-[#262626] p-4 shadow-xl shadow-black/20">
                    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
                        {scoreRows.map((row) => {
                            return (
                                <div key={row.key} className="flex items-center gap-2 text-sm">
                                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: row.color }} />
                                    <span className="font-semibold text-white">
                                        {row.label}
                                    </span>
                                    <span className="text-xs tabular-nums" style={{ color: row.color }}>
                                        {row.count}/{totalCount}
                                    </span>
                                    <span
                                        className="text-xs font-semibold tabular-nums text-[#c86f3c]"
                                        title={row.breakdown}
                                    >
                                        <AnimatedNumber value={row.points} /> pts
                                    </span>
                                    {row.regionControlPoints > 0 && (
                                        <span className="rounded-full bg-[#c86f3c]/10 px-1.5 py-0.5 text-[10px] font-semibold text-[#e8b691]" title={`Holding whole regions: +${row.regionControlPoints}`}>
                                            👑
                                        </span>
                                    )}
                                </div>
                            );
                        })}
                        <div className="flex items-center gap-2 text-sm text-[#555]">
                            <span className="h-3 w-3 rounded-full bg-[#555]" />
                            <span>Free</span>
                            <span className="text-xs tabular-nums">{neutralCount}</span>
                        </div>
                    </div>
                    <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-[#333]">
                        {scoreRows.map((row) => {
                            if (row.count === 0) return null;
                            return (
                                <div
                                    key={row.key}
                                    className="h-full transition-all duration-500"
                                    style={{ width: `${(row.count / totalCount) * 100}%`, backgroundColor: row.color }}
                                />
                            );
                        })}
                        {neutralCount > 0 && (
                            <div
                                className="h-full transition-all duration-500"
                                style={{ width: `${(neutralCount / totalCount) * 100}%`, backgroundColor: '#555' }}
                            />
                        )}
                    </div>

                    {winTarget ? (() => {
                        const leaderPoints = Math.max(0, ...scoreRows.map((row) => row.points));
                        const leader = scoreRows.find((row) => row.points === leaderPoints);
                        const myRow = scoreRows.find((row) => row.key === currentUserId);
                        const myPoints = myRow?.points ?? 0;
                        const progress = Math.min(100, (leaderPoints / winTarget) * 100);
                        return (
                            <div className="mt-3 border-t border-[#2a2a2a] pt-2.5">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="font-semibold text-[#e8b691]">
                                        🏆 Win at {winTarget} pts
                                    </span>
                                    {leader && (
                                        <span className="text-[#8a8a8a]">
                                            {leader.label}: <span className="tabular-nums text-[#c86f3c]">{leaderPoints}</span>
                                        </span>
                                    )}
                                </div>
                                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#333]">
                                    <div
                                        className="h-full rounded-full bg-gradient-to-r from-[#c86f3c]/60 to-[#c86f3c] transition-all duration-500"
                                        style={{ width: `${progress}%` }}
                                    />
                                </div>
                                <p className="mt-1 text-[11px] text-[#8a8a8a]">
                                    {myRow
                                        ? myPoints >= winTarget
                                            ? "You reached the target!"
                                            : `You need ${winTarget - myPoints} more pts`
                                        : "Join a team to see your progress"}
                                </p>
                            </div>
                        );
                    })() : null}
                </section>

                <div className="mt-6 flex items-stretch gap-6">
                    <section className="relative min-w-0 flex-1 overflow-hidden rounded-lg border border-[#3a3a3a] bg-[#262626] p-4 shadow-xl shadow-black/20 transition hover:border-[#00d9ff]/25 hover:shadow-[0_0_35px_-8px_rgba(0,217,255,0.2)]">
                        {loading ? (
                            <div className="flex items-center justify-center py-20 text-[#8a8a8a]">Loading map...</div>
                        ) : (
                            <div className="flex items-start justify-center gap-3">
                                <MapLegend
                                    regions={legendRegions}
                                    onHover={setHoveredProvinces}
                                    className="hidden w-40 shrink-0 list-none space-y-2 md:flex md:flex-col"
                                />
                                <div className="relative min-w-0 flex-1">
                                    {mapSelection.kind === 'generated' ? (
                                        <GeneratedMapRenderer
                                            draft={mapSelection.draft}
                                            captured={displayCaptured}
                                            onSelect={handleSelect}
                                            highlightedProvinces={hoveredProvinces}
                                            bursts={bursts}
                                            fortified={fortifiedIds}
                                            maxZoom={window.innerWidth < 768 ? 6 : 3}
                                        />
                                    ) : (
                                        <ProvinceMap
                                            captured={displayCaptured}
                                            onSelect={handleSelect}
                                            highlightedProvinces={hoveredProvinces}
                                            bursts={bursts}
                                            fortified={fortifiedIds}
                                        />
                                    )}

                                    {armedPowerup && (
                                        <div className="pointer-events-none absolute left-1/2 top-3 z-30 w-max max-w-[calc(100%_-_1rem)] -translate-x-1/2 rounded-full border border-[#c86f3c]/50 bg-[#1f1f1f]/95 px-3 py-1.5 text-center text-xs font-medium text-[#e8b691]">
                                            Select a province to use{" "}
                                            {armedPowerup === 'reroll'
                                                ? 'Reroll'
                                                : armedPowerup === 'fortify'
                                                  ? 'Fortify'
                                                  : 'Siege'}{" "}
                                            — click the circle again to cancel
                                        </div>
                                    )}

                                    <PowerUpInventory
                                        powerups={myPowerups}
                                        armed={armedPowerup}
                                        onArm={(kind) => {
                                            setArmedPowerup((current) => (kind && current === kind ? null : kind));
                                            handleClose();
                                        }}
                                    />

                                    {debugEnabled && (
                                        <DebugPanel
                                            lobbyId={lobbyId}
                                            players={players}
                                            currentUserId={currentUserId}
                                            selectedProvinceId={selectedProvince}
                                            selectedProvinceName={
                                                selectedProvinceData?.province_name ??
                                                selectedGeneratedProvince?.name ??
                                                null
                                            }
                                            finished={gameStatus === 'finished'}
                                            onChanged={() => void loadMap()}
                                        />
                                    )}
                                </div>
                            </div>
                        )}
                        {provincesData.length > 0 && (
                            <MapLegend
                                regions={legendRegions}
                                onHover={setHoveredProvinces}
                                className="mt-4 flex max-h-56 list-none flex-col gap-2 overflow-y-auto pr-1 md:hidden"
                            />
                        )}

                        {factions.length > 0 && (
                            <div className="mt-4 border-t border-[#2a2a2a] pt-2.5">
                                <p className="text-xs font-medium text-[#8a8a8a]">
                                    Teams · {players.length} players
                                </p>
                                <div className="mt-2 flex flex-wrap items-start gap-2">
                                    {factions.map((faction) => {
                                        const members = players.filter((p) => p.faction_id === faction.id);
                                        return (
                                            <div
                                                key={faction.id}
                                                className="inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1"
                                                style={{
                                                    borderColor: faction.color + '44',
                                                    backgroundColor: faction.color + '0d',
                                                }}
                                            >
                                                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: faction.color }} />
                                                <span className="shrink-0 text-xs font-semibold" style={{ color: faction.color }}>
                                                    {faction.name}
                                                </span>
                                                <span className="truncate text-xs text-[#d7d7d7]">
                                                    {members.length === 0
                                                        ? '—'
                                                        : members
                                                              .map((member) =>
                                                                  member.leetcode_username ?? `#${member.user_id}`,
                                                              )
                                                              .join(', ')}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </section>

                    {!loading && (
                        <EventLogPanel
                            events={events}
                            currentUserId={currentUserId}
                            className="hidden w-80 shrink-0 max-h-[40rem] lg:flex"
                        />
                    )}
                </div>

                {!loading && (
                    <EventLogPanel
                        events={events}
                        currentUserId={currentUserId}
                        className="mt-6 max-h-80 lg:hidden"
                    />
                )}

                <ProvincePopup
                    provinceId={selectedProvince}
                    provinceName={selectedProvinceData?.province_name ?? selectedGeneratedProvince?.name ?? null}
                    pos={popPos}
                    owner={owner}
                    capturedByUsername={selectedProvinceData?.captured_by_username ?? undefined}
                    problem={selectedProvinceData?.problem ?? null}
                    submissionUrl={selectedProvinceData?.captured_submission_url ?? null}
                    capturerLeetcodeUsername={selectedProvinceData?.capturer_leetcode_username ?? null}
                    firstCaptureOwner={firstCaptureOwner}
                    capturedRuntimeMs={selectedProvinceData?.captured_runtime_ms}
                    fortified={selectedFortified}
                    fortifiedUntil={selectedProvinceData?.fortified_until ?? null}
                    onClose={handleClose}
                />

                {gameStatus === 'finished' && winner ? (
                    <WinnerOverlay
                        winnerLabel={winner.label}
                        youWon={Boolean(youWon)}
                        accentColor={winnerAccent}
                        onReplay={onReplay}
                        mapKind={mapSelection.kind}
                        draft={mapSelection.kind === 'generated' ? mapSelection.draft : null}
                        provinces={displayedProvincesData.map((p) => ({ province_id: p.province_id }))}
                        stats={{
                            provinces: winnerScoreRow?.count ?? 0,
                            points: winnerScoreRow?.points ?? 0,
                        }}
                        lobbyId={lobbyId}
                        capturedColors={Object.fromEntries(displayCaptured)}
                    />
                ) : null}

                {showHelp && <HowToPlayModal onClose={() => setShowHelp(false)} />}

                {confirmLeave && (
                    <ConfirmDialog
                        title="Leave this lobby?"
                        message="Your progress in this game will be lost. You can rejoin later if the lobby is still open."
                        confirmLabel="Leave Lobby"
                        danger
                        busy={isLeaving}
                        onConfirm={() => {
                            setConfirmLeave(false);
                            void handleLeave();
                        }}
                        onCancel={() => setConfirmLeave(false)}
                    />
                )}

                <Footer />
            </div>
        </main>
    );
}
