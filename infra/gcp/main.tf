resource "google_compute_network" "rental_hub" {
  name                    = "rental-hub-vpc"
  auto_create_subnetworks = false
}

resource "google_compute_subnetwork" "rental_hub" {
  name          = "rental-hub-us-central1"
  ip_cidr_range = "10.42.0.0/24"
  region        = "us-central1"
  network       = google_compute_network.rental_hub.id
}

resource "google_compute_firewall" "http" {
  name          = "rental-hub-http"
  network       = google_compute_network.rental_hub.name
  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["rental-hub-web"]

  allow {
    protocol = "tcp"
    ports    = ["80"]
  }
}

resource "google_compute_firewall" "iap_ssh" {
  name          = "rental-hub-iap-ssh"
  network       = google_compute_network.rental_hub.name
  source_ranges = ["35.235.240.0/20"]
  target_tags   = ["rental-hub-web"]

  allow {
    protocol = "tcp"
    ports    = ["22"]
  }
}

resource "google_service_account" "vm" {
  account_id   = "rental-hub-vm"
  display_name = "Rental Hub VM (no project roles)"
}

resource "google_project_organization_policy" "external_ip" {
  project    = "gcp-project-511702"
  constraint = "compute.vmExternalIpAccess"

  list_policy {
    inherit_from_parent = false

    allow {
      values = ["is:projects/gcp-project-511702/zones/us-central1-a/instances/rental-hub-vm"]
    }
  }
}

resource "google_compute_instance" "rental_hub" {
  name         = "rental-hub-vm"
  machine_type = "e2-micro"
  zone         = "us-central1-a"
  tags         = ["rental-hub-web"]

  boot_disk {
    initialize_params {
      image = "ubuntu-os-cloud/ubuntu-2404-lts-amd64"
      size  = 20
      type  = "pd-standard"
    }
  }

  network_interface {
    subnetwork = google_compute_subnetwork.rental_hub.id
    access_config {}
  }

  service_account {
    email  = google_service_account.vm.email
    scopes = ["https://www.googleapis.com/auth/logging.write"]
  }

  metadata = {
    enable-oslogin = "TRUE"
    startup-script = file("${path.module}/startup.sh")
  }

  depends_on = [
    google_compute_firewall.http,
    google_compute_firewall.iap_ssh,
    google_project_organization_policy.external_ip,
  ]
}

output "external_ip" {
  value = google_compute_instance.rental_hub.network_interface[0].access_config[0].nat_ip
}

output "website_url" {
  value = "http://${google_compute_instance.rental_hub.network_interface[0].access_config[0].nat_ip}"
}
