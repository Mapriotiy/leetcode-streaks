import { useState, useCallback, useEffect, useMemo } from 'react';
import { ArrowLeft, LogOut } from 'lucide-react';
import ProvinceMap from '../components/ProvinceMap';
import ProvincePopup from '../components/ProvincePopup';
import { EventLogPanel } from '../components/map/EventLogPanel';
import { MapLegend } from '../components/map/MapLegend';
import { REGIONS } from '../mapRegions';
import { apiRequest } from '../api/client';
import type { MapEventApiData } from '../types/events';

const FACTION_COLORS = ['#00c2ff', '#ff4d6d', '#ffb020', '#27d980'];

type ProvinceData = {
    province_id: string;
    region_id: string;
    problem: { title: string; title_slug: string; difficulty: string; url: string } | null;
    captured_by: number | null;
    captured_by_username: string | null;
    captured_at: string | null;
    captured_submission_url: string | null;
    capturer_leetcode_username: string | null;
};

type LobbyPlayer = {
    user_id: number;
    leetcode_username: string;
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
    onBack: () => void;
    onLeft: () => void;
};

const POLL_INTERVAL_MS = 30_000;

export function LobbyMapPage({ lobbyId, currentUserId, players, factions, onBack, onLeft }: LobbyMapPageProps) {
    const [provincesData, setProvincesData] = useState<ProvinceData[]>([]);
    const [loading, setLoading] = useState(true);
    const [isLeaving, setIsLeaving] = useState(false);
    const [leaveError, setLeaveError] = useState<string | null>(null);
    const [selectedProvince, setSelectedProvince] = useState<string | null>(null);
    const [popPos, setPopPos] = useState<{ x: number; y: number } | null>(null);
    const [hoveredProvinces, setHoveredProvinces] = useState<string[] | null>(null);

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

    const captured = useMemo(() => {
        const map = new Map<string, string>();
        for (const p of provincesData) {
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
    }, [provincesData, factionByPlayer, factionById]);

    const events = useMemo<MapEventApiData[]>(() => {
        return provincesData
            .filter((province) => province.captured_by && province.captured_at)
            .sort((a, b) => new Date(a.captured_at ?? '').getTime() - new Date(b.captured_at ?? '').getTime())
            .map((province, index) => ({
                id: index + 1,
                friendship_id: 0,
                weekly_map_id: lobbyId,
                province_id: province.province_id,
                event_type: 'capture',
                actor_user_id: province.captured_by ?? 0,
                actor_username: province.captured_by_username ?? province.capturer_leetcode_username ?? 'Unknown player',
                previous_owner_user_id: null,
                previous_owner_username: null,
                problem_title_slug: province.problem?.title_slug ?? '',
                problem_title: province.problem?.title ?? null,
                problem_difficulty: province.problem?.difficulty ?? null,
                points: null,
                runtime_ms: null,
                previous_runtime_ms: null,
                created_at: province.captured_at ?? new Date().toISOString(),
            }));
    }, [lobbyId, provincesData]);

    const loadMap = useCallback(async () => {
        try {
            const data = await apiRequest<{ lobby_id: number; provinces: ProvinceData[] }>(`/lobbies/${lobbyId}/map`);
            setProvincesData(data.provinces);
        } catch (e) {
            console.error(e);
        }
    }, [lobbyId]);

    const sync = useCallback(async () => {
        try {
            const data = await apiRequest<{ captured_count: number; provinces: ProvinceData[] }>(
                `/lobbies/${lobbyId}/map/sync`, { method: 'POST' }
            );
            if (data.provinces.length > 0) setProvincesData(data.provinces);
        } catch (e) {
            console.error(e);
        }
    }, [lobbyId]);

    useEffect(() => {
        setLoading(true);
        loadMap()
            .then(() => sync())
            .finally(() => setLoading(false));
        const interval = setInterval(sync, POLL_INTERVAL_MS);
        return () => clearInterval(interval);
    }, [loadMap, sync]);

    const handleSelect = useCallback((id: string, pos: { x: number; y: number }) => {
        setSelectedProvince(id);
        setPopPos(pos);
    }, []);

    const handleClose = useCallback(() => {
        setSelectedProvince(null);
        setPopPos(null);
    }, []);

    const handleLeave = useCallback(async () => {
        const confirmed = window.confirm('Leave this lobby?');
        if (!confirmed) return;

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

    const selectedProvinceData = selectedProvince
        ? provincesData.find((p) => p.province_id === selectedProvince) ?? null
        : null;

    const owner =
        selectedProvinceData?.captured_by === currentUserId
            ? 'player'
            : selectedProvinceData?.captured_by
              ? 'enemy'
              : undefined;

    const neutralCount = provincesData.filter((p) => !p.captured_by).length;
    const totalCount = provincesData.length;
    const factionCounts = new Map<number, number>();
    for (const p of provincesData) {
        if (p.captured_by) {
            const fid = factionByPlayer.get(p.captured_by) ?? 0;
            factionCounts.set(fid, (factionCounts.get(fid) ?? 0) + 1);
        }
    }
    const scoreRows = factions.length > 0
        ? factions.map((faction) => ({
              key: faction.id,
              label: faction.name,
              color: faction.color,
              count: factionCounts.get(faction.id) ?? 0,
          }))
        : players.map((player) => {
              const fid = player.faction_id ?? 0;
              return {
                  key: player.user_id,
                  label: player.leetcode_username,
                  color: fid > 0 && fid <= FACTION_COLORS.length ? FACTION_COLORS[fid - 1] : '#888',
                  count: factionCounts.get(fid) ?? 0,
              };
          });

    return (
        <main className="min-h-screen bg-[#1a1a1a] p-6 text-white">
            <div className="mx-auto max-w-7xl">
                <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            type="button"
                            onClick={onBack}
                            className="grid h-10 w-10 place-items-center rounded-md border border-[#3a3a3a] bg-[#262626] text-[#b3b3b3] transition hover:border-[#ffa116]/60 hover:text-[#ffa116]"
                        >
                            <ArrowLeft size={20} />
                        </button>
                        <div>
                            <h1 className="text-2xl font-semibold tracking-tight">Lobby Map</h1>
                            <p className="mt-1 text-sm text-[#8a8a8a]">Capture provinces by solving problems</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={handleLeave}
                        disabled={isLeaving}
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[#3a3a3a] bg-[#262626] px-4 text-sm font-medium text-[#d7d7d7] transition hover:border-red-400/60 hover:bg-red-500/10 hover:text-red-200 disabled:cursor-not-allowed disabled:border-[#3a3a3a] disabled:bg-[#262626] disabled:text-[#777]"
                    >
                        <LogOut size={16} />
                        {isLeaving ? 'Leaving...' : 'Leave Lobby'}
                    </button>
                </header>
                {leaveError && (
                    <p className="mt-3 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                        {leaveError}
                    </p>
                )}

                <section className="mt-6 rounded-lg border border-[#3a3a3a] bg-[#262626] p-4 shadow-xl shadow-black/20">
                    <div className="flex items-center justify-center gap-4">
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
                </section>

                <div className="mt-6 flex items-stretch gap-6">
                    <section className="min-w-0 flex-1 overflow-hidden rounded-lg border border-[#3a3a3a] bg-[#262626] p-4 shadow-xl shadow-black/20">
                        {loading ? (
                            <div className="flex items-center justify-center py-20 text-[#8a8a8a]">Loading map...</div>
                        ) : (
                            <div className="flex items-start justify-center gap-3">
                                <MapLegend
                                    regions={REGIONS}
                                    onHover={setHoveredProvinces}
                                    className="hidden w-40 shrink-0 list-none space-y-2 md:flex md:flex-col"
                                />
                                <div className="min-w-0 flex-1">
                                    <ProvinceMap
                                        captured={captured}
                                        onSelect={handleSelect}
                                        highlightedProvinces={hoveredProvinces}
                                    />
                                </div>
                            </div>
                        )}
                        {provincesData.length > 0 && (
                            <MapLegend
                                regions={REGIONS}
                                onHover={setHoveredProvinces}
                                className="mt-4 flex list-none flex-col gap-2 md:hidden"
                            />
                        )}
                    </section>

                    {!loading && (
                        <EventLogPanel
                            events={events}
                            currentUserId={currentUserId}
                            className="hidden w-80 shrink-0 max-h-[640px] lg:flex"
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
                    pos={popPos}
                    owner={owner}
                    capturedByUsername={selectedProvinceData?.captured_by_username ?? undefined}
                    problem={selectedProvinceData?.problem ?? null}
                    submissionUrl={selectedProvinceData?.captured_submission_url ?? null}
                    capturerLeetcodeUsername={selectedProvinceData?.capturer_leetcode_username ?? null}
                    onClose={handleClose}
                />
            </div>
        </main>
    );
}
