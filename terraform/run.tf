# Cloud Run Service Account
resource "google_service_account" "cloud_run" {
    account_id = "cloud-run-backend"
    display_name = "Cloud Run Backend"
    description = "Identity for the Cloud Run backend service"

    depends_on = [
        google_project_service.iam,
        google_project_service.cloud_resource_manager,
    ]
}

# Let it connect to Cloud SQL
resource "google_project_iam_member" "cloud_run_sql" {
    project = var.project_id
    role = "roles/cloudsql.client"
    member = "serviceAccount:${google_service_account.cloud_run.email}"
}

# Let it read/write/sign URLs on the syllabus bucket
resource "google_storage_bucket_iam_member" "cloud_run_storage" {
    bucket = google_storage_bucket.syllabus_files.name
    role = "roles/storage.objectAdmin"
    member = "serviceAccount:${google_service_account.cloud_run.email}"
}

# Let it read secrets
resource "google_project_iam_member" "cloud_run_secrets" {
    project = var.project_id
    role = "roles/secretmanager.secretAccessor"
    member = "serviceAccount:${google_service_account.cloud_run.email}"
}

# Let it sign GCS URLs without a private key: the Storage SDK falls back to the
# IAM Credentials signBlob API (Google signs with the SA's managed key) when no
# local key is present. That requires the SA to be a token creator on ITSELF.
resource "google_service_account_iam_member" "cloud_run_sign" {
    service_account_id = google_service_account.cloud_run.name
    role               = "roles/iam.serviceAccountTokenCreator"
    member             = "serviceAccount:${google_service_account.cloud_run.email}"
}

# Cloud Run Service
resource "google_cloud_run_v2_service" "backend" {
    name = "dal-syllabus-api"
    location = var.region

    depends_on = [google_project_service.cloud_run]

    template {
        service_account = google_service_account.cloud_run.email

        containers {
            image = "gcr.io/${var.project_id}/dal-syllabus_api:latest"

            ports {
                container_port = 8080
            }

            resources {
                limits = {
                    cpu = "1"
                    memory = "512Mi"  # Cloud Run floor for 1 vCPU (always-allocated)
                }
            }

            # The app connects to Postgres via a single connection string. It's a
            # secret because it embeds the password and points at the proxy socket.
            env {
                name = "DATABASE_URL"
                value_source {
                    secret_key_ref {
                        secret  = google_secret_manager_secret.database_url.secret_id
                        version = "latest"
                    }
                }
            }

            env {
                name = "JWT_SECRET"
                value_source {
                    secret_key_ref {
                        secret = google_secret_manager_secret.jwt_secret.secret_id
                        version = "latest"
                    }
                }
            }

            env {
                name = "RESEND_API_KEY"
                value_source {
                secret_key_ref {
                    secret  = google_secret_manager_secret.resend_api_key.secret_id
                    version = "latest"
                }
                }
            }

            # Bucket name env var must match what the app reads (GCS_BUCKET_NAME).
            env {
                name  = "GCS_BUCKET_NAME"
                value = google_storage_bucket.syllabus_files.name
            }

            # No GCS_API_ENDPOINT / GCS_CLIENT_EMAIL / GCS_PRIVATE_KEY here on purpose:
            # their absence makes gcs.ts fall through to ADC (the attached SA) and
            # sign URLs via signBlob. Only GCS_PROJECT_ID is needed.
            env {
                name  = "GCS_PROJECT_ID"
                value = var.project_id
            }

            env {
                name  = "ADMIN_EMAILS"
                value = var.admin_emails
            }

            # CORS allowlist origin; the frontend sends credentials so this can't be "*".
            env {
                name  = "FRONTEND_URL"
                value = var.frontend_url
            }

            env {
                name  = "RESEND_FROM_EMAIL"
                value = var.resend_from_email
            }

            # Demo escape hatch: "true" lets non-@dal.ca (e.g. Gmail) addresses log in.
            # Flip back to "false" for production.
            env {
                name  = "SKIP_EMAIL_DOMAIN_CHECK"
                value = var.skip_email_domain_check
            }

            volume_mounts {
                name       = "cloudsql"
                mount_path = "/cloudsql"
            }
        }

        # Attaches the built-in Cloud SQL Auth Proxy and exposes its Unix socket
        # under /cloudsql/<connection_name> inside the container.
        volumes {
            name = "cloudsql"
            cloud_sql_instance {
                instances = [google_sql_database_instance.main.connection_name]
            }
        }

        scaling {
            min_instance_count = 0  # scale to zero
            max_instance_count = 5  # cap costs
        }
    }
}

# Allow public access to the API (unauthenticated invocations)
resource "google_cloud_run_v2_service_iam_member" "public" {
  name     = google_cloud_run_v2_service.backend.name
  location = var.region
  role     = "roles/run.invoker"
  member   = "allUsers"
}