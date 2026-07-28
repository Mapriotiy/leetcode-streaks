export type MapEventApiData = {
    id: number;
    friendship_id: number;
    weekly_map_id: number;
    province_id: string;
    event_type: 'capture' | 'recapture' | 'defense';
    actor_user_id: number;
    actor_username: string;
    previous_owner_user_id: number | null;
    previous_owner_username: string | null;
    problem_title_slug: string;
    problem_title: string | null;
    problem_difficulty: string | null;
    points: number | null;
    runtime_ms: number | null;
    previous_runtime_ms: number | null;
    created_at: string;
};

export type FeedItemApiData = MapEventApiData & {
    friend_id: number;
    friend_username: string;
};
