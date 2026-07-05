import dotenv from "dotenv";
dotenv.config();

import express, { Request, Response, NextFunction } from "express";
import cookieParser from "cookie-parser";
import multer from "multer";
import cors from "cors";

import router from "./routes/router.js";
import pool from "./db.js";

const app = express();
const PORT = Number(process.env.PORT) || 8090;

app.use(cors({
    origin: process.env.FRONTEND_URL || "http://localhost:4321",
    credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

app.use("/api", router);

app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ error: "File exceeds the 10MB limit" });
    }

    res.status(500).json({ error: "Internal server error" });
});

async function start() {
    await pool.query("SELECT 1");
    console.log("connected to database");

    const server = app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });

    const shutdown = () => {
        server.close(async () => {
            await pool.end();
            process.exit(0);
        });
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
}

start();
