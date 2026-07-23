import { useEffect, useState } from "react";

import OtpLogin from "./OtpLogin";

interface PendingSyllabus {
    id: string;
    course_code: string;
    term: string;
    professor: string;
    uploader_email: string;
    created_at: string;
}

const API_URL = import.meta.env.PUBLIC_API_URL;

type Stage = "loading" | "login" | "denied" | "list";

export default function AdminPage() {
    const [stage, setStage] = useState<Stage>("loading");
    const [pending, setPending] = useState<PendingSyllabus[]>([]);
    const [actionError, setActionError] = useState<string | null>(null);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [deniedEmail, setDeniedEmail] = useState<string | null>(null);

    const handleLogout = async () => {
        try {
            await fetch(`${API_URL}/api/auth/logout`, { method: "POST", credentials: "include" });
        } finally {
            // Reload so the page re-checks auth and drops back to the admin login.
            window.location.reload();
        }
    };

    const loadPending = async () => {
        try {
            const res = await fetch(`${API_URL}/api/admin/pending`, { credentials: "include" });
            if (res.status === 401) {
                setStage("login");
                return;
            }
            if (res.status === 403) {
                // Logged in, but not an admin — find out who, so we can tell them to switch.
                try {
                    const me = await fetch(`${API_URL}/api/auth/me`, { credentials: "include" });
                    if (me.ok) setDeniedEmail((await me.json()).email ?? null);
                } catch {
                    /* leave deniedEmail null */
                }
                setStage("denied");
                return;
            }
            if (!res.ok) throw new Error("Could not load pending syllabi");
            setPending(await res.json());
            setStage("list");
        } catch {
            setStage("denied");
        }
    };

    useEffect(() => {
        loadPending();
    }, []);

    const handleDecision = async (id: string, status: "approved" | "rejected") => {
        setActionError(null);
        setBusyId(id);

        try {
            const res = await fetch(`${API_URL}/api/admin/syllabi/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ status }),
            });
            if (!res.ok) throw new Error("Could not update syllabus");
            setPending((prev) => prev.filter((p) => p.id !== id));
        } catch (err) {
            setActionError(err instanceof Error ? err.message : "Something went wrong");
        } finally {
            setBusyId(null);
        }
    };

    const previewPdf = async (id: string) => {
        // Open the tab synchronously (still inside the click handler) so
        // browsers don't treat it as a blocked popup once the signed URL
        // arrives after an async fetch. Deliberately no "noopener" here —
        // that would make window.open return null, and we need the handle
        // to redirect it once the signed URL comes back. Safe in this case
        // since the destination is always our own GCS-hosted PDF.
        const win = window.open("", "_blank");

        try {
            const res = await fetch(`${API_URL}/api/syllabi/${id}/file`, { credentials: "include" });
            if (!res.ok) throw new Error("Could not load file");
            const { url } = await res.json();
            if (win) win.location.href = url;
        } catch (err) {
            win?.close();
            setActionError(err instanceof Error ? err.message : "Could not open preview");
        }
    };

    if (stage === "loading") return <p className="text-neutral-500">Loading…</p>;

    if (stage === "login") {
        return (
            <div>
                <h1 className="text-2xl font-semibold mb-6">Admin Sign In</h1>
                <OtpLogin
                    onVerified={() => loadPending()}
                    emailLabel={null}
                    emailPlaceholder="Enter your email"
                    emailHint={null}
                />
            </div>
        );
    }

    if (stage === "denied") {
        return (
            <div>
                <h1 className="text-2xl font-semibold mb-4">Admin Sign In</h1>
                <p className="mb-4 text-neutral-700">
                    You're signed in
                    {deniedEmail ? (
                        <>
                            {" "}as <strong>{deniedEmail}</strong>
                        </>
                    ) : null}
                    , which isn't an admin account. To access the admin queue, please log out first,
                    then sign in with an admin email.
                </p>
                <button
                    onClick={handleLogout}
                    className="rounded-md bg-neutral-900 px-5 py-2 text-base text-white hover:bg-neutral-700"
                >
                    Log out
                </button>
            </div>
        );
    }

    return (
        <div>
            <h1 className="text-2xl font-semibold mb-6">Admin Review Queue</h1>

            {actionError && <p className="mb-4 text-sm text-red-600">{actionError}</p>}

            {pending.length === 0 ? (
                <p className="text-neutral-500">No syllabi are pending review.</p>
            ) : (
                <ul className="divide-y divide-neutral-200">
                    {pending.map((p) => (
                        <li key={p.id} className="flex items-center justify-between gap-4 py-4">
                            <div>
                                <p className="font-semibold">
                                    {p.course_code} — {p.term}
                                </p>
                                <p className="text-sm text-neutral-600">{p.professor}</p>
                                <p className="text-sm text-neutral-400">
                                    {p.uploader_email} · uploaded {new Date(p.created_at).toLocaleDateString()}
                                </p>
                            </div>
                            <div className="flex shrink-0 gap-2">
                                <button
                                    onClick={() => previewPdf(p.id)}
                                    className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50"
                                >
                                    Preview PDF
                                </button>
                                <button
                                    onClick={() => handleDecision(p.id, "approved")}
                                    disabled={busyId === p.id}
                                    className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm text-white hover:bg-neutral-700 disabled:opacity-50"
                                >
                                    Approve
                                </button>
                                <button
                                    onClick={() => handleDecision(p.id, "rejected")}
                                    disabled={busyId === p.id}
                                    className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                                >
                                    Reject
                                </button>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
