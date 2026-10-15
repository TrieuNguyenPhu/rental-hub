output "buckets" {
  value = { for key, bucket in aws_s3_bucket.buckets : key => {
    id                          = bucket.id
    arn                         = bucket.arn
    bucket                      = bucket.bucket
    bucket_regional_domain_name = bucket.bucket_regional_domain_name
  } }
}

output "public_access" {
  value = { for key, access in aws_s3_bucket_public_access_block.buckets : key => {
    block_public_acls       = access.block_public_acls
    ignore_public_acls      = access.ignore_public_acls
    block_public_policy     = access.block_public_policy
    restrict_public_buckets = access.restrict_public_buckets
  } }
}

output "ownership" {
  value = { for key, controls in aws_s3_bucket_ownership_controls.buckets : key => { rule = controls.rule } }
}

output "versioning" {
  value = { versioning_configuration = aws_s3_bucket_versioning.website.versioning_configuration }
}

output "logs_lifecycle" {
  value = {
    bucket                                 = aws_s3_bucket_lifecycle_configuration.logs.bucket
    transition_default_minimum_object_size = aws_s3_bucket_lifecycle_configuration.logs.transition_default_minimum_object_size
    rule = [for rule in aws_s3_bucket_lifecycle_configuration.logs.rule : {
      id         = rule.id
      expiration = rule.expiration
      filter     = rule.filter
      transition = rule.transition
    }]
  }
}
