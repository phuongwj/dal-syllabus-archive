import { useEffect, useState } from "react";

const API_URL = import.meta.env.PUBLIC_API_URL;

export default function NavAuthStatus() {
    const [authenticated, setAuthenticated] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch(`${API_URL}/api/auth/me`, { credentials: "include" });
                setAuthenticated(res.ok);
            } catch {
                setAuthenticated(false);
            }
        })();
    }, []);

    const handleLogout = async () => {
        setLoading(true);
        try {
            await fetch(`${API_URL}/api/auth/logout`, {
                method: "POST",
                credentials: "include",
            });
        } finally {
            // Full reload so every page's own auth check (Upload, Admin)
            // re-runs against the now-cleared cookie, instead of needing
            // shared cross-component auth state for a small app like this.
            window.location.reload();
        }
    };

    if (!authenticated) return null;

    return (
        <button
            onClick={handleLogout}
            disabled={loading}
            className="text-sm text-neutral-600 hover:underline disabled:opacity-50"
        >
            {loading ? "Logging out…" : "Log out"}
        </button>
    );
}
