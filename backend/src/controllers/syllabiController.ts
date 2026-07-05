import { Request, Response } from "express";
import { randomUUID } from "crypto";

import pool from "../db.js";
import bucket from "../gcs.js";
import { AuthRequest } from "../middleware/auth.js";

// rejects malformed :id params before they hit the DB
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// real PDFs start with these bytes — Content-Type header can be faked, this can't
const PDF_MAGIC_BYTES = Buffer.from("%PDF-");

// 10MB upload cap
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Term must look like "Fall 2025" — a valid season, with a year that isn't
// absurdly far in the past or future.
function isValidTerm(term: string): boolean {
    const match = term.match(/^(Fall|Winter|Summer) (\d{4})$/);
    if (!match) return false;

    const year = parseInt(match[2], 10);
    const currentYear = new Date().getFullYear();
    return year >= 2000 && year <= currentYear + 1;
}

export const getSyllabi = async (req: Request, res: Response) => {
    const course = req.query.course;

    if (!course || typeof course !== "string") {
        return res.status(400).json({ error: "course query parameter is required" });
    }

    const query = `
        SELECT id, course_code, course_name, term, professor, created_at
        FROM syllabi
        WHERE status = 'approved' AND REPLACE(course_code, ' ', '') ILIKE $1
        ORDER BY created_at DESC
    `;

    try {
        const normalizedCourse = course.replace(/\s+/g, "");
        const result = await pool.query(query, [`%${normalizedCourse}%`]);
        res.status(200).json(result.rows);
    } catch (error) {
        res.status(500).json({ error: "Error fetching syllabi" });
    }
};

export const getSyllabusById = async (req: Request, res: Response) => {
    const { id } = req.params;

    if (typeof id !== "string" || !UUID_REGEX.test(id)) {
        return res.status(400).json({ error: "Invalid syllabus id" });
    }

    const query = `
        SELECT id, course_code, course_name, term, professor, uploader_email, status, created_at
        FROM syllabi
        WHERE id = $1
    `;

    try {
        const result = await pool.query(query, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Syllabus not found" });
        }

        res.status(200).json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: "Error fetching syllabus" });
    }
};

export const getSyllabusFile = async (req: Request, res: Response) => {
    const { id } = req.params;

    if (typeof id !== "string" || !UUID_REGEX.test(id)) {
        return res.status(400).json({ error: "Invalid syllabus id" });
    }

    const query = `SELECT file_key FROM syllabi WHERE id = $1`;

    try {
        const result = await pool.query(query, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Syllabus not found" });
        }

        const { file_key } = result.rows[0];
        
        const [url] = await bucket.file(file_key).getSignedUrl({
            action: "read",
            expires: Date.now() + 15 * 60 * 1000,
        });

        res.status(200).json({ url });
    } catch (error) {
        res.status(500).json({ error: "Error generating file URL" });
    }
};

export const createSyllabus = async (req: AuthRequest, res: Response) => {
    const { course_code, course_name, term, professor } = req.body;
    const file = req.file;
    const uploaderEmail = req.user?.email;

    if (!uploaderEmail) {
        return res.status(401).json({ error: "Not authenticated" });
    }

    if (!course_code || !term || !professor) {
        return res.status(400).json({ error: "course_code, term, and professor are required" });
    }

    if (!isValidTerm(term)) {
        return res.status(400).json({ error: "term must be like 'Fall 2025', 'Winter 2026', or 'Summer 2026'" });
    }

    if (!file) {
        return res.status(400).json({ error: "A PDF file is required" });
    }

    if (file.size > MAX_FILE_SIZE) {
        return res.status(400).json({ error: "File exceeds the 10MB limit" });
    }

    if (!file.buffer.subarray(0, 5).equals(PDF_MAGIC_BYTES)) {
        return res.status(400).json({ error: "File is not a valid PDF" });
    }

    const fileKey = `syllabi/${randomUUID()}.pdf`;

    try {
        await bucket.file(fileKey).save(file.buffer, { contentType: "application/pdf", resumable: false });
    } catch (error) {
        return res.status(500).json({ error: "Error uploading file" });
    }

    const insertQuery = `
        INSERT INTO syllabi (course_code, course_name, term, professor, file_key, uploader_email, status)
        VALUES ($1, $2, $3, $4, $5, $6, 'pending')
        RETURNING id, course_code, term, professor, status
    `;

    try {
        const result = await pool.query(insertQuery, [
            course_code,
            course_name || null,
            term,
            professor,
            fileKey,
            uploaderEmail,
        ]);

        res.status(201).json(result.rows[0]);
    } catch (error: any) {
        await bucket.file(fileKey).delete().catch(() => {});

        if (error.code === "23505") {
            return res.status(409).json({ error: "You've already uploaded a syllabus for this course, term, and professor" });
        }

        res.status(500).json({ error: "Error saving syllabus" });
    }
};
