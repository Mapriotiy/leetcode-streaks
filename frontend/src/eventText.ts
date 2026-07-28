import { PROVINCE_NAMES } from './mapRegions';
import type { MapEventApiData } from './types/events';

export function provinceName(provinceId: string): string {
    return PROVINCE_NAMES[provinceId] ?? provinceId;
}

export function eventText(event: MapEventApiData, currentUserId: number): string {
    const actor = event.actor_user_id === currentUserId ? 'You' : event.actor_username;
    const province = provinceName(event.province_id);

    switch (event.event_type) {
        case 'capture':
            return `${actor} captured ${province}${event.points ? ` (+${event.points})` : ''}`;
        case 'recapture': {
            const victim =
                event.previous_owner_user_id === currentUserId
                    ? 'you'
                    : event.previous_owner_username ?? 'the enemy';
            const runtimes =
                event.runtime_ms != null
                    ? ` — ${event.runtime_ms} ms beat ${
                          event.previous_runtime_ms != null
                              ? `${event.previous_runtime_ms} ms`
                              : 'an untimed solve'
                      }`
                    : '';
            return `${actor} stole ${province} from ${victim}${runtimes}`;
        }
        case 'defense':
            return `${actor} defended ${province}${
                event.runtime_ms != null ? ` — improved to ${event.runtime_ms} ms` : ''
            }`;
        default:
            return `${actor}: ${event.event_type} on ${province}`;
    }
}

// DB timestamps are naive UTC; make sure JS parses them as UTC.
export function parseEventDate(createdAt: string): Date {
    const hasZone = createdAt.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(createdAt);
    return new Date(hasZone ? createdAt : `${createdAt}Z`);
}

export function relativeTime(createdAt: string): string {
    const seconds = Math.max(
        0,
        Math.floor((Date.now() - parseEventDate(createdAt).getTime()) / 1000),
    );
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
}
