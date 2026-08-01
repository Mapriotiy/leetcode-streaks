export type Region = {
    id: string;
    color: string;
    name: string;
    provinces: string[];
};

export const REGIONS: Region[] = [
    { id: 'isle1', color: '#00d9ff', name: 'Trees & DFS', provinces: ['path34', 'path36'] },
    { id: 'isle2', color: '#7c4dff', name: 'Binary Search', provinces: ['path44', 'path48', 'path49'] },
    { id: 'isle3', color: '#a3005e', name: 'Math', provinces: ['path53'] },
    { id: 'region1', color: '#2bff88', name: 'Linked List', provinces: ['path56', 'path57', 'path58', 'path60'] },
    { id: 'region2', color: '#2979ff', name: 'Two Pointers', provinces: ['path63', 'path64', 'path65', 'path68', 'path69'] },
    { id: 'region3', color: '#ff9100', name: 'Arrays & Hashing', provinces: ['path72', 'path73', 'path75', 'path76', 'path79', 'path80'] },
    { id: 'region4', color: '#ff2d95', name: 'Stack', provinces: ['path83', 'path86', 'path89', 'path91'] },
    { id: 'region5', color: '#ff00d4', name: 'Dynamic Programming', provinces: ['path66', 'path74', 'path87'] },
];

export const PROVINCE_NAMES: Record<string, string> = {
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

export const DIFFICULTY_COLORS: Record<string, string> = {
    Easy: '#00b8a3',
    Medium: '#ffc01e',
    Hard: '#ff375f',
};
