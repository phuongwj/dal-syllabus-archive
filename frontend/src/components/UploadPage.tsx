import { useEffect, useRef, useState } from "react";
import type { SubmitEvent } from "react";

import OtpLogin from "./OtpLogin";

const API_URL = import.meta.env.PUBLIC_API_URL;

function generateTermOptions(): string[] {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let y = currentYear - 3; y <= currentYear + 1; y++) {
        years.push(y);
    }
    const seasons = ["Fall", "Winter", "Summer"];
    return years.flatMap((y) => seasons.map((s) => `${s} ${y}`));
}

const TERM_OPTIONS = generateTermOptions();
const inputClass =
    "w-full rounded-md border border-neutral-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-neutral-400";
const buttonClass =
    "rounded-md bg-neutral-900 px-5 py-2 text-base text-white hover:bg-neutral-700 disabled:opacity-50";

type AuthStage = "checking" | "loggedOut" | "authenticated";

export default function UploadPage() {
    const [stage, setStage] = useState<AuthStage>("checking");

    const [courseCode, setCourseCode] = useState("");
    const [courseName, setCourseName] = useState("");
    const [term, setTerm] = useState(TERM_OPTIONS[0]);
    const [professor, setProfessor] = useState("");
    const [file, setFile] = useState<File | null>(null);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [uploadLoading, setUploadLoading] = useState(false);
    const [uploadSuccess, setUploadSuccess] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Resetting the input's value lets the user pick the *same* file again after
    // removing it (otherwise the browser skips the change event for an identical file).
    const clearFile = () => {
        setFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch(`${API_URL}/api/auth/me`, { credentials: "include" });
                setStage(res.ok ? "authenticated" : "loggedOut");
            } catch {
                setStage("loggedOut");
            }
        })();
    }, []);

    const handleUpload = async (e: SubmitEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!file) {
            setUploadError("Please choose a PDF file.");
            return;
        }

        setUploadError(null);
        setUploadLoading(true);

        const formData = new FormData();
        formData.append("course_code", courseCode);
        formData.append("course_name", courseName);
        formData.append("term", term);
        formData.append("professor", professor);
        formData.append("pdf", file);

        try {
            const res = await fetch(`${API_URL}/api/syllabi`, {
                method: "POST",
                credentials: "include",
                body: formData,
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || "Upload failed");
            }
            setUploadSuccess(true);
        } catch (err) {
            setUploadError(err instanceof Error ? err.message : "Something went wrong");
        } finally {
            setUploadLoading(false);
        }
    };

    const resetUploadForm = () => {
        setCourseCode("");
        setCourseName("");
        setTerm(TERM_OPTIONS[0]);
        setProfessor("");
        clearFile();
        setUploadSuccess(false);
        setUploadError(null);
    };

    if (stage === "checking") {
        return <p className="text-neutral-500">Loading…</p>;
    }

    if (stage === "loggedOut") {
        return (
            <div>
                <h1 className="text-2xl font-semibold mb-2">Upload a Syllabus</h1>
                <p className="mb-6 text-sm text-neutral-600">
                    Only Dalhousie students can upload syllabi. Sign in with your Dalhousie NetID
                    email to continue.
                </p>
                <OtpLogin onVerified={() => setStage("authenticated")} />
            </div>
        );
    }

    if (uploadSuccess) {
        return (
            <div>
                <h1 className="text-2xl font-semibold mb-4">Upload a Syllabus</h1>
                <p className="text-neutral-700">
                    Thanks! Your syllabus will be reviewed by an admin before it goes live.
                </p>
                <button onClick={resetUploadForm} className="mt-4 text-sm text-blue-600 hover:underline">
                    Upload another syllabus
                </button>
            </div>
        );
    }

    return (
        <div>
            <h1 className="text-2xl font-semibold mb-6">Upload a Syllabus</h1>
            <form onSubmit={handleUpload} className="space-y-4">
                <div>
                    <label className="mb-1 block text-sm font-medium">
                        Course code <span className="text-red-600">*</span>
                    </label>
                    <input
                        type="text"
                        value={courseCode}
                        onChange={(e) => setCourseCode(e.target.value)}
                        placeholder="CSCI 3171"
                        required
                        className={inputClass}
                    />
                </div>

                <div>
                    <label className="mb-1 block text-sm font-medium">
                        Course name <span className="text-red-600">*</span>
                    </label>
                    <input
                        type="text"
                        value={courseName}
                        onChange={(e) => setCourseName(e.target.value)}
                        placeholder="Algorithms and Data Structures"
                        required
                        className={inputClass}
                    />
                </div>

                <div>
                    <label className="mb-1 block text-sm font-medium">
                        Term <span className="text-red-600">*</span>
                    </label>
                    <select value={term} onChange={(e) => setTerm(e.target.value)} className={inputClass}>
                        {TERM_OPTIONS.map((t) => (
                            <option key={t} value={t}>
                                {t}
                            </option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="mb-1 block text-sm font-medium">
                        Professor <span className="text-red-600">*</span>
                    </label>
                    <input
                        type="text"
                        value={professor}
                        onChange={(e) => setProfessor(e.target.value)}
                        placeholder="Dr. Smith"
                        required
                        className={inputClass}
                    />
                </div>

                <div>
                    <label className="mb-1 block text-sm font-medium">
                        Syllabus PDF <span className="text-red-600">*</span>
                    </label>

                    {/* Hidden native input; we drive it with our own buttons so the
                        user can replace or remove the chosen file. */}
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="application/pdf"
                        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                        className="hidden"
                    />

                    {file ? (
                        <div className="flex items-center justify-between gap-3 rounded-md border border-neutral-300 px-3 py-2">
                            <span className="truncate text-sm">
                                {file.name}{" "}
                                <span className="text-neutral-400">
                                    ({(file.size / 1024 / 1024).toFixed(1)} MB)
                                </span>
                            </span>
                            <div className="flex shrink-0 gap-3 text-sm">
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="text-blue-600 hover:underline"
                                >
                                    Replace
                                </button>
                                <button
                                    type="button"
                                    onClick={clearFile}
                                    className="text-red-600 hover:underline"
                                >
                                    Remove
                                </button>
                            </div>
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="rounded-md border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-50"
                        >
                            Choose PDF
                        </button>
                    )}
                </div>

                {uploadError && <p className="text-sm text-red-600">{uploadError}</p>}

                <button type="submit" disabled={uploadLoading} className={buttonClass}>
                    {uploadLoading ? "Uploading…" : "Upload"}
                </button>
            </form>
        </div>
    );
}
