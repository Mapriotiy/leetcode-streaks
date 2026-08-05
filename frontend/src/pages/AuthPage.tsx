import { useState } from "react";
import { AuthV1 } from "./auth/AuthV1";
import { AuthV2 } from "./auth/AuthV2";
import { AuthV3 } from "./auth/AuthV3";
import { useGoogleLogin } from "./auth/useGoogleLogin";

type AuthPageProps = {
    initialError?: string | null;
    onClearError?: () => void;
};

type VariantId = "v1" | "v2" | "v3";

function initialVariant(): VariantId {
    try {
        const value = new URLSearchParams(window.location.search).get("auth");
        if (value === "v1" || value === "v2" || value === "v3") return value;
    } catch {
        /* ignore */
    }
    return "v2";
}

export function AuthPage({ initialError = null, onClearError }: AuthPageProps) {
    const [variant, setVariant] = useState<VariantId>(initialVariant);
    const formProps = useGoogleLogin(initialError, onClearError);

    const showSwitcher = (() => {
        try {
            return new URLSearchParams(window.location.search).get("authPreview") === "1";
        } catch {
            return false;
        }
    })();

    return (
        <>
            {variant === "v1" ? (
                <AuthV1 {...formProps} />
            ) : variant === "v3" ? (
                <AuthV3 {...formProps} />
            ) : (
                <AuthV2 {...formProps} />
            )}

            {showSwitcher ? (
                <div className="fixed bottom-4 left-1/2 z-[100] flex -translate-x-1/2 items-center gap-1 rounded-full border border-white/10 bg-[#1a1b1e]/90 px-2 py-1.5 shadow-2xl backdrop-blur">
                    {(["v1", "v2", "v3"] as const).map((id) => (
                        <button
                            key={id}
                            type="button"
                            onClick={() => setVariant(id)}
                            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                                variant === id
                                    ? "bg-[#ffa116] text-[#111]"
                                    : "text-[#8a8a8a] hover:text-white"
                            }`}
                        >
                            Variant {id.toUpperCase()}
                        </button>
                    ))}
                </div>
            ) : null}
        </>
    );
}
