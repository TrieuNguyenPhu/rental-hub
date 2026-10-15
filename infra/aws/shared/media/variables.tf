variable "prefix" { type = string }
variable "website_bucket" {
  type = object({ id = string, arn = string })
}
variable "data_bucket" {
  type = object({ id = string, arn = string })
}
