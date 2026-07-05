import express from "express";
import multer from "multer";

import { health } from "../controllers/healthController.js";
import { sendOtp, verifyOtp, getMe, logOut } from "../controllers/authController.js";
import { getSyllabi, getSyllabusById, getSyllabusFile, createSyllabus } from "../controllers/syllabiController.js";
import { getPendingSyllabi, updateSyllabusStatus } from "../controllers/adminController.js";
import { auth, isAdmin } from "../middleware/auth.js";

const router = express.Router();
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
});

// =================================
// Health
// =================================

router.get("/health", health);

// =================================
// Auth Endpoints
// =================================

router.post("/auth/otp", sendOtp);
router.post("/auth/verify", verifyOtp);
router.get("/auth/me", auth, getMe);
router.post("/auth/logout", logOut);

// =================================
// Syllabi Endpoints (public)
// =================================

router.get("/syllabi", getSyllabi);
router.get("/syllabi/:id", getSyllabusById);
router.get("/syllabi/:id/file", getSyllabusFile);

// =================================
// Syllabi Endpoints (authenticated)
// =================================

router.post("/syllabi", auth, upload.single("pdf"), createSyllabus);

// =================================
// Admin Endpoints
// =================================

router.get("/admin/pending", auth, isAdmin, getPendingSyllabi);
router.patch("/admin/syllabi/:id", auth, isAdmin, updateSyllabusStatus);

export default router;
