import { useState } from "react";
import type { SubmitEvent } from "react";

interface SyllabusResult {
    id: string;
    course_code: string;
    course_name: string | null;
    term: string;
    professor: string;
    created_at: string;
}

const API_URL = import.meta.env.PUBLIC_API_URL;

export default function SearchPage() {
    const [course, setCourse] = useState("");
    const [results, setResults] = useState<SyllabusResult[] | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSearch = async (e: SubmitEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!course.trim()) return;

        setLoading(true);
        setError(null);

        try {
            const res = await fetch(`${API_URL}/api/syllabi?course=${encodeURIComponent(course)}`);
            if (!res.ok) throw new Error("Search failed");
            const data = await res.json();
            setResults(data);
        } catch (err) {
            setError("Something went wrong. Please try again.");
            setResults(null);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div>
            <h1 className="text-2xl font-semibold mb-6">Dal Syllabus Archive</h1>

            <form onSubmit={handleSearch} className="flex gap-2">
                <input
                    type="text"
                    value={course}
                    onChange={(e) => setCourse(e.target.value)}
                    placeholder="Search by course code, e.g. CSCI 3171"
                    autoFocus
                    className="flex-1 rounded-md border border-neutral-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-neutral-400"
                />
                <button
                    type="submit"
                    className="rounded-md bg-neutral-900 px-5 py-2 text-base text-white hover:bg-neutral-700"
                >
                    Search
                </button>
            </form>

            <div className="mt-8">
                {loading && <p className="text-neutral-500">Searching…</p>}
                {error && <p className="text-red-600">{error}</p>}

                {results !== null && !loading && (
                    results.length === 0 ? (
                        <p className="text-neutral-500">No syllabi found for this course.</p>
                    ) : (
                        <ul className="divide-y divide-neutral-200">
                            {results.map((r) => (
                                <li key={r.id} className="py-3">
                                    <a href={`/syllabi/?id=${r.id}`} className="hover:underline">
                                        <span className="font-semibold">
                                            {r.course_code}, {r.term}
                                        </span>{" "}
                                        — {r.professor}
                                        <span className="ml-2 text-neutral-400">
                                            uploaded {new Date(r.created_at).toLocaleDateString()}
                                        </span>
                                    </a>
                                </li>
                            ))}
                        </ul>
                    )
                )}
            </div>
        </div>
    );
}
