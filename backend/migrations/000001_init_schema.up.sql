CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE otp_codes (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email       TEXT NOT NULL,
    code        TEXT NOT NULL,
    expires_at  TIMESTAMPTZ NOT NULL,
    used        BOOLEAN DEFAULT false,
    created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE syllabi (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_code     TEXT NOT NULL,
    course_name     TEXT,
    term            TEXT NOT NULL,
    professor       TEXT NOT NULL,
    file_key        TEXT NOT NULL,
    uploader_email  TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'pending',
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now(),

    UNIQUE(course_code, term, professor, uploader_email)
);

CREATE INDEX idx_syllabi_course_code ON syllabi(course_code);
CREATE INDEX idx_syllabi_status ON syllabi(status);
