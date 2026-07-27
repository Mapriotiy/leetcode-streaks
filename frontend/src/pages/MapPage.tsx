import { useState, useCallback } from 'react';
import { ArrowLeft } from 'lucide-react';
import ProvinceMap from '../components/ProvinceMap';
import ProvincePopup, { type Owner } from '../components/ProvincePopup';

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
    const [captured, setCaptured] = useState<Map<string, Owner>>(new Map());
    const [selectedProvince, setSelectedProvince] = useState<string | null>(null);
    const [popPos, setPopPos] = useState<{ x: number; y: number } | null>(null);

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

                <section className="mt-6 rounded-lg border border-[#3a3a3a] bg-[#262626] p-6 shadow-xl shadow-black/20">
                    <div className="mx-auto w-fit">
                        <ProvinceMap captured={captured} onSelect={handleSelect} />
                    </div>
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