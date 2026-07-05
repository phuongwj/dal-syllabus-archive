# Cloud SQL
resource "google_sql_database_instance" "main" {
    name             = "dal-syllabus-db"
    database_version = "POSTGRES_15"
    region           = var.region

    depends_on = [google_project_service.cloud_sql]

    settings {
        tier = "db-f1-micro" # cheapest tier

        ip_configuration {
            # Public IP stays enabled, but there are NO authorized_networks:
            # the Cloud SQL Auth Proxy (mounted into Cloud Run in run.tf) connects
            # over Google's internal channel with IAM auth, so direct internet TCP
            # is blocked. No Serverless VPC Connector required.
            ipv4_enabled = true
        }

        backup_configuration {
            enabled = true
        }
    }

    # so terraform destroy works during local dev
    deletion_protection = false 
}

resource "google_sql_database" "app" {
    name     = "dal_syllabus"
    instance = google_sql_database_instance.main.name
}

resource "google_sql_user" "app" {
    name     = "app"
    instance = google_sql_database_instance.main.name
    password = var.db_password
}