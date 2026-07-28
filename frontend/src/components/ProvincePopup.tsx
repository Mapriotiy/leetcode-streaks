export type Owner = 'player' | 'enemy';

const PROVINCE_NAMES: Record<string, string> = {
    path34: 'Sylvan Canopy', path36: 'Rootveil Hollow',
    path44: 'Pivot Peak', path48: 'Midpoint Mesa', path49: 'Bisect Bluffs',
    path53: 'The Obsidian Gauntlet',
    path56: 'Node Haven', path57: 'Chainspire Coast', path58: 'Sentinel Shore', path60: "Pointer's Rest",
    path63: 'Tidal Sliding Fen', path64: 'Dualstrike Fields', path65: 'Windowmere', path66: 'Slidevale',
    path68: "Pointer's Drift", path69: 'Riftward Expanse',
    path72: 'Index Spire', path73: 'The Hashforge', path74: 'Keymount Steppe', path75: 'Cipher Ridge',
    path76: 'Saltwind Coast', path79: 'Bucket Bay', path80: 'Collision Crossing',
    path83: 'Pushdown Heights', path86: 'Popfall Hollow', path87: 'Peaktower Citadel', path89: 'Lastthrone Plateau',
    path91: 'Undarspire',
};

const DIFFICULTY_COLORS: Record<string, string> = {
    Easy: '#00b8a3',
    Medium: '#ffc01e',
    Hard: '#ff375f',
};

type ProblemInfo = {
    title: string;
    title_slug: string;
    difficulty: string;
    url: string;
};

type ProvincePopupProps = {
    provinceId: string | null;
    pos: { x: number; y: number } | null;
    owner: Owner | undefined;
    capturedByUsername: string | undefined;
    problem: ProblemInfo | null;
    onClose: () => void;
};

export default function ProvincePopup({
    provinceId,
    pos,
    owner,
    capturedByUsername,
    problem,
    onClose,
}: ProvincePopupProps) {
    if (!provinceId || !pos) return null;

    const accent = owner === 'player' ? '#00e5ff' : owner === 'enemy' ? '#ff2d55' : '#666';

    const statusText =
        owner === 'player'
            ? 'Yours'
            : owner === 'enemy'
              ? capturedByUsername
                ? `${capturedByUsername}'s`
                : "Enemy's"
              : 'Free';

    return (
        <div className="fixed inset-0 z-50" onClick={onClose}>
            <div
                className="absolute bg-neutral-900 border rounded-lg p-3 shadow-2xl w-56"
                style={{
                    left: pos.x,
                    top: pos.y - 14,
                    transform: 'translate(-50%, -100%)',
                    borderColor: accent + '4d',
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-white text-sm font-semibold">
                        {PROVINCE_NAMES[provinceId] || provinceId}
                    </h3>
                    <button
                        onClick={onClose}
                        className="text-gray-500 hover:text-white text-lg leading-none"
                    >
                        &times;
                    </button>
                </div>

                <div className="flex items-center justify-between text-xs mb-2.5">
                    <span className="text-gray-400">Status</span>
                    <span style={{ color: accent }}>{statusText}</span>
                </div>

                {problem && (
                    <a
                        href={problem.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block rounded-md border border-[#3a3a3a] bg-[#1f1f1f] px-3 py-2 text-sm text-[#eff1f6] transition hover:border-white/30"
                    >
                        <span className="block truncate font-medium">
                            {problem.title}
                        </span>
                        <span
                            className="mt-1 inline-block text-xs font-medium"
                            style={{
                                color: DIFFICULTY_COLORS[problem.difficulty] ?? '#aaa',
                            }}
                        >
                            {problem.difficulty}
                        </span>
                    </a>
                )}

                <div
                    className="absolute left-1/2 -bottom-[7px] -translate-x-1/2 w-0 h-0"
                    style={{
                        borderLeft: '7px solid transparent',
                        borderRight: '7px solid transparent',
                        borderTop: `7px solid ${accent}4d`,
                    }}
                />
            </div>
        </div>
    );
}