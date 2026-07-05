import { Request, Response } from "express";
import { Resend } from "resend";

import pool from "../db.js";
import { signToken, AuthRequest } from "../middleware/auth.js";

const resend = new Resend(process.env.RESEND_API_KEY);

function generateCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

export const sendOtp = async (req: Request, res: Response) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ error: "Email is required" });
    }

    // Dal's mail server is quarantining our OTP emails, so we're testing with
    // non-@dal.ca inboxes for now. Turn off before deploying.
    const skipDomainCheck = process.env.SKIP_EMAIL_DOMAIN_CHECK === "true";
    if (!skipDomainCheck && !email.toLowerCase().endsWith("@dal.ca")) {
        return res.status(400).json({ error: "A valid @dal.ca email is required" });
    }

    const code = generateCode(); // 6-digit code to email to the student
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // valid for 15 minutes

    const insertQuery = `
        INSERT INTO otp_codes (email, code, expires_at)
        VALUES ($1, $2, $3)
    `;

    try {
        await pool.query(insertQuery, [email, code, expiresAt]);

        await resend.emails.send({
            from: process.env.RESEND_FROM_EMAIL as string,
            to: email,
            subject: "Your Dal Syllabus Archive verification code",
            html: `<p>Your verification code is <strong>${code}</strong>. It expires in 15 minutes.</p>`,
        });

        res.status(200).json({ message: "Verification code sent" });
    } catch (error) {
        res.status(500).json({ error: "Error sending verification code" });
    }
};

export const verifyOtp = async (req: Request, res: Response) => {
    const { email, code } = req.body;

    if (!email || !code) {
        return res.status(400).json({ error: "Missing required field(s)" });
    }

    const findQuery = `
        SELECT id FROM otp_codes
        WHERE email = $1 AND code = $2 AND used = false AND expires_at > now()
        ORDER BY created_at DESC
        LIMIT 1
    `;

    try {
        const result = await pool.query(findQuery, [email, code]);

        if (result.rows.length === 0) {
            return res.status(401).json({ error: "Invalid or expired code" });
        }

        const otpId = result.rows[0].id;

        await pool.query("DELETE FROM otp_codes WHERE id = $1", [otpId]);

        // httpOnly so JS on the frontend can never read the token, only send it
        res.cookie("token", signToken(email), {
            httpOnly: true,
            sameSite: "lax",
            maxAge: 2 * 60 * 60 * 1000, // 2 hour session
        });

        res.status(200).json({ email });
    } catch (error) {
        res.status(500).json({ error: "Error verifying code" });
    }
};

export const getMe = (req: AuthRequest, res: Response) => {
    res.status(200).json({ email: req.user?.email });
};

export const logOut = (_req: Request, res: Response) => {
    res.clearCookie("token");
    res.status(200).json({ message: "Logged out successfully" });
};
