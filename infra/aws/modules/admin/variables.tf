variable "prefix" {
  type = string
}

variable "website_bucket" {
  type = object({ id = string, arn = string })
}

variable "website_domain_name" {
  type = string
}
