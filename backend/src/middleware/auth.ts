import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthRequest extends Request {
    user?: { email: string };
}

export const signToken = (email: string) => {
    return jwt.sign({ email }, process.env.JWT_SECRET as string, { expiresIn: "2h" });
};

export const auth = (req: AuthRequest, res: Response, next: NextFunction) => {
    const token = req.cookies.token;
    if (!token) {
        return res.status(401).json({ error: "No token" });
    }

    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET as string) as { email: string };
        next();
    } catch (error) {
        res.status(401).json({ error: "Invalid token" });
    }
};

export const isAdminEmail = (email: string | undefined): boolean => {
    if (!email) return false;
    const adminEmails = (process.env.ADMIN_EMAILS || "").split(",").map((e) => e.trim().toLowerCase());
    return adminEmails.includes(email.trim().toLowerCase());
};

export const isAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!isAdminEmail(req.user?.email)) {
        return res.status(403).json({ error: "Admin access required" });
    }

    next();
};
