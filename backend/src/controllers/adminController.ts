import { Response } from "express";

import pool from "../db.js";
import { AuthRequest } from "../middleware/auth.js";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_STATUSES = ["approved", "rejected"];

export const getPendingSyllabi = async (req: AuthRequest, res: Response) => {
    const query = `
        SELECT id, course_code, term, professor, uploader_email, created_at
        FROM syllabi
        WHERE status = 'pending'
        ORDER BY created_at ASC
    `;

    try {
        const result = await pool.query(query);
        res.status(200).json(result.rows);
    } catch (error) {
        res.status(500).json({ error: "Error fetching pending syllabi" });
    }
};

export const updateSyllabusStatus = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { status } = req.body;

    if (typeof id !== "string" || !UUID_REGEX.test(id)) {
        return res.status(400).json({ error: "Invalid syllabus id" });
    }

    if (!VALID_STATUSES.includes(status)) {
        return res.status(400).json({ error: "status must be 'approved' or 'rejected'" });
    }

    const query = `
        UPDATE syllabi
        SET status = $1, updated_at = now()
        WHERE id = $2
        RETURNING id, course_code, term, professor, status
    `;

    try {
        const result = await pool.query(query, [status, id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Syllabus not found" });
        }

        res.status(200).json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: "Error updating syllabus status" });
    }
};
