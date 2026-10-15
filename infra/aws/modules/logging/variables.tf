variable "prefix" {
  type = string
}

variable "account_id" {
  type = string
}

variable "log_source_arn" {
  type = string
}

variable "distribution_arn" {
  type = string
}

variable "logs_bucket" {
  type = object({ id = string, arn = string })
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
