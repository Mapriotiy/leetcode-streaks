import { mapSvgString } from "../mapSvgString";

const MAP_BG = `${import.meta.env.BASE_URL}map-bg.webp`;
const LEET_MAP_BG = `${import.meta.env.BASE_URL}leet_map.webp`;
const MAP_ASPECT = 1321 / 900;

export type ShareCardData = {
    title: string;
    name: string;
    accentColor: string;
    points: number;
    provinces: number;
    mapKind?: "default" | "generated";
    capturedColors?: Record<string, string>;
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
    const mapHeight = Math.round(width / MAP_ASPECT);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas not supported");

    // Base dark fill.
    ctx.fillStyle = "#0a0b0d";
    ctx.fillRect(0, 0, width, height);

    // Real map with captures (default map: leet_map base + colored provinces).
    if (data.mapKind === "default" && data.capturedColors && Object.keys(data.capturedColors).length > 0) {
        const base = await loadImage(LEET_MAP_BG);
        if (base.width) ctx.drawImage(base, 0, 0, width, mapHeight);
        const svgText = buildColoredMapSvg(data.capturedColors);
        if (svgText) {
            const url = URL.createObjectURL(new Blob([svgText], { type: "image/svg+xml" }));
            const overlay = await loadImage(url);
            if (overlay.width) ctx.drawImage(overlay, 0, 0, width, mapHeight);
            URL.revokeObjectURL(url);
        }
    } else {
        const img = await loadImage(MAP_BG);
        if (img.width > 0) {
            const scale = Math.max(width / img.width, mapHeight / img.height);
            const w = img.width * scale;
            const h = img.height * scale;
            ctx.drawImage(img, (width - w) / 2, (mapHeight - h) / 2, w, h);
        }
    }

    // Darken the map and fade into the content area.
    const topGrade = ctx.createLinearGradient(0, 0, 0, mapHeight);
    topGrade.addColorStop(0, "rgba(8,9,11,0.35)");
    topGrade.addColorStop(1, "rgba(8,9,11,0.92)");
    ctx.fillStyle = topGrade;
    ctx.fillRect(0, 0, width, mapHeight);
    const bottomGrade = ctx.createLinearGradient(0, mapHeight - 60, 0, height);
    bottomGrade.addColorStop(0, "#0a0b0d");
    bottomGrade.addColorStop(1, "#0a0b0d");
    ctx.fillStyle = bottomGrade;
    ctx.fillRect(0, mapHeight - 60, width, height - mapHeight + 60);

    // Accent glow behind the title.
    const glow = ctx.createRadialGradient(width / 2, 930, 0, width / 2, 930, 360);
    glow.addColorStop(0, `${data.accentColor}40`);
    glow.addColorStop(1, "transparent");
    ctx.fillStyle = glow;
    ctx.fillRect(0, mapHeight, width, height - mapHeight);

    // Brand
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffa116";
    ctx.font = "700 44px system-ui, sans-serif";
    ctx.fillText("MapCode", width / 2, 104);

    // Title + name
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 104px system-ui, sans-serif";
    ctx.fillText(data.title, width / 2, mapHeight + 150);
    ctx.fillStyle = data.accentColor;
    ctx.font = "600 56px system-ui, sans-serif";
    ctx.fillText(data.name, width / 2, mapHeight + 236);

    // Stats panel
    const panelY = mapHeight + 330;
    const panelW = 760;
    const panelX = (width - panelW) / 2;
    roundRect(ctx, panelX, panelY, panelW, 260, 28);
    ctx.fillStyle = "rgba(18,19,23,0.92)";
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
        ctx.fillText(stat.label.toUpperCase(), cx, panelY + 80);
        ctx.fillStyle = stat.color;
        ctx.font = "800 82px system-ui, sans-serif";
        ctx.fillText(stat.value, cx, panelY + 190);
    });

    // Footer
    ctx.fillStyle = "#6a6a6a";
    ctx.font = "400 32px system-ui, sans-serif";
    ctx.fillText("solve · capture · keep the streak", width / 2, height - 70);

    return canvas.toDataURL("image/png");
}
