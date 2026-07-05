import dotenv from "dotenv";
dotenv.config();

import { Storage, type StorageOptions } from "@google-cloud/storage";

// Local dev talks to the fake-gcs emulator and signs with a throwaway key, so we
// pass an explicit endpoint + credentials. In production those vars are unset, so
// we fall through to Application Default Credentials (the attached Cloud Run
// service account) and sign URLs via the IAM signBlob API — no key material.
const options: StorageOptions = { projectId: process.env.GCS_PROJECT_ID };

if (process.env.GCS_API_ENDPOINT) {
    options.apiEndpoint = process.env.GCS_API_ENDPOINT;
}

if (process.env.GCS_CLIENT_EMAIL) {
    options.credentials = {
        client_email: process.env.GCS_CLIENT_EMAIL,
        private_key: (process.env.GCS_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
    };
}

const storage = new Storage(options);

const bucket = storage.bucket(process.env.GCS_BUCKET_NAME || "dal-syllabus-pdfs");

export default bucket;
