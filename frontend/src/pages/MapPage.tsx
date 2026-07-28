import { useState, useCallback, useMemo } from 'react';
import { ArrowLeft } from 'lucide-react';
import ProvinceMap from '../components/ProvinceMap';
import ProvincePopup, { type Owner } from '../components/ProvincePopup';

type MapPageProps = {
    friendshipId: number;
    friendUsername: string;
    onBack: () => void;
};

type Region = {
    id: string;
    color: string;
    name: string;
    provinces: string[];
};

const REGIONS: Region[] = [
    { id: 'isle1', color: '#d500ff', name: 'Trees and Graphs', provinces: ['path34', 'path36'] },
    { id: 'isle2', color: '#ff001d', name: 'Binary Search', provinces: ['path44', 'path48', 'path49'] },
    { id: 'isle3', color: '#3b0909', name: 'Hard Problem Land', provinces: ['path53'] },
    { id: 'region1', color: '#23e929', name: 'Linked Lists', provinces: ['path56', 'path57', 'path58', 'path60'] },
    { id: 'region2', color: '#2346e9', name: 'Two Pointers / Sliding Window', provinces: ['path63', 'path64', 'path65', 'path66', 'path68', 'path69'] },
    { id: 'region3', color: '#e08900', name: 'Arrays and Hashing', provinces: ['path72', 'path73', 'path74', 'path75', 'path76', 'path79', 'path80'] },
    { id: 'region4', color: '#ff0842', name: 'Stacks', provinces: ['path83', 'path86', 'path87', 'path89', 'path91'] },
];

const LEFT_REGIONS = ['isle1', 'isle2', 'region1', 'region2'];
const RIGHT_REGIONS = ['isle3', 'region3', 'region4'];

function LegendItem({
    region,
    onHover,
}: {
    region: Region;
    onHover: (provinces: string[] | null) => void;
}) {
    return (
        <li
            onMouseEnter={() => onHover(region.provinces)}
            onMouseLeave={() => onHover(null)}
            className="flex cursor-pointer items-center gap-3 rounded-md border border-[#3a3a3a] bg-[#1f1f1f] px-3 py-2.5 text-sm transition hover:border-white/30 hover:bg-[#2a2a2a]"
        >
            <span
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: region.color }}
            />
            <span className="text-[#eff1f6]">{region.name}</span>
        </li>
    );
}

export function MapPage({
    friendshipId: _friendshipId,
    friendUsername,
    onBack,
}: MapPageProps) {
    const [captured, setCaptured] = useState<Map<string, Owner>>(new Map());
    const [selectedProvince, setSelectedProvince] = useState<string | null>(null);
    const [popPos, setPopPos] = useState<{ x: number; y: number } | null>(null);
    const [hoveredProvinces, setHoveredProvinces] = useState<string[] | null>(null);

    const handleCapture = useCallback((id: string, owner: Owner) => {
        setCaptured((prev) => {
            const next = new Map(prev);
            if (next.get(id) === owner) {
                next.delete(id);
            } else {
                next.set(id, owner);
            }
            return next;
        });
    }, []);

    const handleSelect = useCallback((id: string, pos: { x: number; y: number }) => {
        setSelectedProvince(id);
        setPopPos(pos);
    }, []);

    const handleClose = useCallback(() => {
        setSelectedProvince(null);
        setPopPos(null);
    }, []);

    const leftItems = useMemo(
        () => REGIONS.filter((r) => LEFT_REGIONS.includes(r.id)),
        [],
    );
    const rightItems = useMemo(
        () => REGIONS.filter((r) => RIGHT_REGIONS.includes(r.id)),
        [],
    );

    return (
        <main className="min-h-screen bg-[#1a1a1a] p-6 text-white">
            <div className="mx-auto max-w-5xl">
                <header className="flex items-center gap-4">
                    <button
                        type="button"
                        onClick={onBack}
                        className="grid h-10 w-10 place-items-center rounded-md border border-[#3a3a3a] bg-[#262626] text-[#b3b3b3] transition hover:border-[#ffa116]/60 hover:text-[#ffa116]"
                    >
                        <ArrowLeft size={20} />
                    </button>

                    <div>
                        <h1 className="text-2xl font-semibold tracking-tight">
                            Map vs {friendUsername}
                        </h1>
                        <p className="mt-1 text-sm text-[#8a8a8a]">
                            Capture provinces by solving problems
                        </p>
                    </div>
                </header>

                <section className="mt-6 overflow-hidden rounded-lg border border-[#3a3a3a] bg-[#262626] p-4 shadow-xl shadow-black/20">
                    <div className="flex items-start justify-center gap-3">
                        <ul className="hidden w-40 shrink-0 list-none space-y-2 md:flex md:flex-col">
                            {leftItems.map((region) => (
                                <LegendItem
                                    key={region.id}
                                    region={region}
                                    onHover={setHoveredProvinces}
                                />
                            ))}
                        </ul>

                        <div className="min-w-0 flex-1">
                            <ProvinceMap
                                captured={captured}
                                onSelect={handleSelect}
                                highlightedProvinces={hoveredProvinces}
                            />
                        </div>

                        <ul className="hidden w-40 shrink-0 list-none space-y-2 md:flex md:flex-col">
                            {rightItems.map((region) => (
                                <LegendItem
                                    key={region.id}
                                    region={region}
                                    onHover={setHoveredProvinces}
                                />
                            ))}
                        </ul>
                    </div>

                    <ul className="mt-4 flex list-none flex-col gap-2 md:hidden">
                        {REGIONS.map((region) => (
                            <LegendItem
                                key={region.id}
                                region={region}
                                onHover={setHoveredProvinces}
                            />
                        ))}
                    </ul>
                </section>

                <ProvincePopup
                    provinceId={selectedProvince}
                    pos={popPos}
                    owner={selectedProvince ? captured.get(selectedProvince) : undefined}
                    onClose={handleClose}
                    onCapture={handleCapture}
                />
            </div>
        </main>
    );
}