// Mirror of backend/app/services/scoring.py point values.
export const FLAG_POINTS: Record<string, number> = {
    Easy: 100,
    Medium: 250,
    Hard: 500,
};

export const DEFAULT_FLAG_POINTS = 100;

export function flagPoints(difficulty: string | null | undefined): number {
    if (!difficulty) return DEFAULT_FLAG_POINTS;
    return FLAG_POINTS[difficulty] ?? DEFAULT_FLAG_POINTS;
}

export function firstCaptureBonus(difficulty: string | null | undefined): number {
    return Math.floor(flagPoints(difficulty) / 2);
}
