import { useCallback, useEffect, useRef, useState } from 'react';
import { apiRequest, API_URL } from '../api/client';
import type { GameEventApiData } from '../types/events';

const EVENT_POLL_INTERVAL_MS = 5_000;

export function useLobbyEvents(lobbyId: number, syncTick: number) {
    const [events, setEvents] = useState<GameEventApiData[]>([]);
    const lastIdRef = useRef(0);
    const isFetchingRef = useRef(false);

    useEffect(() => {
        setEvents([]);
        lastIdRef.current = 0;
    }, [lobbyId]);

    // Live push over SSE: new events arrive the moment the sync writes them,
    // without touching the (rate-limited) LeetCode sync at all.
    useEffect(() => {
        const token = localStorage.getItem('accessToken');
        if (!token) return;
        let es: EventSource | null = null;
        try {
            es = new EventSource(
                `${API_URL}/lobbies/${lobbyId}/events/stream?token=${encodeURIComponent(token)}&after_id=0`,
            );
        } catch {
            return;
        }
        const onEvent = (msg: MessageEvent) => {
            try {
                const event = JSON.parse(msg.data) as GameEventApiData;
                if (!event || typeof event.id !== 'number') return;
                lastIdRef.current = Math.max(lastIdRef.current, event.id);
                setEvents((prev) => {
                    if (prev.some((existing) => existing.id === event.id)) return prev;
                    return [...prev, event].sort((a, b) => a.id - b.id);
                });
            } catch {
                // ignore malformed frames; polling remains the fallback
            }
        };
        es.addEventListener('event', onEvent);
        return () => es?.close();
    }, [lobbyId]);

    const fetchEvents = useCallback(async () => {
        if (isFetchingRef.current) return;
        isFetchingRef.current = true;

        try {
            const newEvents = await apiRequest<GameEventApiData[]>(
                `/lobbies/${lobbyId}/events?after_id=${lastIdRef.current}&limit=100`,
            );

            if (newEvents.length === 0) return;

            lastIdRef.current = Math.max(
                lastIdRef.current,
                ...newEvents.map((event) => event.id),
            );
            setEvents((prev) => {
                const existingIds = new Set(prev.map((event) => event.id));
                const filtered = newEvents.filter((event) => !existingIds.has(event.id));
                return [...prev, ...filtered].sort((a, b) => a.id - b.id);
            });
        } catch {
            // Event polling is best-effort; game state sync remains the source of truth.
        } finally {
            isFetchingRef.current = false;
        }
    }, [lobbyId]);

    // Refetches incrementally after every successful sync (syncTick).
    useEffect(() => {
        void fetchEvents();
    }, [fetchEvents, syncTick]);

    // Events are cheap DB reads, so poll them independently from heavy LeetCode sync.
    useEffect(() => {
        const intervalId = window.setInterval(() => {
            void fetchEvents();
        }, EVENT_POLL_INTERVAL_MS);

        return () => window.clearInterval(intervalId);
    }, [fetchEvents]);

    return { events };
}
