import { useState, useEffect, useCallback, useMemo } from 'react';
import { ArrowLeft } from 'lucide-react';
import { apiRequest } from '../api/client';
import ProvinceMap from '../components/ProvinceMap';
import ProvincePopup, { type Owner } from '../components/ProvincePopup';

type ProblemApiData = {
    title: string;
    title_slug: string;
    difficulty: string;
    url: string;
};

type ProvinceApiData = {
    province_id: string;
    region_id: string;
    region_name: string;
    problem: ProblemApiData | null;
    captured_by: number | null;
    captured_by_username: string | null;
    captured_at: string | null;
};

type ScoreApiData = {
    player_provinces: number;
    friend_provinces: number;
    neutral_provinces: number;
    total_provinces: number;
    player_regions: number;
    friend_regions: number;
    total_regions: number;
};

type WeeklyMapApiResponse = {
    week_start: string;
    friendship_id: number;
    provinces: ProvinceApiData[];
    score: ScoreApiData;
    player_avatar_url: string | null;
    friend_avatar_url: string | null;
};

type SyncApiResponse = {
    captured_count: number;
    provinces: ProvinceApiData[];
    score: ScoreApiData;
    player_avatar_url: string | null;
    friend_avatar_url: string | null;
};

type MapPageProps = {
    currentUserId: number;
    currentUsername: string;
    friendshipId: number;
    friendId: number;
    friendUsername: string;
    onBack: () => void;
};

type Region = {
    id: string;
    color: string;
    name: string;
    provinces: string[];
};

const REGIONS: Region[] = [
    { id: 'isle1', color: '#d500ff', name: 'Trees and Graphs', provinces: ['path34', 'path36'] },
    { id: 'isle2', color: '#ff001d', name: 'Binary Search', provinces: ['path44', 'path48', 'path49'] },
    { id: 'isle3', color: '#3b0909', name: 'Hard Problem Land', provinces: ['path53'] },
    { id: 'region1', color: '#23e929', name: 'Linked Lists', provinces: ['path56', 'path57', 'path58', 'path60'] },
    { id: 'region2', color: '#2346e9', name: 'Two Pointers / Sliding Window', provinces: ['path63', 'path64', 'path65', 'path66', 'path68', 'path69'] },
    { id: 'region3', color: '#e08900', name: 'Arrays and Hashing', provinces: ['path72', 'path73', 'path74', 'path75', 'path76', 'path79', 'path80'] },
    { id: 'region4', color: '#ff0842', name: 'Stacks', provinces: ['path83', 'path86', 'path87', 'path89', 'path91'] },
];

const LEFT_REGIONS = ['isle1', 'isle2', 'region1', 'region2'];
const RIGHT_REGIONS = ['isle3', 'region3', 'region4'];

const POLL_INTERVAL_MS = 60_000;

function LegendItem({
    region,
    onHover,
}: {
    region: Region;
    onHover: (provinces: string[] | null) => void;
}) {
    return (
        <li
            onMouseEnter={() => onHover(region.provinces)}
            onMouseLeave={() => onHover(null)}
            className="flex cursor-pointer items-center gap-3 rounded-md border border-[#3a3a3a] bg-[#1f1f1f] px-3 py-2.5 text-sm transition hover:border-white/30 hover:bg-[#2a2a2a]"
        >
            <span
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: region.color }}
            />
            <span className="text-[#eff1f6]">{region.name}</span>
        </li>
    );
}

export function MapPage({
    currentUserId,
    currentUsername,
    friendshipId,
    friendId,
    friendUsername,
    onBack,
}: MapPageProps) {
    const [provincesData, setProvincesData] = useState<ProvinceApiData[]>([]);
    const [scoreData, setScoreData] = useState<ScoreApiData | null>(null);
    const [playerAvatarUrl, setPlayerAvatarUrl] = useState<string | null>(null);
    const [friendAvatarUrl, setFriendAvatarUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedProvince, setSelectedProvince] = useState<string | null>(null);
    const [popPos, setPopPos] = useState<{ x: number; y: number } | null>(null);
    const [hoveredProvinces, setHoveredProvinces] = useState<string[] | null>(null);

    useEffect(() => {
        setLoading(true);
        apiRequest<WeeklyMapApiResponse>(`/maps/${friendshipId}`)
            .then((data) => {
                setProvincesData(data.provinces);
                setScoreData(data.score);
                setPlayerAvatarUrl(data.player_avatar_url);
                setFriendAvatarUrl(data.friend_avatar_url);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [friendshipId]);

    useEffect(() => {
        const interval = setInterval(() => {
            apiRequest<SyncApiResponse>(`/maps/${friendshipId}/sync`, { method: 'POST' })
                .then((data) => {
                    if (data.provinces.length > 0) {
                        setProvincesData(data.provinces);
                        setScoreData(data.score);
                        if (data.player_avatar_url) setPlayerAvatarUrl(data.player_avatar_url);
                        if (data.friend_avatar_url) setFriendAvatarUrl(data.friend_avatar_url);
                    }
                })
                .catch(() => {});
        }, POLL_INTERVAL_MS);

        return () => clearInterval(interval);
    }, [friendshipId]);

    const captured = useMemo(() => {
        const map = new Map<string, Owner>();
        for (const p of provincesData) {
            if (p.captured_by === currentUserId) {
                map.set(p.province_id, 'player');
            } else if (p.captured_by === friendId) {
                map.set(p.province_id, 'enemy');
            }
        }
        return map;
    }, [provincesData, currentUserId, friendId]);

    const handleSelect = useCallback((id: string, pos: { x: number; y: number }) => {
        setSelectedProvince(id);
        setPopPos(pos);
    }, []);

    const handleClose = useCallback(() => {
        setSelectedProvince(null);
        setPopPos(null);
    }, []);

    const selectedProvinceData = selectedProvince
        ? provincesData.find((p) => p.province_id === selectedProvince) ?? null
        : null;

    const leftItems = useMemo(
        () => REGIONS.filter((r) => LEFT_REGIONS.includes(r.id)),
        [],
    );
    const rightItems = useMemo(
        () => REGIONS.filter((r) => RIGHT_REGIONS.includes(r.id)),
        [],
    );

    return (
        <main className="min-h-screen bg-[#1a1a1a] p-6 text-white">
            <div className="mx-auto max-w-5xl">
                <header className="flex items-center gap-4">
                    <button
                        type="button"
                        onClick={onBack}
                        className="grid h-10 w-10 place-items-center rounded-md border border-[#3a3a3a] bg-[#262626] text-[#b3b3b3] transition hover:border-[#ffa116]/60 hover:text-[#ffa116]"
                    >
                        <ArrowLeft size={20} />
                    </button>

                    <div>
                        <h1 className="text-2xl font-semibold tracking-tight">
                            Map vs {friendUsername}
                        </h1>
                        <p className="mt-1 text-sm text-[#8a8a8a]">
                            Capture provinces by solving problems
                        </p>
                    </div>
                </header>

                {scoreData && (
                    <section className="mt-6 rounded-lg border border-[#3a3a3a] bg-[#262626] p-4 shadow-xl shadow-black/20">
                        <div className="flex items-center justify-center gap-4">
                            <div className="flex shrink-0 items-center gap-2">
                                {playerAvatarUrl ? (
                                    <img
                                        src={playerAvatarUrl}
                                        alt={currentUsername}
                                        className="h-10 w-10 shrink-0 rounded-full border border-[#3a3a3a] object-cover"
                                    />
                                ) : (
                                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#00e5ff]/20 text-sm font-bold text-[#00e5ff]">
                                        {currentUsername[0].toUpperCase()}
                                    </div>
                                )}
                                <span className="hidden text-sm font-medium text-[#eff1f6] sm:block">
                                    {currentUsername}
                                </span>
                            </div>

                            <div className="flex h-3 flex-1 overflow-hidden rounded-full bg-[#333]">
                                {scoreData.player_provinces > 0 && (
                                    <div
                                        className="h-full transition-all duration-500"
                                        style={{
                                            width: `${(scoreData.player_provinces / scoreData.total_provinces) * 100}%`,
                                            backgroundColor: '#00e5ff',
                                        }}
                                    />
                                )}
                                {scoreData.neutral_provinces > 0 && (
                                    <div
                                        className="h-full transition-all duration-500"
                                        style={{
                                            width: `${(scoreData.neutral_provinces / scoreData.total_provinces) * 100}%`,
                                            backgroundColor: '#555',
                                        }}
                                    />
                                )}
                                {scoreData.friend_provinces > 0 && (
                                    <div
                                        className="h-full transition-all duration-500"
                                        style={{
                                            width: `${(scoreData.friend_provinces / scoreData.total_provinces) * 100}%`,
                                            backgroundColor: '#ff2d55',
                                        }}
                                    />
                                )}
                            </div>

                            <div className="flex shrink-0 items-center gap-2">
                                <span className="hidden text-sm font-medium text-[#eff1f6] sm:block">
                                    {friendUsername}
                                </span>
                                {friendAvatarUrl ? (
                                    <img
                                        src={friendAvatarUrl}
                                        alt={friendUsername}
                                        className="h-10 w-10 shrink-0 rounded-full border border-[#3a3a3a] object-cover"
                                    />
                                ) : (
                                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#ff2d55]/20 text-sm font-bold text-[#ff2d55]">
                                        {friendUsername[0].toUpperCase()}
                                    </div>
                                )}
                            </div>
                        </div>
                    </section>
                )}

                <section className="mt-6 overflow-hidden rounded-lg border border-[#3a3a3a] bg-[#262626] p-4 shadow-xl shadow-black/20">
                    {loading ? (
                        <div className="flex items-center justify-center py-20 text-[#8a8a8a]">
                            Loading map...
                        </div>
                    ) : (
                        <div className="flex items-start justify-center gap-3">
                            <ul className="hidden w-40 shrink-0 list-none space-y-2 md:flex md:flex-col">
                                {leftItems.map((region) => (
                                    <LegendItem
                                        key={region.id}
                                        region={region}
                                        onHover={setHoveredProvinces}
                                    />
                                ))}
                            </ul>

                            <div className="min-w-0 flex-1">
                                <ProvinceMap
                                    captured={captured}
                                    onSelect={handleSelect}
                                    highlightedProvinces={hoveredProvinces}
                                />
                            </div>

                            <ul className="hidden w-40 shrink-0 list-none space-y-2 md:flex md:flex-col">
                                {rightItems.map((region) => (
                                    <LegendItem
                                        key={region.id}
                                        region={region}
                                        onHover={setHoveredProvinces}
                                    />
                                ))}
                            </ul>
                        </div>
                    )}

                    {provincesData.length > 0 && (
                        <ul className="mt-4 flex list-none flex-col gap-2 md:hidden">
                            {REGIONS.map((region) => (
                                <LegendItem
                                    key={region.id}
                                    region={region}
                                    onHover={setHoveredProvinces}
                                />
                            ))}
                        </ul>
                    )}
                </section>

                <ProvincePopup
                    provinceId={selectedProvince}
                    pos={popPos}
                    owner={selectedProvinceData ? captured.get(selectedProvinceData.province_id) : undefined}
                    capturedByUsername={selectedProvinceData?.captured_by_username ?? undefined}
                    problem={selectedProvinceData?.problem ?? null}
                    onClose={handleClose}
                />
            </div>
        </main>
    );
}