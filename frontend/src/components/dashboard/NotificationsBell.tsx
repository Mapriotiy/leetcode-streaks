import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { apiRequest } from "../../api/client";
import { eventText, relativeTime } from "../../eventText";
import type { FeedItemApiData } from "../../types/events";

type NotificationsBellProps = {
    userId: number;
    refreshKey: number;
    onOpenMap: (friendshipId: number, friendId: number, friendUsername: string) => void;
};

function seenStorageKey(userId: number) {
    return `eventsSeen:${userId}`;
}

export function NotificationsBell({ userId, refreshKey, onOpenMap }: NotificationsBellProps) {
    const [items, setItems] = useState<FeedItemApiData[]>([]);
    const [open, setOpen] = useState(false);
    const [seenId, setSeenId] = useState(() =>
        Number(localStorage.getItem(seenStorageKey(userId)) ?? 0),
    );
    // Watermark from before the dropdown was opened, so freshly-read items
    // stay highlighted while it is open.
    const [highlightAboveId, setHighlightAboveId] = useState(seenId);

    useEffect(() => {
        apiRequest<FeedItemApiData[]>("/events/feed?limit=30")
            .then(setItems)
            .catch(() => {});
    }, [refreshKey]);

    const unreadCount = items.filter((item) => item.id > seenId).length;

    function toggleOpen() {
        const next = !open;
        setOpen(next);

        if (next && items.length > 0) {
            setHighlightAboveId(seenId);
            const maxId = Math.max(...items.map((item) => item.id));
            if (maxId > seenId) {
                localStorage.setItem(seenStorageKey(userId), String(maxId));
                setSeenId(maxId);
            }
        }
    }

    return (
        <div className="relative">
            <button
                type="button"
                onClick={toggleOpen}
                className="relative grid h-10 w-10 place-items-center rounded-md border border-[#4a4a4a] bg-[#333333] text-[#b3b3b3] transition hover:border-[#ffa116]/60 hover:text-[#ffa116]"
                aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
            >
                <Bell size={18} />
                {unreadCount > 0 && (
                    <span className="absolute -right-1.5 -top-1.5 grid min-w-5 place-items-center rounded-full bg-[#ff2d55] px-1 text-[11px] font-bold text-white">
                        {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                )}
            </button>

            {open && (
                <>
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setOpen(false)}
                    />
                    <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-lg border border-[#3a3a3a] bg-[#262626] shadow-2xl shadow-black/40">
                        <p className="border-b border-[#3a3a3a] px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-[#a3a3a3]">
                            Latest news
                        </p>

                        <div className="max-h-96 overflow-y-auto">
                            {items.length === 0 ? (
                                <p className="px-4 py-6 text-sm text-[#8a8a8a]">
                                    Nothing yet. Capture a province to make news.
                                </p>
                            ) : (
                                items.map((item) => {
                                    const isUnread = item.id > highlightAboveId;
                                    const lostToEnemy =
                                        item.event_type === "recapture" &&
                                        item.previous_owner_user_id === userId;

                                    return (
                                        <button
                                            key={item.id}
                                            type="button"
                                            onClick={() => {
                                                setOpen(false);
                                                onOpenMap(
                                                    item.friendship_id,
                                                    item.friend_id,
                                                    item.friend_username,
                                                );
                                            }}
                                            className={`block w-full border-b border-[#3a3a3a]/60 px-4 py-3 text-left text-sm transition last:border-b-0 hover:bg-[#2f2f2f] ${
                                                isUnread ? "bg-[#ffa116]/5" : ""
                                            }`}
                                        >
                                            <span
                                                className={`block ${
                                                    lostToEnemy
                                                        ? "text-[#ff2d55]"
                                                        : "text-[#eff1f6]"
                                                }`}
                                            >
                                                {eventText(item, userId)}
                                            </span>
                                            <span className="mt-1 block text-xs text-[#8a8a8a]">
                                                vs {item.friend_username} · {relativeTime(item.created_at)}
                                            </span>
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
