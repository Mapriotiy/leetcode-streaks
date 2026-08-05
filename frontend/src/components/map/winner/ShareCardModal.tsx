import { useEffect, useRef, useState } from "react";
import { Copy, Download, X } from "lucide-react";
import html2canvas from "html2canvas";
import ProvinceMap from "../../ProvinceMap";
import { GeneratedMapRenderer } from "../../../features/lobby-map/GeneratedMapRenderer";
import { generateShareCard, type ShareCardData } from "../../../utils/shareCard";

type ShareCardModalProps = {
    data: ShareCardData;
    replayUrl: string;
    onClose: () => void;
};

export function ShareCardModal({ data, replayUrl, onClose }: ShareCardModalProps) {
    const [cardUrl, setCardUrl] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const mapRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        let cancelled = false;
        let mounted = true;
        setCardUrl(null);

        (async () => {
            let background: HTMLCanvasElement | undefined;
            try {
                const el = mapRef.current;
                if (el) {
                    // Give the map a moment to render assets, then capture it.
                    await new Promise((resolve) => window.setTimeout(resolve, 400));
                    if (!mounted) return;
                    background = await html2canvas(el, {
                        backgroundColor: "#0a0b0d",
                        scale: 1,
                        useCORS: true,
                    });
                }
            } catch {
                background = undefined;
            }
            const url = await generateShareCard({ ...data, mapBackground: background });
            if (!cancelled) setCardUrl(url);
        })();

        return () => {
            cancelled = true;
            mounted = false;
        };
    }, [data]);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(replayUrl);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2000);
        } catch {
            /* ignore */
        }
    };

    const capturedMap = new Map(Object.entries(data.capturedColors ?? {}));
    const mapElement =
        data.mapKind === "generated" && data.draft ? (
            <GeneratedMapRenderer draft={data.draft as never} captured={capturedMap} zoomable={false} onSelect={() => {}} />
        ) : (
            <ProvinceMap captured={capturedMap} onSelect={() => {}} highlightedProvinces={null} />
        );

    return (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
            {/* Off-screen map used only for the capture. */}
            <div
                ref={mapRef}
                aria-hidden
                className="pointer-events-none fixed left-[-10000px] top-0 z-[-1]"
                style={{ width: 1080, height: 736, overflow: "hidden", background: "#0a0b0d" }}
            >
                {mapElement}
            </div>

            <div className="w-full max-w-sm overflow-hidden rounded-lg border border-[#3a3a3a] bg-[#202020] shadow-2xl">
                <div className="flex items-center justify-between border-b border-[#3a3a3a] px-4 py-2.5">
                    <p className="text-sm font-semibold text-[#eff1f6]">Share</p>
                    <button
                        type="button"
                        onClick={onClose}
                        className="grid h-8 w-8 place-items-center rounded-md text-[#8a8a8a] transition hover:text-white"
                    >
                        <X size={16} />
                    </button>
                </div>
                {cardUrl ? (
                    <img src={cardUrl} alt="Share card" className="block w-full" />
                ) : (
                    <div className="flex h-72 items-center justify-center text-sm text-[#8a8a8a]">
                        Generating…
                    </div>
                )}
                <div className="flex flex-col gap-2 p-4">
                    <a
                        href={cardUrl ?? undefined}
                        download="mapcode-share.png"
                        className="inline-flex items-center justify-center gap-2 rounded-md bg-[#ffa116] px-4 py-2.5 text-sm font-semibold text-[#111] transition hover:bg-[#ffb84d] disabled:opacity-50"
                    >
                        <Download size={16} />
                        Download image
                    </a>
                    <button
                        type="button"
                        onClick={() => void handleCopy()}
                        className="inline-flex items-center justify-center gap-2 rounded-md border border-[#3a3a3a] bg-[#1f1f1f] px-4 py-2.5 text-sm font-semibold text-[#d7d7d7] transition hover:border-[#00d9ff]/60 hover:text-[#7fe8ff]"
                    >
                        <Copy size={16} />
                        {copied ? "Replay link copied!" : "Copy replay link"}
                    </button>
                </div>
            </div>
        </div>
    );
}
