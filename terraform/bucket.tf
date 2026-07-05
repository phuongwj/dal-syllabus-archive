# Syllabus PDF bucket (private)
resource "google_storage_bucket" "syllabus_files" {
    name        = "${var.project_id}-syllabus-files"
    location    = var.region

    depends_on = [google_project_service.cloud_storage]

    uniform_bucket_level_access = true

    # Guarantees that files are only accessible via signed URLs
    public_access_prevention    = "enforced"
}

# Frontend static site bucket (public)
resource "google_storage_bucket" "frontend" {
    name     = "${var.project_id}-frontend"
    location = var.region

    depends_on = [google_project_service.cloud_storage]

    uniform_bucket_level_access = true

    website {
        main_page_suffix = "index.html"
        not_found_page   = "404.html"
    }
}

# uniform_bucket_level_access + website{} alone don't make objects public —
# GCS still 403s until allUsers is explicitly granted read access.
resource "google_storage_bucket_iam_member" "frontend_public_read" {
    bucket = google_storage_bucket.frontend.name
    role   = "roles/storage.objectViewer"
    member = "allUsers"
}