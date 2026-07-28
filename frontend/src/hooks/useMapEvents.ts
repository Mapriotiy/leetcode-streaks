import { useEffect, useRef, useState } from 'react';
import { apiRequest } from '../api/client';
import type { MapEventApiData } from '../types/events';

export function useMapEvents(friendshipId: number, syncTick: number) {
    const [events, setEvents] = useState<MapEventApiData[]>([]);
    const lastIdRef = useRef(0);

    useEffect(() => {
        setEvents([]);
        lastIdRef.current = 0;
    }, [friendshipId]);

    // Refetches incrementally after every successful map sync (syncTick).
    useEffect(() => {
        apiRequest<MapEventApiData[]>(
            `/events/map/${friendshipId}?after_id=${lastIdRef.current}&limit=100`,
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
    }, [friendshipId, syncTick]);

    return { events };
}
