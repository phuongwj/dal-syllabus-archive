import { useEffect, useState } from "react";

interface SyllabusMeta {
    id: string;
    course_code: string;
    course_name: string | null;
    term: string;
    professor: string;
    uploader_email: string;
    status: string;
    created_at: string;
}

const API_URL = import.meta.env.PUBLIC_API_URL;

function getIdFromQuery(): string | null {
    return new URLSearchParams(window.location.search).get("id");
}

export default function ViewSyllabusPage() {
    const [meta, setMeta] = useState<SyllabusMeta | null>(null);
    const [fileUrl, setFileUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const id = getIdFromQuery();
        if (!id) {
            setError("No syllabus specified.");
            setLoading(false);
            return;
        }

        (async () => {
            try {
                const [metaRes, fileRes] = await Promise.all([
                    fetch(`${API_URL}/api/syllabi/${id}`),
                    fetch(`${API_URL}/api/syllabi/${id}/file`),
                ]);

                if (!metaRes.ok) throw new Error("Syllabus not found");
                if (!fileRes.ok) throw new Error("Could not load file");

                setMeta(await metaRes.json());
                setFileUrl((await fileRes.json()).url);
            } catch (err) {
                setError("Syllabus not found.");
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    if (loading) return <p className="text-neutral-500">Loading…</p>;
    if (error || !meta) return <p className="text-neutral-500">{error || "Syllabus not found."}</p>;

    return (
        <div>
            <a href="/" className="text-sm text-neutral-500 hover:underline">
                ← Back to search
            </a>

            <h1 className="text-2xl font-semibold mt-4">{meta.course_code}</h1>
            {meta.course_name && <p className="text-neutral-600">{meta.course_name}</p>}

            <dl className="mt-4 text-sm text-neutral-700 space-y-1">
                <div>
                    <span className="font-medium">Term:</span> {meta.term}
                </div>
                <div>
                    <span className="font-medium">Professor:</span> {meta.professor}
                </div>
                <div>
                    <span className="font-medium">Uploaded:</span>{" "}
                    {new Date(meta.created_at).toLocaleDateString()}
                </div>
            </dl>

            {fileUrl && (
                <a
                    href={fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 inline-block text-sm text-blue-600 hover:underline"
                >
                    Download
                </a>
            )}

            {fileUrl && (
                <iframe
                    src={fileUrl}
                    title="Syllabus PDF"
                    className="mt-6 w-full h-[80vh] rounded-md border border-neutral-200"
                />
            )}
        </div>
    );
}
