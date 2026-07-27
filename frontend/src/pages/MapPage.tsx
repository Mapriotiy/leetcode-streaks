import { useEffect, useState } from "react";
import { ArrowLeft, Map } from "lucide-react";

type MapPageProps = {
    friendshipId: number;
    friendUsername: string;
    onBack: () => void;
};

export function MapPage({
                            friendshipId: _friendshipId,
                            friendUsername,
                            onBack,
                        }: MapPageProps) {
    const [svgContent, setSvgContent] = useState<string | null>(null);
    const [hoveredRegion, setHoveredRegion] = useState<string | null>(null);

    useEffect(() => {
        fetch(`${import.meta.env.BASE_URL}leet_map.svg`)
            .then((res) => res.text())
            .then((text) => {
                let processed = text;

                processed = processed.replace(/(<svg\b[^>]*?)\s+width="[^"]*"/, "$1");
                processed = processed.replace(/(<svg\b[^>]*?)\s+height="[^"]*"/, "$1");

                if (/preserveAspectRatio=/.test(processed)) {
                    processed = processed.replace(
                        /preserveAspectRatio="[^"]*"/,
                        'preserveAspectRatio="none"',
                    );
                } else {
                    processed = processed.replace(
                        /<svg\b/,
                        '<svg preserveAspectRatio="none"',
                    );
                }

                const regionMap: Record<string, string> = {
                    isle1: "isle1",
                    isle2: "isle2",
                    isle3: "isle3",
                    region1: "region1",
                    region2: "region2",
                    region3: "region3",
                    region4: "region4",
                };

                for (const [label, id] of Object.entries(regionMap)) {
                    const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                    processed = processed.replace(
                        new RegExp(
                            `(<(?:g|path)[^>]*inkscape:label="${escapedLabel}"[^>]*id="[^"]*")`,
                            "g",
                        ),
                        `$1 class="map-region" data-region="${id}"`,
                    );
                }
                setSvgContent(processed);
            })
            .catch(() => setSvgContent(null));
    }, []);

    function handleSvgHover(e: React.MouseEvent<HTMLDivElement>) {
        const target = e.target as SVGElement;
        const regionGroup = target.closest(".map-region");
        if (regionGroup) {
            setHoveredRegion(regionGroup.getAttribute("data-region"));
        } else {
            setHoveredRegion(null);
        }
    }

    function handleSvgClick(e: React.MouseEvent<HTMLDivElement>) {
        const target = e.target as SVGElement;
        const regionGroup = target.closest(".map-region");
        if (regionGroup) {
            setHoveredRegion(regionGroup.getAttribute("data-region"));
        }
    }

    const REGION_INFO: Record<string, { label: string; color: string }> = {
        isle1: { label: "Isle 1", color: "#d500ff" },
        isle2: { label: "Isle 2", color: "#ff001d" },
        isle3: { label: "Isle 3", color: "#3b0909" },
        region1: { label: "Region 1", color: "#23e929" },
        region2: { label: "Region 2", color: "#2346e9" },
        region3: { label: "Region 3", color: "#e08900" },
        region4: { label: "Region 4", color: "#ff0842" },
    };

    const regions = Object.entries(REGION_INFO);
    const regionInfo = hoveredRegion ? REGION_INFO[hoveredRegion] : null;

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
                            Capture regions by solving problems
                        </p>
                    </div>
                </header>

                {regionInfo ? (
                    <div
                        className="mt-4 rounded-md border px-4 py-3 text-sm"
                        style={{
                            borderColor: `${regionInfo.color}40`,
                            backgroundColor: `${regionInfo.color}15`,
                        }}
                    >
                        <span
                            className="font-semibold"
                            style={{ color: regionInfo.color }}
                        >
                            {regionInfo.label}
                        </span>
                        {" — Click to view problems (coming soon)"}
                    </div>
                ) : (
                    <div className="mt-4 rounded-md border border-[#3a3a3a] bg-[#262626] px-4 py-3 text-sm text-[#8a8a8a]">
                        Hover over a region to see its name
                    </div>
                )}

                <section className="mt-6 overflow-hidden rounded-lg border border-[#3a3a3a] bg-[#262626] shadow-xl shadow-black/20">
                    {svgContent ? (
                        <div className="relative w-full">
                            <img
                                src={`${import.meta.env.BASE_URL}leet_background.png`}
                                alt=""
                                className="block w-full"
                            />
                            <div
                                className="absolute inset-0 h-full w-full [&>svg]:h-full [&>svg]:w-full"
                                dangerouslySetInnerHTML={{ __html: svgContent }}
                                onClick={handleSvgClick}
                                onMouseMove={handleSvgHover}
                                onMouseLeave={() => setHoveredRegion(null)}
                                style={{ cursor: "pointer" }}
                            />
                        </div>
                    ) : (
                        <div className="flex items-center justify-center py-20 text-[#8a8a8a]">
                            <Map size={24} className="mr-2" />
                            Loading map...
                        </div>
                    )}
                </section>

                <section className="mt-6 rounded-lg border border-[#3a3a3a] bg-[#262626] p-6 shadow-xl shadow-black/20">
                    <h2 className="text-sm font-semibold text-[#d7d7d7]">
                        Regions
                    </h2>
                    <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                        {regions.map(([id, info]) => (
                            <li
                                key={id}
                                className="flex items-center gap-3 rounded-md border border-[#3a3a3a] bg-[#1f1f1f] px-3 py-2 text-sm"
                            >
                                <span
                                    className="h-3 w-3 shrink-0 rounded-full"
                                    style={{ backgroundColor: info.color }}
                                />
                                <span className="text-[#eff1f6]">
                                    {info.label}
                                </span>
                            </li>
                        ))}
                    </ul>
                </section>
            </div>
        </main>
    );
}