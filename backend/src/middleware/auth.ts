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

export const isAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
    const adminEmails = (process.env.ADMIN_EMAILS || "").split(",").map((e) => e.trim().toLowerCase());
    const email = req.user?.email?.toLowerCase();

    if (!email || !adminEmails.includes(email)) {
        return res.status(403).json({ error: "Admin access required" });
    }

    next();
};
