export type Region = {
    id: string;
    color: string;
    name: string;
    provinces: string[];
};

// Topics offered when creating a generated map. The default map is itself a
// generated draft (see DEFAULT_MAP_DRAFT) whose regions reuse these ids, so
// there is no separate static REGIONS table anymore.
export const TOPICS: Region[] = [
    { id: 'isle1', color: '#00d9ff', name: 'Trees', provinces: [] },
    { id: 'isle2', color: '#7c4dff', name: 'Binary Search', provinces: [] },
    { id: 'isle3', color: '#a3005e', name: 'Math', provinces: [] },
    { id: 'region1', color: '#2bff88', name: 'Linked List', provinces: [] },
    { id: 'region2', color: '#2979ff', name: 'Two Pointers', provinces: [] },
    { id: 'region3', color: '#ff9100', name: 'Arrays & Hashing', provinces: [] },
    { id: 'region4', color: '#ff2d95', name: 'Stack', provinces: [] },
    { id: 'region5', color: '#ff00d4', name: 'Dynamic Programming', provinces: [] },
    { id: 'region6', color: '#00ffc8', name: 'String', provinces: [] },
    { id: 'region7', color: '#ffd60a', name: 'Sorting', provinces: [] },
];

export const DIFFICULTY_COLORS: Record<string, string> = {
    Easy: '#00b8a3',
    Medium: '#ffc01e',
    Hard: '#ff375f',
};
