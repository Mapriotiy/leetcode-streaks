import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Copy, Gamepad2, LogOut, Plus, UserCheck, UserPlus } from 'lucide-react';
import { apiRequest } from '../api/client';

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

type LobbyData = {
    id: number;
    creator_id: number;
    name: string;
    status: string;
    game_mode: string;
    map_size: string;
    max_players: number;
    faction_mode: boolean;
    faction_count: number;
    factions: Faction[];
    programming_language: string;
    win_condition: Record<string, unknown>;
    players: LobbyPlayer[];
    invite_url: string | null;
};

type Friend = {
    friendship_id: number;
    friend: { id: number; leetcode_username: string };
};

type LobbyPageProps = {
    lobbyId: number;
    currentUserId: number;
    onBack: () => void;
    onGameStarted: (lobbyId: number, players: LobbyPlayer[], factions: Faction[]) => void;
};

const FACTION_COLORS = ['#00c2ff', '#ff4d6d', '#ffb020', '#27d980'];
const FACTION_NAMES = ['Alpha', 'Bravo', 'Charlie', 'Delta'];
const FACTION_PALETTE = [
    { name: 'Cyan', color: '#00c2ff' },
    { name: 'Rose', color: '#ff4d6d' },
    { name: 'Amber', color: '#ffb020' },
    { name: 'Mint', color: '#27d980' },
    { name: 'Violet', color: '#9b7cff' },
    { name: 'Sky', color: '#4f9cff' },
    { name: 'Coral', color: '#ff7a59' },
    { name: 'Lime', color: '#a3e635' },
];

function defaultFactions(count: number): Faction[] {
    return Array.from({ length: count }, (_, index) => ({
        id: index + 1,
        name: FACTION_NAMES[index] ?? `Faction ${index + 1}`,
        color: FACTION_COLORS[index] ?? '#888888',
    }));
}

const MODE_LABELS: Record<string, string> = {
    free_for_all: 'Free for All',
    team_battle: 'Team Battle',
    bingo: 'Bingo',
};

const MAP_LABELS: Record<string, string> = {
    small: 'Small (14)',
    medium: 'Medium (28)',
    large: 'Large (42)',
};

const LANGUAGE_LABELS: Record<string, string> = {
    python3: 'Python 3',
    cpp: 'C++',
    java: 'Java',
    javascript: 'JavaScript',
    typescript: 'TypeScript',
    csharp: 'C#',
    golang: 'Go',
    rust: 'Rust',
};

export function LobbyPage({ lobbyId, currentUserId, onBack, onGameStarted }: LobbyPageProps) {
    const [lobby, setLobby] = useState<LobbyData | null>(null);
    const [loading, setLoading] = useState(true);
    const [copied, setCopied] = useState(false);
    const [showFriends, setShowFriends] = useState(false);
    const [inviteUrl, setInviteUrl] = useState('');
    const [friends, setFriends] = useState<Friend[]>([]);
    const [isStarting, setIsStarting] = useState(false);
    const [isLeaving, setIsLeaving] = useState(false);
    const [savingFactionId, setSavingFactionId] = useState<number | null>(null);
    const [draggingPlayerId, setDraggingPlayerId] = useState<number | null>(null);
    const [startError, setStartError] = useState<string | null>(null);
    const [leaveError, setLeaveError] = useState<string | null>(null);
    const [factionError, setFactionError] = useState<string | null>(null);

    const loadLobby = useCallback(async () => {
        try {
            const data = await apiRequest<LobbyData>(`/lobbies/${lobbyId}`);
            setLobby(data);
            if (data.invite_url) setInviteUrl(data.invite_url);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [lobbyId]);

    useEffect(() => {
        loadLobby();
        apiRequest<Friend[]>('/friends/').then(setFriends).catch(() => {});
        const stored = sessionStorage.getItem(`lobby_invite_${lobbyId}`);
        if (stored) setInviteUrl(stored);
    }, [loadLobby, lobbyId]);

    const handleCopy = useCallback(() => {
        if (!inviteUrl) return;
        navigator.clipboard.writeText(inviteUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }, [inviteUrl]);

    const handleInviteFriend = useCallback(async (userId: number) => {
        try {
            await apiRequest(`/lobbies/${lobbyId}/invite-user`, {
                method: 'POST',
                body: JSON.stringify({ user_id: userId }),
            });
            await loadLobby();
        } catch (e) {
            console.error(e);
        }
    }, [lobbyId, loadLobby]);

    const handleLeave = useCallback(async () => {
        const confirmed = window.confirm('Leave this lobby?');
        if (!confirmed) return;

        setIsLeaving(true);
        setLeaveError(null);
        try {
            await apiRequest(`/lobbies/${lobbyId}/leave`, { method: 'DELETE' });
            onBack();
        } catch (e) {
            console.error(e);
            setLeaveError(e instanceof Error ? e.message : 'Failed to leave lobby');
        } finally {
            setIsLeaving(false);
        }
    }, [lobbyId, onBack]);

    const handleStart = useCallback(async () => {
        setIsStarting(true);
        setStartError(null);
        try {
            const data = await apiRequest<LobbyData>(`/lobbies/${lobbyId}/start`, { method: 'POST' });
            setLobby(data);
            onGameStarted(lobbyId, data.players, data.factions);
        } catch (e) {
            console.error(e);
            setStartError(e instanceof Error ? e.message : 'Failed to start game');
        } finally {
            setIsStarting(false);
        }
    }, [lobbyId, onGameStarted]);

    const patchFactionLocally = useCallback((factionId: number, patch: Partial<Faction>) => {
        setLobby((current) => {
            if (!current) return current;
            const factions = (current.factions.length ? current.factions : defaultFactions(current.faction_count)).map((faction) =>
                faction.id === factionId ? { ...faction, ...patch } : faction,
            );
            return { ...current, factions };
        });
    }, []);

    const handleUpdateFaction = useCallback(async (faction: Faction) => {
        setSavingFactionId(faction.id);
        setFactionError(null);
        try {
            const data = await apiRequest<LobbyData>(`/lobbies/${lobbyId}/factions/${faction.id}`, {
                method: 'PATCH',
                body: JSON.stringify({ name: faction.name, color: faction.color }),
            });
            setLobby(data);
        } catch (e) {
            setFactionError(e instanceof Error ? e.message : 'Failed to update faction');
            void loadLobby();
        } finally {
            setSavingFactionId(null);
        }
    }, [lobbyId, loadLobby]);

    const handleAssignFaction = useCallback(async (userId: number, factionId: number) => {
        setFactionError(null);
        try {
            const data = await apiRequest<LobbyData>(`/lobbies/${lobbyId}/players/${userId}/faction`, {
                method: 'PATCH',
                body: JSON.stringify({ faction_id: factionId }),
            });
            setLobby(data);
        } catch (e) {
            setFactionError(e instanceof Error ? e.message : 'Failed to assign faction');
        }
    }, [lobbyId]);

    if (loading) {
        return (
            <main className="min-h-screen bg-[#1a1a1a] p-6 text-white">
                <div className="mx-auto max-w-2xl pt-20 text-center text-[#8a8a8a]">Loading lobby...</div>
            </main>
        );
    }

    if (!lobby) {
        return (
            <main className="min-h-screen bg-[#1a1a1a] p-6 text-white">
                <div className="mx-auto max-w-2xl pt-20 text-center text-[#8a8a8a]">Lobby not found</div>
            </main>
        );
    }

    const isCreator = lobby.creator_id === currentUserId;
    const isActive = lobby.status === 'active';
    const playerCount = lobby.players.length;
    const canStart = isCreator && !isActive && playerCount >= 2;
    const inLobby = lobby.players.some((p) => p.user_id === currentUserId);
    const availableFriends = friends.filter(
        (f) => !lobby.players.some((p) => p.user_id === f.friend.id),
    );

    const factions = lobby.factions.length ? lobby.factions : defaultFactions(lobby.faction_count);
    const groupedByFaction = new Map<number, LobbyPlayer[]>();
    if (lobby.faction_mode) {
        for (const faction of factions) {
            groupedByFaction.set(faction.id, []);
        }
        for (const p of lobby.players) {
            const fid = p.faction_id ?? 0;
            if (!groupedByFaction.has(fid)) groupedByFaction.set(fid, []);
            groupedByFaction.get(fid)!.push(p);
        }
    }

    return (
        <main className="min-h-screen bg-[#1a1a1a] p-6 text-white">
            <div className="mx-auto max-w-2xl">
                <header className="flex items-center gap-4">
                    <button
                        type="button"
                        onClick={onBack}
                        className="grid h-10 w-10 place-items-center rounded-md border border-[#3a3a3a] bg-[#262626] text-[#b3b3b3] transition hover:border-[#ffa116]/60 hover:text-[#ffa116]"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="text-2xl font-semibold tracking-tight">{lobby.name}</h1>
                        <p className="mt-1 text-sm text-[#8a8a8a]">
                            {MODE_LABELS[lobby.game_mode] ?? lobby.game_mode}
                            {isActive ? ' — Game in progress' : ' — Waiting for players'}
                        </p>
                    </div>
                </header>

                {inviteUrl && (
                    <section className="mt-6 rounded-lg border border-[#3a3a3a] bg-[#262626] p-4">
                        <p className="text-xs font-medium text-[#8a8a8a] mb-2">Invite Link</p>
                        <div className="flex items-center gap-2">
                            <input
                                value={inviteUrl}
                                readOnly
                                className="min-w-0 flex-1 rounded-md border border-[#3a3a3a] bg-[#1a1a1a] px-3 py-2 text-sm text-white"
                            />
                            <button
                                type="button"
                                onClick={handleCopy}
                                className="rounded-md border border-[#3a3a3a] bg-[#333] px-3 py-2 text-sm text-[#d7d7d7] transition hover:bg-[#3d3d3d]"
                            >
                                {copied ? 'Copied!' : <Copy size={16} />}
                            </button>
                        </div>
                    </section>
                )}

                <section className="mt-6 rounded-lg border border-[#3a3a3a] bg-[#262626] p-6">
                    <h2 className="text-sm font-semibold text-[#d7d7d7]">Settings</h2>
                    <div className="mt-3 grid gap-3 sm:grid-cols-4">
                        <div className="rounded-md border border-[#3a3a3a] bg-[#1f1f1f] px-3 py-2 text-sm">
                            <span className="text-[#8a8a8a]">Mode</span>
                            <p className="text-[#eff1f6]">{MODE_LABELS[lobby.game_mode] ?? lobby.game_mode}</p>
                        </div>
                        <div className="rounded-md border border-[#3a3a3a] bg-[#1f1f1f] px-3 py-2 text-sm">
                            <span className="text-[#8a8a8a]">Language</span>
                            <p className="text-[#eff1f6]">{LANGUAGE_LABELS[lobby.programming_language] ?? lobby.programming_language}</p>
                        </div>
                        <div className="rounded-md border border-[#3a3a3a] bg-[#1f1f1f] px-3 py-2 text-sm">
                            <span className="text-[#8a8a8a]">Map</span>
                            <p className="text-[#eff1f6]">{MAP_LABELS[lobby.map_size] ?? lobby.map_size}</p>
                        </div>
                        <div className="rounded-md border border-[#3a3a3a] bg-[#1f1f1f] px-3 py-2 text-sm">
                            <span className="text-[#8a8a8a]">
                                {lobby.faction_mode ? 'Factions' : 'Players'}
                            </span>
                            <p className="text-[#eff1f6]">
                                {lobby.faction_mode ? lobby.faction_count : `${playerCount}/${lobby.max_players}`}
                            </p>
                        </div>
                    </div>
                </section>

                <section className="mt-6 rounded-lg border border-[#3a3a3a] bg-[#262626] p-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-sm font-semibold text-[#d7d7d7]">
                            {lobby.faction_mode ? `Players (${playerCount})` : `Players (${playerCount}/${lobby.max_players})`}
                        </h2>
                        {inLobby && !isActive && availableFriends.length > 0 && (
                            <button
                                type="button"
                                onClick={() => setShowFriends(!showFriends)}
                                className="flex items-center gap-1 text-xs text-[#ffa116] hover:text-[#ffb84d]"
                            >
                                <Plus size={14} />
                                Add Friends
                            </button>
                        )}
                    </div>

                    {showFriends && availableFriends.length > 0 && (
                        <div className="mt-3 mb-3 rounded-md border border-[#3a3a3a] bg-[#1f1f1f] divide-y divide-[#3a3a3a]">
                            {availableFriends.map((f) => (
                                <button
                                    key={f.friendship_id}
                                    type="button"
                                    onClick={() => handleInviteFriend(f.friend.id)}
                                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-[#eff1f6] hover:bg-[#2a2a2a]"
                                >
                                    <UserPlus size={14} className="text-[#8a8a8a]" />
                                    {f.friend.leetcode_username}
                                    <span className="ml-auto text-xs text-[#ffa116]">Invite</span>
                                </button>
                            ))}
                        </div>
                    )}

                    {lobby.faction_mode && groupedByFaction.size > 0 ? (
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                            {factions.map((faction) => {
                                const members = groupedByFaction.get(faction.id) ?? [];
                                return (
                                    <div
                                        key={faction.id}
                                        onDragOver={(event) => {
                                            if (isCreator && !isActive && draggingPlayerId) event.preventDefault();
                                        }}
                                        onDrop={(event) => {
                                            event.preventDefault();
                                            if (!isCreator || isActive || !draggingPlayerId) return;
                                            void handleAssignFaction(draggingPlayerId, faction.id);
                                            setDraggingPlayerId(null);
                                        }}
                                        className={`rounded-md border bg-[#1f1f1f] p-3 transition ${
                                            draggingPlayerId
                                                ? 'border-[#ffa116]/60 bg-[#2a2418]'
                                                : 'border-[#3a3a3a]'
                                        }`}
                                    >
                                        <div className="mb-2 flex items-center gap-2">
                                            {isCreator && !isActive ? (
                                                <>
                                                    <div className="relative shrink-0">
                                                        <span
                                                            className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full"
                                                            style={{ backgroundColor: faction.color }}
                                                        />
                                                        <select
                                                            value={faction.color}
                                                            onChange={(event) => {
                                                                const nextColor = event.currentTarget.value;
                                                                patchFactionLocally(faction.id, { color: nextColor });
                                                                void handleUpdateFaction({ ...faction, color: nextColor });
                                                            }}
                                                            aria-label={`${faction.name} color`}
                                                            className="h-8 w-28 rounded-md border border-[#3a3a3a] bg-[#171717] pl-7 pr-2 text-xs text-[#d7d7d7] outline-none focus:border-[#ffa116]/70"
                                                        >
                                                            {FACTION_PALETTE.map((option) => (
                                                                <option key={option.color} value={option.color}>
                                                                    {option.name}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    <input
                                                        value={faction.name}
                                                        onChange={(event) => patchFactionLocally(faction.id, { name: event.target.value })}
                                                        onBlur={(event) => handleUpdateFaction({ ...faction, name: event.currentTarget.value })}
                                                        className="min-w-0 flex-1 rounded-md border border-[#3a3a3a] bg-[#171717] px-2 py-1.5 text-xs font-medium text-white outline-none focus:border-[#ffa116]/70"
                                                    />
                                                </>
                                            ) : (
                                                <>
                                                    <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: faction.color }} />
                                                    <p className="min-w-0 truncate text-xs font-medium" style={{ color: faction.color }}>
                                                        {faction.name}
                                                    </p>
                                                </>
                                            )}
                                            {savingFactionId === faction.id && (
                                                <span className="ml-auto text-[11px] text-[#8a8a8a]">Saving</span>
                                            )}
                                        </div>
                                        {members.map((player) => (
                                            <div
                                                key={player.user_id}
                                                draggable={isCreator && !isActive}
                                                onDragStart={() => setDraggingPlayerId(player.user_id)}
                                                onDragEnd={() => setDraggingPlayerId(null)}
                                                className={`flex items-center gap-2 rounded px-1 py-1 text-sm transition ${
                                                    isCreator && !isActive
                                                        ? 'cursor-grab hover:bg-[#2a2a2a] active:cursor-grabbing'
                                                        : ''
                                                }`}
                                            >
                                                <UserCheck size={14} style={{ color: faction.color }} />
                                                <span className="text-[#eff1f6]">{player.leetcode_username}</span>
                                                {player.user_id === lobby.creator_id && (
                                                    <span className="ml-auto text-xs text-[#ffa116]">Host</span>
                                                )}
                                            </div>
                                        ))}
                                        {members.length === 0 && (
                                            <p className="rounded border border-dashed border-[#444] px-2 py-2 text-center text-xs text-[#777]">
                                                {isCreator && !isActive ? 'Drop players here' : 'No players'}
                                            </p>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <ul className="mt-3 grid gap-2">
                            {lobby.players.map((player) => {
                                const fid = player.faction_id;
                                const color = fid ? FACTION_COLORS[fid - 1] ?? '#aaa' : '#aaa';
                                return (
                                    <li
                                        key={player.user_id}
                                        className="flex items-center gap-3 rounded-md border border-[#3a3a3a] bg-[#1f1f1f] px-3 py-2 text-sm"
                                    >
                                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                                        <UserCheck size={16} className="text-[#ffa116]" />
                                        <span className="text-[#eff1f6]">{player.leetcode_username}</span>
                                        {player.user_id === lobby.creator_id && (
                                            <span className="text-xs text-[#ffa116] ml-auto">Host</span>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                    {factionError && (
                        <p className="mt-3 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                            {factionError}
                        </p>
                    )}
                </section>

                <div className="mt-6 flex gap-3">
                    {inLobby && (
                        <button
                            type="button"
                            onClick={handleLeave}
                            disabled={isLeaving}
                            className="rounded-md border border-[#3a3a3a] bg-[#262626] px-4 py-2.5 text-sm font-medium text-[#d7d7d7] transition hover:border-red-400/60 hover:bg-red-500/10 hover:text-red-200 disabled:cursor-not-allowed disabled:border-[#3a3a3a] disabled:bg-[#262626] disabled:text-[#777]"
                        >
                            <LogOut size={16} className="inline-block mr-2" />
                            {isLeaving ? 'Leaving...' : 'Leave Lobby'}
                        </button>
                    )}
                    {canStart && (
                        <button
                            type="button"
                            onClick={handleStart}
                            disabled={isStarting}
                            className="flex-1 rounded-md bg-[#ffa116] px-4 py-2.5 text-sm font-semibold text-[#111] transition hover:bg-[#ffb84d] disabled:cursor-not-allowed disabled:bg-[#3a3a3a] disabled:text-[#777]"
                        >
                            <Gamepad2 size={16} className="inline-block mr-2" />
                            {isStarting ? 'Starting...' : `Start Game (${playerCount} players)`}
                        </button>
                    )}
                </div>
                {startError && (
                    <p className="mt-3 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                        {startError}
                    </p>
                )}
                {leaveError && (
                    <p className="mt-3 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                        {leaveError}
                    </p>
                )}
            </div>
        </main>
    );
}
