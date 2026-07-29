import { useMemo, useState } from 'react';
import { Check, Search, X } from 'lucide-react';
import { apiRequest } from '../api/client';

type Friend = {
    friendship_id: number;
    friend: { id: number; leetcode_username: string };
};

type CreateLobbyModalProps = {
    username: string;
    friends: Friend[];
    onClose: () => void;
    onCreated: (lobbyId: number) => void;
};

const GAME_MODES = [
    { value: 'free_for_all', label: 'Free for All' },
    { value: 'team_battle', label: 'Team Battle' },
];

const MAP_SIZES = [
    { value: 'small', label: 'Small', desc: '14 provinces' },
    { value: 'medium', label: 'Medium', desc: '28 provinces' },
    { value: 'large', label: 'Large', desc: '42 provinces' },
];

const WIN_CONDITIONS = [
    { value: 'territory_control', label: 'Territory Control', desc: 'Hold 50%+ provinces', threshold: 0.5 },
    { value: 'region_domination', label: 'Region Domination', desc: 'Control majority of regions', threshold: 0.5 },
];

const PROGRAMMING_LANGUAGES = [
    { value: 'python3', label: 'Python 3' },
    { value: 'cpp', label: 'C++' },
    { value: 'java', label: 'Java' },
    { value: 'javascript', label: 'JavaScript' },
    { value: 'typescript', label: 'TypeScript' },
    { value: 'csharp', label: 'C#' },
    { value: 'golang', label: 'Go' },
    { value: 'rust', label: 'Rust' },
];

export function CreateLobbyModal({ username, friends, onClose, onCreated }: CreateLobbyModalProps) {
    const [name, setName] = useState(`${username}'s game`);
    const [gameMode, setGameMode] = useState('free_for_all');
    const [mapSize, setMapSize] = useState('medium');
    const [programmingLanguage, setProgrammingLanguage] = useState('python3');
    const [maxPlayers, setMaxPlayers] = useState(2);
    const [factionMode, setFactionMode] = useState(false);
    const [factionCount, setFactionCount] = useState(2);
    const [winCondition, setWinCondition] = useState('territory_control');
    const [selectedFriends, setSelectedFriends] = useState<Set<number>>(new Set());
    const [friendSearch, setFriendSearch] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const selectedFriendRows = useMemo(
        () => friends.filter((friend) => selectedFriends.has(friend.friend.id)),
        [friends, selectedFriends],
    );

    const filteredFriends = useMemo(() => {
        const query = friendSearch.trim().toLowerCase();
        if (!query) return friends;
        return friends.filter((friend) =>
            friend.friend.leetcode_username.toLowerCase().includes(query),
        );
    }, [friends, friendSearch]);

    const toggleFriend = (id: number) => {
        setSelectedFriends((prev) => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const handleCreate = async () => {
        setLoading(true);
        setError(null);
        try {
            const wc = WIN_CONDITIONS.find((w) => w.value === winCondition)!;
            const res = await apiRequest<{ lobby: { id: number }; invite_url: string }>('/lobbies', {
                method: 'POST',
                body: JSON.stringify({
                    name,
                    game_mode: gameMode,
                    map_size: mapSize,
                    programming_language: programmingLanguage,
                    max_players: factionMode ? 0 : maxPlayers,
                    faction_mode: factionMode,
                    faction_count: factionMode ? factionCount : 0,
                    win_condition: { type: wc.value, threshold: wc.threshold, duration_hours: 0 },
                }),
            });

            for (const fid of selectedFriends) {
                await apiRequest(`/lobbies/${res.lobby.id}/invite-user`, {
                    method: 'POST',
                    body: JSON.stringify({ user_id: fid }),
                }).catch(() => {});
            }

            sessionStorage.setItem(`lobby_invite_${res.lobby.id}`, res.invite_url);
            onCreated(res.lobby.id);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to create lobby');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
            <div
                className="flex max-h-[92vh] w-full max-w-2xl flex-col rounded-lg border border-[#3a3a3a] bg-[#262626] p-6 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="mb-5 flex shrink-0 items-center justify-between">
                    <h2 className="text-lg font-semibold text-white">Create Lobby</h2>
                    <button onClick={onClose} className="text-[#8a8a8a] hover:text-white">
                        <X size={20} />
                    </button>
                </div>

                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-2">
                    <div>
                        <label className="text-xs font-medium text-[#8a8a8a] block mb-1">Lobby Name</label>
                        <input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full rounded-md border border-[#3a3a3a] bg-[#1a1a1a] px-3 py-2 text-sm text-white"
                        />
                    </div>

                    <div>
                        <label className="text-xs font-medium text-[#8a8a8a] block mb-1">Game Mode</label>
                        <div className="grid grid-cols-2 gap-2">
                            {GAME_MODES.map((m) => (
                                <button
                                    key={m.value}
                                    type="button"
                                    onClick={() => {
                                        setGameMode(m.value);
                                        setFactionMode(m.value === 'team_battle');
                                    }}
                                    className={`rounded-md border px-3 py-2 text-center text-sm font-medium transition ${
                                        gameMode === m.value
                                            ? 'border-[#ffa116] bg-[#ffa116]/10 text-[#ffa116]'
                                            : 'border-[#3a3a3a] bg-[#1f1f1f] text-[#eff1f6] hover:border-white/30'
                                    }`}
                                >
                                    {m.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-medium text-[#8a8a8a] block mb-1">Language</label>
                        <select
                            value={programmingLanguage}
                            onChange={(event) => setProgrammingLanguage(event.currentTarget.value)}
                            className="w-full rounded-md border border-[#3a3a3a] bg-[#1a1a1a] px-3 py-2 text-sm text-white outline-none focus:border-[#ffa116]/70"
                        >
                            {PROGRAMMING_LANGUAGES.map((language) => (
                                <option key={language.value} value={language.value}>
                                    {language.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="text-xs font-medium text-[#8a8a8a] block mb-1">Map Size</label>
                        <div className="flex gap-2">
                            {MAP_SIZES.map((s) => (
                                <button
                                    key={s.value}
                                    type="button"
                                    onClick={() => setMapSize(s.value)}
                                    className={`flex-1 rounded-md border py-2 text-center text-sm transition ${
                                        mapSize === s.value
                                            ? 'border-[#ffa116] bg-[#ffa116]/10 text-[#ffa116]'
                                            : 'border-[#3a3a3a] bg-[#1f1f1f] text-[#eff1f6] hover:border-white/30'
                                    }`}
                                >
                                    <span className="font-medium">{s.label}</span>
                                    <p className="text-xs text-[#8a8a8a]">{s.desc}</p>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        {!factionMode ? (
                            <div>
                                <label className="text-xs font-medium text-[#8a8a8a] block mb-1">Max Players</label>
                                <div className="flex gap-1.5">
                                    {[2, 3, 4].map((n) => (
                                        <button
                                            key={n}
                                            type="button"
                                            onClick={() => setMaxPlayers(n)}
                                            className={`flex-1 rounded-md border py-2 text-sm font-medium transition ${
                                                maxPlayers === n
                                                    ? 'border-[#ffa116] bg-[#ffa116]/10 text-[#ffa116]'
                                                    : 'border-[#3a3a3a] bg-[#1f1f1f] text-[#eff1f6] hover:border-white/30'
                                            }`}
                                        >
                                            {n}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div>
                                <label className="text-xs font-medium text-[#8a8a8a] block mb-1">Factions</label>
                                <div className="flex gap-1.5">
                                    {[2, 3, 4].map((n) => (
                                        <button
                                            key={n}
                                            type="button"
                                            onClick={() => setFactionCount(n)}
                                            className={`flex-1 rounded-md border py-2 text-sm font-medium transition ${
                                                factionCount === n
                                                    ? 'border-[#ffa116] bg-[#ffa116]/10 text-[#ffa116]'
                                                    : 'border-[#3a3a3a] bg-[#1f1f1f] text-[#eff1f6] hover:border-white/30'
                                            }`}
                                        >
                                            {n}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <div>
                        <label className="text-xs font-medium text-[#8a8a8a] block mb-1">Win Condition</label>
                        <div className="grid gap-2">
                            {WIN_CONDITIONS.map((wc) => (
                                <button
                                    key={wc.value}
                                    type="button"
                                    onClick={() => setWinCondition(wc.value)}
                                    className={`rounded-md border px-3 py-2 text-left text-sm transition ${
                                        winCondition === wc.value
                                            ? 'border-[#ffa116] bg-[#ffa116]/10 text-[#ffa116]'
                                            : 'border-[#3a3a3a] bg-[#1f1f1f] text-[#eff1f6] hover:border-white/30'
                                    }`}
                                >
                                    <span className="font-medium">{wc.label}</span>
                                    <p className="mt-0.5 text-xs text-[#8a8a8a]">{wc.desc}</p>
                                </button>
                            ))}
                        </div>
                    </div>

                    {friends.length > 0 && (
                        <div className="rounded-md border border-[#3a3a3a] bg-[#1f1f1f] p-3">
                            <div className="flex items-center justify-between gap-3">
                                <label className="text-xs font-medium text-[#8a8a8a]">
                                    Invite Friends
                                </label>
                                <div className="flex items-center gap-2">
                                    <span className="rounded-full bg-[#333] px-2 py-0.5 text-xs font-semibold text-[#ffa116]">
                                        {selectedFriends.size} selected
                                    </span>
                                    {selectedFriends.size > 0 && (
                                        <button
                                            type="button"
                                            onClick={() => setSelectedFriends(new Set())}
                                            className="text-xs font-medium text-[#8a8a8a] transition hover:text-red-300"
                                        >
                                            Clear
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="relative mt-2">
                                <Search
                                    size={15}
                                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#777]"
                                />
                                <input
                                    value={friendSearch}
                                    onChange={(event) => setFriendSearch(event.target.value)}
                                    placeholder="Search friends"
                                    className="w-full rounded-md border border-[#3a3a3a] bg-[#171717] py-2 pl-9 pr-3 text-sm text-white outline-none transition placeholder:text-[#666] focus:border-[#ffa116]/70"
                                />
                            </div>

                            {selectedFriendRows.length > 0 && (
                                <div className="mt-2 flex max-h-20 flex-wrap gap-1.5 overflow-y-auto pr-1">
                                    {selectedFriendRows.map((friend) => (
                                        <button
                                            key={friend.friendship_id}
                                            type="button"
                                            onClick={() => toggleFriend(friend.friend.id)}
                                            className="inline-flex max-w-full items-center gap-1 rounded-full border border-[#ffa116]/50 bg-[#ffa116]/10 px-2 py-1 text-xs font-medium text-[#ffd08a] transition hover:border-red-300/60 hover:text-red-200"
                                        >
                                            <span className="truncate">{friend.friend.leetcode_username}</span>
                                            <X size={12} />
                                        </button>
                                    ))}
                                </div>
                            )}

                            <div className="mt-2 max-h-44 overflow-y-auto rounded-md border border-[#333] bg-[#171717]">
                                {filteredFriends.length === 0 ? (
                                    <p className="px-3 py-3 text-sm text-[#777]">No friends found</p>
                                ) : (
                                    filteredFriends.map((friend) => {
                                        const isSelected = selectedFriends.has(friend.friend.id);
                                        return (
                                            <button
                                                key={friend.friendship_id}
                                                type="button"
                                                onClick={() => toggleFriend(friend.friend.id)}
                                                className="flex w-full items-center gap-3 border-b border-[#2d2d2d] px-3 py-2.5 text-left text-sm transition last:border-b-0 hover:bg-[#252525]"
                                            >
                                                <span
                                                    className={`grid h-5 w-5 shrink-0 place-items-center rounded border transition ${
                                                        isSelected
                                                            ? 'border-[#ffa116] bg-[#ffa116] text-[#111]'
                                                            : 'border-[#555] bg-[#1f1f1f] text-transparent'
                                                    }`}
                                                >
                                                    <Check size={13} strokeWidth={3} />
                                                </span>
                                                <span className="min-w-0 flex-1 truncate text-[#eff1f6]">
                                                    {friend.friend.leetcode_username}
                                                </span>
                                            </button>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    )}

                    {error && <p className="text-sm text-red-400">{error}</p>}
                </div>

                <button
                    type="button"
                    onClick={handleCreate}
                    disabled={loading || !name.trim()}
                    className="mt-5 w-full shrink-0 rounded-md bg-[#ffa116] py-2.5 text-sm font-semibold text-[#111] transition hover:bg-[#ffb84d] disabled:cursor-not-allowed disabled:bg-[#3a3a3a] disabled:text-[#777]"
                >
                    {loading ? 'Creating...' : 'Create Lobby'}
                </button>
            </div>
        </div>
    );
}
