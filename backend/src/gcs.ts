import dotenv from "dotenv";
dotenv.config();

import { Storage } from "@google-cloud/storage";

const storage = new Storage({
    apiEndpoint: process.env.GCS_API_ENDPOINT,
    projectId: process.env.GCS_PROJECT_ID,
    credentials: {
        client_email: process.env.GCS_CLIENT_EMAIL,
        private_key: (process.env.GCS_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
    },
});

const bucket = storage.bucket(process.env.GCS_BUCKET_NAME || "dal-syllabus-pdfs");

export default bucket;
