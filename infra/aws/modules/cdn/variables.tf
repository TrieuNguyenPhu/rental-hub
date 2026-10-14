variable "prefix" {
  type = string
}

variable "website_bucket" {
  type = object({ id = string, arn = string, bucket_regional_domain_name = string })
}

variable "deny_http" {
  type = object({
    Sid       = string
    Effect    = string
    Principal = string
    Action    = string
    Resource  = list(string)
    Condition = object({ Bool = map(bool) })
  })
}
