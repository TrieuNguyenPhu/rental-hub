terraform {
  required_version = ">= 1.5.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 7.0"
    }
  }
}

provider "google" {
  project = "gcp-project-511702"
  region  = "us-central1"
  zone    = "us-central1-a"
}
