# GCP for prod environment
provider "google" {
    project = var.project_id
    region  = var.region

    impersonate_service_account = "terraform-532@${var.project_id}.iam.gserviceaccount.com"
}