import { useState, useCallback, useMemo } from 'react';
import { ArrowLeft } from 'lucide-react';
import ProvinceMap from '../components/ProvinceMap';
import ProvincePopup, { type Owner } from '../components/ProvincePopup';
import { EventLogPanel } from '../components/map/EventLogPanel';
import { MapLegend } from '../components/map/MapLegend';
import { ScoreBar } from '../components/map/ScoreBar';
import { LastWeekBanner } from '../components/map/LastWeekBanner';
import { useMapEvents } from '../hooks/useMapEvents';
import { useMapSync } from '../hooks/useMapSync';
import { REGIONS } from '../mapRegions';

type MapPageProps = {
    currentUserId: number;
    currentUsername: string;
    friendshipId: number;
    friendId: number;
    friendUsername: string;
    onBack: () => void;
};

export function MapPage({
    currentUserId,
    currentUsername,
    friendshipId,
    friendId,
    friendUsername,
    onBack,
}: MapPageProps) {
    const {
        provincesData,
        scoreData,
        playerAvatarUrl,
        friendAvatarUrl,
        lastWeekResult,
        loading,
        syncTick,
        reset,
    } = useMapSync(friendshipId);
    const { events } = useMapEvents(friendshipId, syncTick);

    const [selectedProvince, setSelectedProvince] = useState<string | null>(null);
    const [popPos, setPopPos] = useState<{ x: number; y: number } | null>(null);
    const [hoveredProvinces, setHoveredProvinces] = useState<string[] | null>(null);

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

                    <div className="ml-auto">
                        {currentUserId === 1 && (
                            <button
                                type="button"
                                onClick={reset}
                                disabled={loading}
                                className="rounded-md border border-[#3a3a3a] bg-[#262626] px-3 py-1.5 text-xs font-medium text-[#d7d7d7] transition hover:border-[#ffa116]/60 hover:text-[#ffa116] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {loading ? 'Resetting...' : 'Reset map'}
                            </button>
                        )}
                    </div>
                </header>

                {scoreData && (
                    <ScoreBar
                        scoreData={scoreData}
                        currentUsername={currentUsername}
                        friendUsername={friendUsername}
                        playerAvatarUrl={playerAvatarUrl}
                        friendAvatarUrl={friendAvatarUrl}
                    />
                )}

                {lastWeekResult && (
                    <LastWeekBanner
                        lastWeekResult={lastWeekResult}
                        currentUserId={currentUserId}
                    />
                )}

                <section className="mt-6 overflow-hidden rounded-lg border border-[#3a3a3a] bg-[#262626] p-4 shadow-xl shadow-black/20">
                    {loading ? (
                        <div className="flex items-center justify-center py-20 text-[#8a8a8a]">
                            Loading map...
                        </div>
                    ) : (
                        <div className="flex items-stretch justify-center gap-3">
                            <MapLegend
                                regions={REGIONS}
                                onHover={setHoveredProvinces}
                                className="hidden w-40 shrink-0 list-none space-y-2 md:flex md:flex-col"
                            />

                            <div className="min-w-0 flex-1 self-start">
                                <ProvinceMap
                                    captured={captured}
                                    onSelect={handleSelect}
                                    highlightedProvinces={hoveredProvinces}
                                />
                            </div>

                            <EventLogPanel
                                events={events}
                                currentUserId={currentUserId}
                                className="hidden w-72 shrink-0 max-h-[560px] md:flex"
                            />
                        </div>
                    )}

                    {provincesData.length > 0 && (
                        <>
                            <EventLogPanel
                                events={events}
                                currentUserId={currentUserId}
                                className="mt-4 max-h-72 md:hidden"
                            />
                            <MapLegend
                                regions={REGIONS}
                                onHover={setHoveredProvinces}
                                className="mt-4 flex list-none flex-col gap-2 md:hidden"
                            />
                        </>
                    )}
                </section>

                <ProvincePopup
                    provinceId={selectedProvince}
                    pos={popPos}
                    owner={selectedProvinceData ? captured.get(selectedProvinceData.province_id) : undefined}
                    capturedByUsername={selectedProvinceData?.captured_by_username ?? undefined}
                    problem={selectedProvinceData?.problem ?? null}
                    submissionUrl={selectedProvinceData?.captured_submission_url ?? null}
                    capturerLeetcodeUsername={selectedProvinceData?.capturer_leetcode_username ?? null}
                    firstCaptureOwner={
                        selectedProvinceData?.first_captured_by === currentUserId
                            ? 'player'
                            : selectedProvinceData?.first_captured_by === friendId
                              ? 'enemy'
                              : undefined
                    }
                    capturedRuntimeMs={selectedProvinceData?.captured_runtime_ms}
                    onClose={handleClose}
                />
            </div>
        </main>
    );
}
