import { AuthV3 } from "./auth/AuthV3";
import { useGoogleLogin } from "./auth/useGoogleLogin";

type AuthPageProps = {
    initialError?: string | null;
    onClearError?: () => void;
};

export function AuthPage({ initialError = null, onClearError }: AuthPageProps) {
    const formProps = useGoogleLogin(initialError, onClearError);
    return <AuthV3 {...formProps} />;
}
