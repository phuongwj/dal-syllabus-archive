# Secret Manager
resource "google_secret_manager_secret" "db_password" {
    secret_id = "db-password"
    depends_on = [google_project_service.secret_manager]
    replication {
        auto {}
    }
}

resource "google_secret_manager_secret_version" "db_password" {
    secret = google_secret_manager_secret.db_password.id
    secret_data = var.db_password
}

resource "google_secret_manager_secret" "jwt_secret" {
    secret_id = "jwt-secret"
    depends_on = [google_project_service.secret_manager]
    replication {
        auto {}
    }
}

resource "google_secret_manager_secret_version" "jwt_secret" {
    secret = google_secret_manager_secret.jwt_secret.id
    secret_data = var.jwt_secret
}

resource "google_secret_manager_secret" "resend_api_key" {
    secret_id = "resend-api-key"
    depends_on = [google_project_service.secret_manager]
    replication {
        auto {}
    }
}

resource "google_secret_manager_secret_version" "resend_api_key" {
    secret = google_secret_manager_secret.resend_api_key.id
    secret_data = var.resend_api_key
}

# Full libpq connection string the app reads via process.env.DATABASE_URL.
# The empty host + `host=/cloudsql/...` query param points pg at the Auth Proxy
# Unix socket mounted at /cloudsql in run.tf. Password is embedded, so this must
# be a secret (Cloud Run can't interpolate a secret into a plain env var).
resource "google_secret_manager_secret" "database_url" {
    secret_id = "database-url"
    depends_on = [google_project_service.secret_manager]
    replication {
        auto {}
    }
}

resource "google_secret_manager_secret_version" "database_url" {
    secret      = google_secret_manager_secret.database_url.id
    secret_data = "postgresql://app:${var.db_password}@/dal_syllabus?host=/cloudsql/${google_sql_database_instance.main.connection_name}"
}