variable "project_id" {
    description = "GCP project ID"
    default = "project-7aca817a-1b95-442d-930"
}

variable "region" {
    description = "GCP region"
    default = "northamerica-northeast1"
}

variable "db_password" {
    description = "Cloud SQL database password"
    sensitive = true
}

variable "jwt_secret" {
    description = "JWT signing key"
    sensitive = true
}

variable "resend_api_key" {
    description = "Resend API key for sending OTP emails"
    sensitive = true
}

variable "admin_emails" {
  description = "Comma-separated admin email addresses"
  sensitive   = true
}

variable "domain" {
  description = "Domain served by the load balancer (e.g. dalsyllabus.phuongpham.co). Used for the managed SSL cert and as the single frontend/API origin. You must point an A record at the LB IP after apply."
}

variable "resend_from_email" {
  description = "From address used for OTP emails via Resend"
  default     = "onboarding@resend.dev"
}

variable "skip_email_domain_check" {
  description = "When \"true\", bypasses the @dal.ca-only gate on OTP login. Needed to demo with a Gmail address since Resend->@dal.ca (M365) silently drops mail. Set back to \"false\" for real production."
  default     = "false"
}