import { useEffect, useRef, useState } from 'react';
import { apiRequest } from '../api/client';
import type { GameEventApiData } from '../types/events';

export function useLobbyEvents(lobbyId: number, syncTick: number) {
    const [events, setEvents] = useState<GameEventApiData[]>([]);
    const lastIdRef = useRef(0);

    useEffect(() => {
        setEvents([]);
        lastIdRef.current = 0;
    }, [lobbyId]);

    // Refetches incrementally after every successful sync (syncTick).
    useEffect(() => {
        apiRequest<GameEventApiData[]>(
            `/lobbies/${lobbyId}/events?after_id=${lastIdRef.current}&limit=100`,
        )
            .then((newEvents) => {
                if (newEvents.length === 0) return;
                lastIdRef.current = newEvents[newEvents.length - 1].id;
                setEvents((prev) => {
                    const existingIds = new Set(prev.map((e) => e.id));
                    const filtered = newEvents.filter((e) => !existingIds.has(e.id));
                    return [...prev, ...filtered];
                });
            })
            .catch(() => {});
    }, [lobbyId, syncTick]);

    return { events };
}
