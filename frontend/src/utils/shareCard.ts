const MAP_BG = `${import.meta.env.BASE_URL}map-bg.webp`;

export type ShareCardData = {
    title: string;
    name: string;
    accentColor: string;
    points: number;
    provinces: number;
    streak?: number;
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

/** Draws a shareable 4:5 card on a canvas and returns a PNG data URL. */
export async function generateShareCard(data: ShareCardData): Promise<string> {
    const width = 1080;
    const height = 1350;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas not supported");

    // Map background (cover) with a dark grade.
    const img = new Image();
    img.src = MAP_BG;
    await new Promise<void>((resolve) => {
        img.onload = () => resolve();
        img.onerror = () => resolve();
    });
    ctx.fillStyle = "#0a0b0d";
    ctx.fillRect(0, 0, width, height);
    if (img.width > 0) {
        const scale = Math.max(width / img.width, height / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        ctx.drawImage(img, (width - w) / 2, (height - h) / 2, w, h);
    }
    const grade = ctx.createLinearGradient(0, 0, 0, height);
    grade.addColorStop(0, "rgba(8,9,11,0.82)");
    grade.addColorStop(0.5, "rgba(8,9,11,0.55)");
    grade.addColorStop(1, "rgba(8,9,11,0.9)");
    ctx.fillStyle = grade;
    ctx.fillRect(0, 0, width, height);

    // Accent glow behind the title.
    const glow = ctx.createRadialGradient(width / 2, 430, 0, width / 2, 430, 380);
    glow.addColorStop(0, `${data.accentColor}4d`);
    glow.addColorStop(1, "transparent");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);

    // Brand
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffa116";
    ctx.font = "700 44px system-ui, sans-serif";
    ctx.fillText("MapCode", width / 2, 120);

    // Title
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 108px system-ui, sans-serif";
    ctx.fillText(data.title, width / 2, 400);

    // Name
    ctx.fillStyle = data.accentColor;
    ctx.font = "600 60px system-ui, sans-serif";
    ctx.fillText(data.name, width / 2, 500);

    // Stats panel
    const panelY = 640;
    const panelW = 760;
    const panelX = (width - panelW) / 2;
    roundRect(ctx, panelX, panelY, panelW, 340, 28);
    ctx.fillStyle = "rgba(18,19,23,0.92)";
    ctx.fill();
    ctx.strokeStyle = `${data.accentColor}66`;
    ctx.lineWidth = 3;
    ctx.stroke();

    const stats = [
        { label: "Provinces", value: String(data.provinces), color: "#7fe8ff" },
        { label: "Points", value: String(data.points), color: "#ffa116" },
        { label: "Streak", value: data.streak ? `${data.streak}d` : "—", color: "#ff5d73" },
    ];
    const cellW = panelW / stats.length;
    stats.forEach((stat, index) => {
        const cx = panelX + cellW * index + cellW / 2;
        ctx.fillStyle = "#8a8a8a";
        ctx.font = "500 34px system-ui, sans-serif";
        ctx.fillText(stat.label.toUpperCase(), cx, panelY + 90);
        ctx.fillStyle = stat.color;
        ctx.font = "800 84px system-ui, sans-serif";
        ctx.fillText(stat.value, cx, panelY + 210);
    });

    // Footer
    ctx.fillStyle = "#6a6a6a";
    ctx.font = "400 34px system-ui, sans-serif";
    ctx.fillText("solve · capture · keep the streak", width / 2, height - 70);

    return canvas.toDataURL("image/png");
}

/** Triggers a PNG download for the share card. */
export function downloadShareCard(dataUrl: string) {
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = "mapcode-share.png";
    link.click();
}
