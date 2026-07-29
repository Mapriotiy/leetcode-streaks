import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../api/client';
import type {
    LastWeekResultApiData,
    ProvinceApiData,
    ScoreApiData,
    SyncApiResponse,
    WeeklyMapApiResponse,
} from '../types/map';

const POLL_INTERVAL_MS = 30_000;

export function useMapSync(friendshipId: number) {
    const [provincesData, setProvincesData] = useState<ProvinceApiData[]>([]);
    const [scoreData, setScoreData] = useState<ScoreApiData | null>(null);
    const [playerAvatarUrl, setPlayerAvatarUrl] = useState<string | null>(null);
    const [friendAvatarUrl, setFriendAvatarUrl] = useState<string | null>(null);
    const [lastWeekResult, setLastWeekResult] = useState<LastWeekResultApiData | null>(null);
    const [loading, setLoading] = useState(true);
    // Incremented after every successful sync so consumers can react to fresh data.
    const [syncTick, setSyncTick] = useState(0);

    const applySync = useCallback((data: SyncApiResponse) => {
        if (data.provinces.length > 0) {
            setProvincesData(data.provinces);
            setScoreData(data.score);
            if (data.player_avatar_url) setPlayerAvatarUrl(data.player_avatar_url);
            if (data.friend_avatar_url) setFriendAvatarUrl(data.friend_avatar_url);
        }
        setSyncTick((tick) => tick + 1);
    }, []);

    useEffect(() => {
        setLoading(true);
        apiRequest<WeeklyMapApiResponse>(`/maps/${friendshipId}`)
            .then((data) => {
                setProvincesData(data.provinces);
                setScoreData(data.score);
                setPlayerAvatarUrl(data.player_avatar_url);
                setFriendAvatarUrl(data.friend_avatar_url);
                setLastWeekResult(data.last_week_result);
                return apiRequest<SyncApiResponse>(`/maps/${friendshipId}/sync`, { method: 'POST' });
            })
            .then((syncData) => {
                if (syncData) applySync(syncData);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [friendshipId, applySync]);

    useEffect(() => {
        const interval = setInterval(() => {
            apiRequest<SyncApiResponse>(`/maps/${friendshipId}/sync`, { method: 'POST' })
                .then(applySync)
                .catch(() => {});
        }, POLL_INTERVAL_MS);

        return () => clearInterval(interval);
    }, [friendshipId, applySync]);

    const reset = useCallback(async () => {
        setLoading(true);
        try {
            const data = await apiRequest<WeeklyMapApiResponse>(`/maps/${friendshipId}?reset=1`);
            setProvincesData(data.provinces);
            setScoreData(data.score);
            if (data.player_avatar_url) setPlayerAvatarUrl(data.player_avatar_url);
            if (data.friend_avatar_url) setFriendAvatarUrl(data.friend_avatar_url);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [friendshipId]);

    return {
        provincesData,
        scoreData,
        playerAvatarUrl,
        friendAvatarUrl,
        lastWeekResult,
        loading,
        syncTick,
        reset,
    };
}
