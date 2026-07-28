import type { ScoreApiData } from '../../types/map';

type ScoreBarProps = {
    scoreData: ScoreApiData;
    currentUsername: string;
    friendUsername: string;
    playerAvatarUrl: string | null;
    friendAvatarUrl: string | null;
};

export function ScoreBar({
    scoreData,
    currentUsername,
    friendUsername,
    playerAvatarUrl,
    friendAvatarUrl,
}: ScoreBarProps) {
    return (
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
    );
}
