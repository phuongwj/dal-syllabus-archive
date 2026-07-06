# Dalhousie Syllabus Archive

A web application for uploading, moderating, and searching past course syllabi. Students
log in with their email, upload syllabi as PDFs, and search the archive by course code.
Uploads are held for admin approval before they appear publicly.

This README explains not just *how* to run and deploy it, but *what each piece is and why
it's there*, so you can follow along even if you're new to Google Cloud, Terraform, or Docker.

---

## 1. What's in this repository

```
backend/     Node + Express + TypeScript REST API (the server)
frontend/    Astro + React static site (the pages users see)
terraform/   Infrastructure as Code — defines all the cloud resources
```

There are **two completely separate ways to run this project**, and they use **different
config files**. This trips people up, so it's worth being clear up front:

| | Runs on… | Config file | Started with… |
|---|---|---|---|
| **Local development** | your laptop | `backend/.env` + `frontend/.env` | `npm run dev` |
| **Cloud deployment** | Google Cloud | `terraform/terraform.tfvars` | `terraform apply` |

`terraform.tfvars` is **not** used when running locally, and the `.env` files are **not** used
in the cloud. The app reads the same setting names (`DATABASE_URL`, `JWT_SECRET`, etc.) in
both cases — the difference is only *how the values are delivered*: from a `.env` file locally,
or injected by the cloud at runtime. If you only want to see the app work, jump to
[Local development](#7-local-development). To deploy it to the cloud, keep reading.

---

## 2. How the cloud version is built (plain-English architecture)

When deployed, the app is made of a handful of Google Cloud services. Here's what each one
is and why it's used:

- **Cloud Run** — runs the backend. You give it a container (a packaged copy of your app) and
  it runs it, handles HTTPS, and automatically adds or removes copies as traffic changes,
  down to zero when nobody's using it. This is why the backend costs almost nothing when idle.
- **Cloud SQL (PostgreSQL)** — the managed database. It stores syllabus metadata, login
  codes, and upload records. "Managed" means Google handles backups, patching, and updates.
- **Cloud Storage** — file storage, used two ways:
  - a **private** bucket for the uploaded PDFs (not publicly downloadable — see signed URLs below),
  - a **public** bucket that serves the static frontend (the HTML/CSS/JS).
- **Secret Manager** — a secure vault for sensitive values (database password, signing keys,
  API keys) so they never live in the code.
- **Load Balancer** — the single public front door. It gives the whole app one domain and one
  HTTPS certificate, sending `/api/*` requests to Cloud Run and everything else to the frontend
  bucket. **Cloud CDN** is turned on here to cache the static files at Google's edge.

**How the backend reaches the database — the Cloud SQL Auth Proxy.** The database is *not*
open to the internet. Instead, Cloud Run connects to it through the built-in **Cloud SQL Auth
Proxy**: a secure, encrypted tunnel that authenticates using the service's Google Cloud
identity (IAM) rather than by opening a network port. In practice, Cloud Run exposes the
database as a local socket at `/cloudsql/...` inside the container, and the app connects to
that. This is why the database can stay completely private without any extra networking setup.

**How PDF downloads work — signed URLs.** The PDF bucket blocks all public access. When a
user views a syllabus, the backend generates a short-lived (15-minute) **signed URL** — a
temporary link that grants read access to that one file — and the browser downloads directly
from Cloud Storage. So files are private, but downloads don't have to pass through the API.

---

## 3. Two concepts to understand before deploying

### What Terraform is

Terraform is an **Infrastructure as Code** tool. Instead of clicking around the Google Cloud
console to create a database, a bucket, etc., you *describe* everything you want in `.tf` files,
and Terraform creates it for you. The benefits: it's repeatable, it's a written record of exactly
what exists, and it can tear everything down again.

Two files you'll touch, and how they relate:

- **`terraform/variables.tf`** *declares* the inputs the configuration expects (like a form with
  blank fields: "domain", "db_password", …). It doesn't hold the secret values.
- **`terraform/terraform.tfvars`** *fills in* those values (`domain = "..."`, `db_password = "..."`).
  Terraform reads this automatically. It's git-ignored, so secrets stay off GitHub.

The other `.tf` files (`run.tf`, `sql.tf`, `bucket.tf`, …) each describe one part of the system
and refer to those inputs as `var.domain`, `var.db_password`, and so on.

When you run **`terraform apply`**, Terraform looks at what you've described, compares it to
what already exists, and creates or updates whatever's needed.

### What Docker is, and how it fits with Terraform

Cloud Run doesn't run your source code directly — it runs a **container image**: a single
packaged bundle containing your app plus everything it needs to run (Node, dependencies, the
compiled code). **Docker** is the tool that builds that image from the instructions in
`backend/Dockerfile`.

The important thing: **Terraform does not build the image.** Terraform only points Cloud Run
at an image that already exists in Google's registry. So deployment is always two steps:

1. **You** build the image with Docker and push (upload) it to Google's Container Registry.
2. **Terraform** creates the Cloud Run service that runs that image.

If you change backend code, you rebuild and push the image, then redeploy — Terraform alone
won't pick up code changes.

---

## 4. Prerequisites (one-time setup)

Install these tools:
- [Google Cloud CLI (`gcloud`)](https://cloud.google.com/sdk/docs/install)
- [Docker](https://docs.docker.com/get-docker/)
- [Terraform](https://developer.hashicorp.com/terraform/install)
- [`cloud-sql-proxy`](https://github.com/GoogleCloudPlatform/cloud-sql-proxy/releases) — for running migrations
- [`migrate`](https://github.com/golang-migrate/migrate) — the database migration tool
- (macOS: all are available via Homebrew, e.g. `brew install cloud-sql-proxy`)

Then authenticate `gcloud` (this is what lets Terraform and the proxy act on your behalf):

```bash
gcloud auth login                        # log in as your Google account
gcloud auth application-default login    # let local tools use those credentials
gcloud config set project project-7aca817a-1b95-442d-930
gcloud auth configure-docker             # let Docker push images to gcr.io
```

---

## 5. Deploying to the cloud

### Step 0 — one-time project bootstrap (why this is manual)

A few things can't be done by Terraform on a brand-new project, because of a chicken-and-egg
problem: Terraform itself needs certain Google APIs enabled *in order to* manage the project.
So you enable those two APIs by hand, once:

```bash
gcloud services enable cloudresourcemanager.googleapis.com iam.googleapis.com \
  --project=project-7aca817a-1b95-442d-930
```

This project also uses a dedicated Terraform service account, which needs permission to manage
IAM (grant roles to other accounts). If you hit `403 ... setIamPolicy denied` during an apply,
grant it these roles once:

```bash
SA="terraform-532@project-7aca817a-1b95-442d-930.iam.gserviceaccount.com"
for role in resourcemanager.projectIamAdmin iam.serviceAccountAdmin run.admin; do
  gcloud projects add-iam-policy-binding project-7aca817a-1b95-442d-930 \
    --member="serviceAccount:$SA" --role="roles/$role" --condition=None
done
```

*(These manual steps are the small, documented exception to "everything is automated." Once
done, they don't need repeating.)*

### Step 1 — fill in your secrets

Open `terraform/terraform.tfvars` and set the values. What each one is:

- `db_password` — the database user's password (keep it alphanumeric; it gets embedded in the
  connection string).
- `jwt_secret` — a random string used to sign login tokens.
- `resend_api_key` — your API key from [Resend](https://resend.com) (for sending login-code emails).
- `resend_from_email` — the "from" address; must be on a domain you've verified in Resend.
- `admin_emails` — comma-separated list of emails allowed to approve/reject uploads.
- `domain` — the domain the load balancer will serve on (you'll point DNS at it in Step 4).

### Step 2 — build and push the backend image

```bash
cd backend
docker build --platform linux/amd64 \
  -t gcr.io/project-7aca817a-1b95-442d-930/dal-syllabus_api:latest .
docker push gcr.io/project-7aca817a-1b95-442d-930/dal-syllabus_api:latest
```

**Why `--platform linux/amd64`:** if you're on an Apple Silicon Mac, Docker builds for ARM by
default, but Cloud Run runs on x86 (amd64) and will reject an ARM image. This flag forces the
correct architecture.

### Step 3 — create the infrastructure

```bash
cd ../terraform
terraform init      # downloads the Google provider (first time only)
terraform apply     # shows a plan; type "yes" to create everything
```

This creates the database, buckets, secrets, Cloud Run service, and load balancer. **The Cloud
SQL database takes 5–10 minutes to create** — that's normal, not a hang.

### Step 4 — point your domain at the load balancer, and wait for HTTPS

Get the load balancer's IP address:

```bash
terraform output lb_ip
```

In your DNS provider, create an **A record** for your domain pointing at that IP. If you use
Cloudflare, set the record to **"DNS only" (grey cloud), not "Proxied"** — otherwise Google
can't verify the domain and the certificate never activates.

Google then issues the HTTPS certificate automatically, but it can take **15–60 minutes** and
only starts once DNS is pointing correctly. Check its status:

```bash
gcloud compute ssl-certificates describe dal-syllabus-cert --global \
  --format='value(managed.status,managed.domainStatus)'
# you want: ACTIVE   <your-domain>=ACTIVE
```

### Step 5 — create the database tables (migrations)

`terraform apply` creates an *empty* database — it doesn't create the tables. You do that by
running migrations. But the database is private, so you first open a secure tunnel to it with
the Cloud SQL Auth Proxy:

```bash
# This makes localhost:5434 on your laptop securely forward to the cloud database.
cloud-sql-proxy project-7aca817a-1b95-442d-930:northamerica-northeast1:dal-syllabus-db --port 5434 &

# Now run the migrations "through" that tunnel (note the port matches):
cd ../backend
make migrate-up DATABASE_URL="postgres://app:<db_password>@localhost:5434/dal_syllabus?sslmode=disable"

# Stop the tunnel when done:
kill %1
```

Replace `<db_password>` with the value from `terraform.tfvars`. `sslmode=disable` is safe here
because the proxy already encrypts the connection — the only unencrypted hop is inside your
own laptop.

### Step 6 — build and upload the frontend

The frontend is a static site. It needs to know the API's address, which is **baked in at build
time**, so you build it with the address of your deployed API (your domain) and upload the
result to the frontend bucket:

```bash
cd ../frontend
PUBLIC_API_URL="https://<your-domain>" npm run build
gcloud storage cp -r dist/* gs://project-7aca817a-1b95-442d-930-frontend/
```

### Step 7 — verify it works

```bash
# API health (should return {"status":"ok"}):
curl https://<your-domain>/api/health
```

Then open `https://<your-domain>` in a browser and try logging in, uploading, and searching.

---

## 6. Common issues

- **`SERVICE_DISABLED` right after enabling an API** — enablement takes a minute or two to
  propagate. Wait, then re-run `terraform apply`.
- **Cloud Run rejects the image** — you built for ARM; rebuild with `--platform linux/amd64`.
- **`terraform apply` fails with `... memory < 512Mi ...`** — Cloud Run's minimum memory for a
  1-vCPU instance is 512 MiB (already set in `run.tf`).
- **Certificate stuck in `PROVISIONING` / `FAILED_NOT_VISIBLE`** — your DNS isn't pointing at the
  LB, or (Cloudflare) the record is proxied. Set it to "DNS only" and wait for retry.
- **Changed backend code but nothing changed in the cloud** — rebuild and push the image
  (Step 2), then run `gcloud run services update dal-syllabus-api --region northamerica-northeast1 --image gcr.io/project-7aca817a-1b95-442d-930/dal-syllabus_api:latest` to roll out a new revision.

---

## 7. Local development

You can run the whole app on your laptop with no Google Cloud account at all. Instead of the
real cloud database and storage, you run a local Postgres and a "fake" storage server in
Docker. You only need **Docker**, **Node.js (v22+)**, and the **`migrate`** tool installed.

**Step 1 — copy the config templates.** Each side has an `.env.example` showing the settings it
needs; copy them to real `.env` files and fill in the blanks noted in the comments:

```bash
cp backend/.env.example backend/.env      # set JWT_SECRET, RESEND_API_KEY, ADMIN_EMAILS
cp frontend/.env.example frontend/.env    # already set to PUBLIC_API_URL=http://localhost:8090
```

**Step 2 — start the local database.** This runs Postgres in a container on port 5433, matching
the `DATABASE_URL` already in `backend/.env.example`:

```bash
docker run --name dal-pg -d -p 5433:5432 \
  -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=pgAdmin4 -e POSTGRES_DB=dal_syllabus \
  postgres:15
```

**Step 3 — start the fake storage server.** This runs a Cloud Storage emulator on port 4443, so
the app can "upload" files without touching real Google Cloud:

```bash
docker run --name dal-gcs -d -p 4443:4443 \
  fsouza/fake-gcs-server -scheme http -public-host localhost:4443
```

*(Note: viewing a syllabus PDF locally uses "signed URLs," which need a throwaway signing key
set as `GCS_CLIENT_EMAIL` / `GCS_PRIVATE_KEY` in `backend/.env` — see the comments in
`.env.example`. Upload and search work without it; only the file-download step needs it.)*

**Step 4 — install dependencies, create the tables, and run both sides.** Run the backend and
frontend in **two separate terminals**:

```bash
# terminal 1 — backend
cd backend
npm install
make migrate-up          # creates the tables in your local Postgres
npm run dev              # API now running at http://localhost:8090

# terminal 2 — frontend
cd frontend
npm install
npm run dev              # site now running at http://localhost:4321
```

Open **http://localhost:4321** in your browser. You now have the full app running locally,
talking to the local database and fake storage instead of any cloud resources.

**To stop and clean up** the local containers when you're done:

```bash
docker rm -f dal-pg dal-gcs
```

---

## 8. Tearing it all down

```bash
cd terraform
terraform destroy   # removes everything Terraform created
```

(The two APIs and IAM grants from Step 0 stay enabled — they're harmless and left in place so a
future re-deploy doesn't hit the bootstrap problem again.)
