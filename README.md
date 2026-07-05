# Dalhousie Syllabus Archive

A cloud-native app for uploading, moderating, and searching course syllabi. Students
log in via email OTP, upload PDF syllabi (which land in `pending`), and admins approve
or reject them. Approved syllabi are searchable and downloadable via short-lived signed
URLs.

- **Frontend**: Astro + React + Tailwind (static site)
- **Backend**: Node + Express + TypeScript (REST API under `/api`)
- **Storage**: Postgres (metadata) + object storage (PDF files)
- **Cloud target**: GCP — Cloud Run, Cloud SQL, Cloud Storage, Secret Manager

There are **two separate ways to run this project**, each with its own config file:

| Environment | Config file(s) | How you run it |
|---|---|---|
| **Local dev** (your laptop) | `backend/.env`, `frontend/.env` | local Postgres + fake-gcs emulator, `npm run dev` |
| **Cloud deploy** (GCP) | `terraform/terraform.tfvars` | `terraform apply` (see [terraform](#cloud-deploy-gcp)) |

`terraform.tfvars` is **not** used for local dev, and `.env` is **not** used in the cloud.
The app reads the same `process.env.*` names in both worlds; the difference is only how
those values are delivered (dotenv locally, Cloud Run env vars in the cloud).

---

## Local development

### Prerequisites
- Node >= 22, Docker, the `migrate` CLI.

### 1. Config
```bash
cp backend/.env.example backend/.env      # fill in JWT_SECRET, RESEND_API_KEY, ADMIN_EMAILS
cp frontend/.env.example frontend/.env    # PUBLIC_API_URL=http://localhost:8090
```

### 2. Local Postgres + fake GCS
- Postgres on port **5433** (matches `DATABASE_URL` in `.env.example`).
- fake-gcs-server on port **4443** for object storage, with a throwaway signing key so
  signed URLs work locally. `backend/.env` points `GCS_API_ENDPOINT` at it and supplies
  `GCS_CLIENT_EMAIL` / `GCS_PRIVATE_KEY` for signing.

### 3. Migrate + run
```bash
cd backend && make migrate-up && npm run dev   # API on :8090
cd frontend && npm run dev                      # site on :4321
```

---

## Cloud deploy (GCP)

Provisions Cloud Run (API) + Cloud SQL (Postgres) + two Cloud Storage buckets (private
syllabus files, public static frontend) + Secret Manager. Cloud Armor, Cloud CDN, the
Load Balancer, and Cloud Logging/Monitoring are not provisioned yet.

### How the pieces connect
- **Cloud Run → Cloud SQL**: via the built-in **Cloud SQL Auth Proxy**. `run.tf` mounts
  the instance as a `cloud_sql_instance` volume at `/cloudsql`, and the app connects over
  that Unix socket using the `database-url` secret. The instance has **no authorized
  networks**, so it is not reachable from the internet — no VPC connector required.
- **Cloud Run → GCS**: the app runs as the `cloud-run-backend` service account and uses
  Application Default Credentials (no key files). Download signed URLs are produced via the
  IAM `signBlob` API (the SA is a token creator on itself).
- **Secrets**: `DATABASE_URL`, `JWT_SECRET`, `RESEND_API_KEY` come from Secret Manager at
  runtime.

### Prerequisites
- `gcloud` authenticated with permission to impersonate `terraform-532@<project>` and, for
  migrations, `roles/cloudsql.client` on your user.
- Docker, Terraform, the `cloud-sql-proxy` binary, and the `migrate` CLI.
- `terraform/terraform.tfvars` filled in (git-ignored). Set a real `resend_api_key` and a
  `resend_from_email` on a **verified Resend domain**; `db_password`/`jwt_secret` are
  prefilled.

  > **Note on `resend_from_email`**: `variables.tf` defaults this to
  > `onboarding@resend.dev`, Resend's built-in sandbox sender. It works with no domain
  > verification but **only delivers to your own Resend account email** — fine for a first
  > smoke test, useless for real users. For actual sends, override it in `terraform.tfvars`
  > with an address on a domain you've verified in the Resend dashboard (SPF/DKIM added),
  > as done here (`verify@dalsyllabus.phuongpham.co`).

  > **Note on `skip_email_domain_check`**: OTP login normally only accepts `@dal.ca`
  > addresses, but Resend can't deliver to `@dal.ca` (Microsoft 365 silently drops it), so a
  > real `@dal.ca` user can't receive their code. To demo with the Gmail admin address, this
  > is set to `"true"` in `terraform.tfvars` to bypass the gate. **Set it back to `"false"`
  > for production.**

### Deploy
```bash
# 1. Build and push the API image (Terraform does not build images)
cd backend
docker build -t gcr.io/<project_id>/dal-syllabus_api:latest .
docker push gcr.io/<project_id>/dal-syllabus_api:latest

# 2. Apply infrastructure
cd ../terraform
terraform init
terraform apply
```

### Run migrations (one-time, and on schema changes)
The DB has no public access, so migrate through a local Auth Proxy tunnel. The proxy makes
`localhost:5432` forward securely to the cloud instance using your `gcloud` identity.
```bash
# instance connection name = <project_id>:northamerica-northeast1:dal-syllabus-db
cloud-sql-proxy <project_id>:northamerica-northeast1:dal-syllabus-db --port 5432 &

cd backend
# Pass DATABASE_URL as a make ARGUMENT (make VAR=val), not a shell prefix — the Makefile's
# `-include .env` would otherwise override a shell-exported value with your local .env one.
make migrate-up DATABASE_URL="postgres://app:<db_password>@localhost:5432/dal_syllabus?sslmode=disable"

kill %1   # stop the proxy when done
```

### Frontend
Build with `PUBLIC_API_URL` set to the Cloud Run URL, then upload `frontend/dist/` to the
`<project_id>-frontend` bucket. Set `frontend_url` in tfvars to the origin the browser uses
so CORS matches.
