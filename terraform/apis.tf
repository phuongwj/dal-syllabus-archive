resource "google_project_service" "cloud_run" {
  service = "run.googleapis.com"
}

resource "google_project_service" "cloud_sql" {
  service = "sqladmin.googleapis.com"
}

resource "google_project_service" "cloud_storage" {
  service = "storage.googleapis.com"
}

resource "google_project_service" "secret_manager" {
  service = "secretmanager.googleapis.com"
}

# Needed to create the Cloud Run service account. Enabled manually once as a
# bootstrap step (Terraform can't self-enable it), then adopted here.
resource "google_project_service" "iam" {
  service            = "iam.googleapis.com"
  disable_on_destroy = false
}

# Terraform's google_project_service uses THIS api to manage API enablement, so it
# must be enabled by hand before any apply. disable_on_destroy=false keeps a later
# `terraform destroy` from disabling it and re-triggering the bootstrap problem.
resource "google_project_service" "cloud_resource_manager" {
  service            = "cloudresourcemanager.googleapis.com"
  disable_on_destroy = false
}

# TODO once we have base

# resource "google_project_service" "compute" {
#   service = "compute.googleapis.com"
# }

# resource "google_project_service" "monitoring" {
#   service = "monitoring.googleapis.com"
# }

# resource "google_project_service" "logging" {
#   service = "logging.googleapis.com"
# }

# resource "google_project_service" "certificate_manager" {
#   service = "certificatemanager.googleapis.com"
# }