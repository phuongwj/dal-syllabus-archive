import { useState } from "react";
import type { SubmitEvent } from "react";

const API_URL = import.meta.env.PUBLIC_API_URL;
const inputClass =
    "w-full rounded-md border border-neutral-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-neutral-400";
const buttonClass =
    "rounded-md bg-neutral-900 px-5 py-2 text-base text-white hover:bg-neutral-700 disabled:opacity-50";

interface OtpLoginProps {
    onVerified: (email: string) => void;
    emailLabel?: string | null;
    emailPlaceholder?: string;
    emailHint?: string | null;
}

export default function OtpLogin({
    onVerified,
    emailLabel = "Dalhousie NetID email",
    emailPlaceholder = "ab123456@dal.ca",
    emailHint = "Use your NetID email (two letters + six digits), e.g. ab123456@dal.ca — not your name alias.",
}: OtpLoginProps) {
    const [stage, setStage] = useState<"email" | "code">("email");
    const [email, setEmail] = useState("");
    const [code, setCode] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handleSendCode = async (e: SubmitEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            const res = await fetch(`${API_URL}/api/auth/otp`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || "Could not send code");
            }
            setStage("code");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Something went wrong");
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyCode = async (e: SubmitEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError(null);
        setLoading(true);
 
        try {
            const res = await fetch(`${API_URL}/api/auth/verify`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ email, code }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || "Invalid code");
            }
            onVerified(email);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Something went wrong");
        } finally {
            setLoading(false);
        }
    };

    if (stage === "email") {
        return (
            <form onSubmit={handleSendCode} className="space-y-3">
                {emailLabel && <label className="block text-sm font-medium">{emailLabel}</label>}
                <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={emailPlaceholder}
                    required
                    className={inputClass}
                />
                {emailHint && <p className="text-xs text-neutral-500">{emailHint}</p>}
                <button type="submit" disabled={loading} className={buttonClass}>
                    {loading ? "Sending…" : "Send Code"}
                </button>
                {error && <p className="text-sm text-red-600">{error}</p>}
            </form>
        );
    }

    return (
        <form onSubmit={handleVerifyCode} className="space-y-3">
            <p className="text-sm text-neutral-600">
                We sent a 6-digit code to <strong>{email}</strong>.
            </p>
            <input
                type="text"
                inputMode="numeric"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="123456"
                required
                maxLength={6}
                className={inputClass}
            />
            <button type="submit" disabled={loading} className={buttonClass}>
                {loading ? "Verifying…" : "Verify Code"}
            </button>
            {error && <p className="text-sm text-red-600">{error}</p>}
        </form>
    );
}
