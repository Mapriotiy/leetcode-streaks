export type DashboardData = {
    leetcode_username: string;
    avatar_url: string | null;
    current_streak: number;
    current_streak_state: "lit" | "pending" | "broken";
    today_active: boolean;
    longest_streak: number;
    active_days_count: number;
    today_submissions: {
        title: string;
        title_slug: string;
        url: string;
        submitted_at: string;
        language: string | null;
        difficulty: string | null;
        topic_tags: string[];
    }[];
    activity_calendar: ActivityCalendarDay[];
};

export type ActivityCalendarDay = {
    date: string;
    count: number;
};

export type CreateInviteResponse = {
    token: string;
    invite_url: string;
};

export type FriendResponse = {
    friendship_id: number;
    friend: {
        id: number;
        leetcode_username: string;
    };
    streak: {
        display_count: number;
        current_count: number;
        longest_count: number;
        state: "lit" | "pending" | "broken";
        last_shared_active_date: string | null;
        started_at: string;
        today: {
            you_active: boolean;
            friend_active: boolean;
            shared_active: boolean;
        };
    };
};
