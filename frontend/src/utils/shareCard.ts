import { mapSvgString } from "../mapSvgString";

const MAP_BG = `${import.meta.env.BASE_URL}map-bg.webp`;
const LEET_MAP_BG = `${import.meta.env.BASE_URL}leet_map.webp`;

export type ShareCardData = {
    title: string;
    name: string;
    accentColor: string;
    points: number;
    provinces: number;
    mapKind?: "default" | "generated";
    capturedColors?: Record<string, string>;
    /** Optional pre-rendered map (actual lobby map with captures). */
    mapBackground?: HTMLCanvasElement | HTMLImageElement | string;
    /** Generated map draft (for the live capture). */
    draft?: unknown;
};

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(img);
        img.src = src;
    });
}

/** Recolors the default map's provinces with the final owner colors. */
function buildColoredMapSvg(colors: Record<string, string>): string | null {
    try {
        const doc = new DOMParser().parseFromString(mapSvgString, "image/svg+xml");
        const svg = doc.querySelector("svg");
        if (!svg) return null;
        svg.setAttribute("width", "1321");
        svg.setAttribute("height", "900");
        svg.querySelectorAll("path.prov").forEach((path) => {
            const color = colors[path.id];
            if (!color) return;
            path.setAttribute("fill", color);
            path.setAttribute("fill-opacity", "0.5");
            path.setAttribute("stroke", color);
            path.setAttribute("stroke-opacity", "0.9");
            path.setAttribute("stroke-width", "2.5");
        });
        return new XMLSerializer().serializeToString(svg);
    } catch {
        return null;
    }
}

/** Draws the actual lobby map (with captures) on a shareable 4:5 card. */
export async function generateShareCard(data: ShareCardData): Promise<string> {
    const width = 1080;
    const height = 1350;
    const mapBandH = 520;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas not supported");

    // Base dark fill.
    ctx.fillStyle = "#0a0b0d";
    ctx.fillRect(0, 0, width, height);

    const drawMapImage = (img: HTMLImageElement, dw: number, dh: number) => {
        const scale = Math.max(dw / img.width, dh / img.height);
        const sw = img.width * scale;
        const sh = img.height * scale;
        ctx.drawImage(img, (dw - sw) / 2, (dh - sh) / 2, sw, sh);
    };

    // Real lobby map (captured DOM) or fallbacks.
    if (data.mapBackground) {
        const src = data.mapBackground;
        const img = typeof src === "string" ? await loadImage(src) : src;
        if (img) drawMapImage(img as HTMLImageElement, width, mapBandH);
    } else if (data.mapKind === "default" && data.capturedColors && Object.keys(data.capturedColors).length > 0) {
        const base = await loadImage(LEET_MAP_BG);
        if (base.width) drawMapImage(base, width, mapBandH);
        const svgText = buildColoredMapSvg(data.capturedColors);
        if (svgText) {
            const url = URL.createObjectURL(new Blob([svgText], { type: "image/svg+xml" }));
            const overlay = await loadImage(url);
            if (overlay.width) drawMapImage(overlay, width, mapBandH);
            URL.revokeObjectURL(url);
        }
    } else {
        const img = await loadImage(MAP_BG);
        if (img.width > 0) drawMapImage(img, width, mapBandH);
    }

    // Darken the map band and fade into the content area.
    const bandGrade = ctx.createLinearGradient(0, 0, 0, mapBandH);
    bandGrade.addColorStop(0, "rgba(8,9,11,0.4)");
    bandGrade.addColorStop(1, "rgba(8,9,11,0.95)");
    ctx.fillStyle = bandGrade;
    ctx.fillRect(0, 0, width, mapBandH);

    // Accent glow behind the title.
    const glow = ctx.createRadialGradient(width / 2, 820, 0, width / 2, 820, 340);
    glow.addColorStop(0, `${data.accentColor}3a`);
    glow.addColorStop(1, "transparent");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);

    // Brand
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffa116";
    ctx.font = "700 42px system-ui, sans-serif";
    ctx.fillText("MapCode", width / 2, 92);

    // Title + name
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 100px system-ui, sans-serif";
    ctx.fillText(data.title, width / 2, 680);
    ctx.fillStyle = data.accentColor;
    ctx.font = "600 54px system-ui, sans-serif";
    ctx.fillText(data.name, width / 2, 762);

    // Stats panel
    const panelY = 860;
    const panelW = 760;
    const panelX = (width - panelW) / 2;
    roundRect(ctx, panelX, panelY, panelW, 280, 28);
    ctx.fillStyle = "rgba(18,19,23,0.94)";
    ctx.fill();
    ctx.strokeStyle = `${data.accentColor}66`;
    ctx.lineWidth = 3;
    ctx.stroke();

    const stats = [
        { label: "Provinces", value: String(data.provinces), color: "#7fe8ff" },
        { label: "Points", value: String(data.points), color: "#ffa116" },
    ];
    const cellW = panelW / stats.length;
    stats.forEach((stat, index) => {
        const cx = panelX + cellW * index + cellW / 2;
        ctx.fillStyle = "#8a8a8a";
        ctx.font = "500 32px system-ui, sans-serif";
        ctx.fillText(stat.label.toUpperCase(), cx, panelY + 90);
        ctx.fillStyle = stat.color;
        ctx.font = "800 84px system-ui, sans-serif";
        ctx.fillText(stat.value, cx, panelY + 200);
    });

    // Footer
    ctx.fillStyle = "#6a6a6a";
    ctx.font = "400 32px system-ui, sans-serif";
    ctx.fillText("solve · capture · keep the streak", width / 2, height - 60);

    return canvas.toDataURL("image/png");
}
