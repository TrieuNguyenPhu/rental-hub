terraform {
  required_version = ">= 1.15, < 2.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
}

provider "aws" {
  region              = "ap-southeast-2"
  allowed_account_ids = ["287872994400"]
}

variable "admin_cidr" {
  type        = string
  description = "Public IPv4 address of the SSH operator, with /32 suffix"
  validation {
    condition     = can(cidrhost(var.admin_cidr, 0)) && endswith(var.admin_cidr, "/32")
    error_message = "Supply one public IPv4 address as x.x.x.x/32."
  }
}

variable "public_key_path" {
  type        = string
  description = "Path to a local SSH public key; private key never enters Terraform state"
}

data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

resource "aws_key_pair" "demo" {
  key_name   = "rental-hub-task2-demo"
  public_key = file(pathexpand(var.public_key_path))
  tags       = { Project = "rental-hub", Purpose = "task-2-demo" }
}

resource "aws_security_group" "demo" {
  name_prefix = "rental-hub-task2-"
  description = "Temporary Rental Hub Task 2 demo"
  vpc_id      = data.aws_vpc.default.id
  tags        = { Project = "rental-hub", Purpose = "task-2-demo" }
}

resource "aws_vpc_security_group_ingress_rule" "ssh" {
  security_group_id = aws_security_group.demo.id
  cidr_ipv4         = var.admin_cidr
  from_port         = 22
  to_port           = 22
  ip_protocol       = "tcp"
}

resource "aws_vpc_security_group_ingress_rule" "http" {
  security_group_id = aws_security_group.demo.id
  cidr_ipv4         = "0.0.0.0/0"
  from_port         = 80
  to_port           = 80
  ip_protocol       = "tcp"
}

resource "aws_vpc_security_group_ingress_rule" "https" {
  security_group_id = aws_security_group.demo.id
  cidr_ipv4         = "0.0.0.0/0"
  from_port         = 443
  to_port           = 443
  ip_protocol       = "tcp"
}

resource "aws_vpc_security_group_egress_rule" "internet" {
  security_group_id = aws_security_group.demo.id
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "-1"
}

resource "aws_instance" "demo" {
  # Canonical Ubuntu 24.04 amd64 gp3 in ap-southeast-2, verified Free Tier eligible.
  ami                         = "ami-0f5e1e0151e5b95ed"
  instance_type               = "t3.small"
  subnet_id                   = sort(data.aws_subnets.default.ids)[0]
  associate_public_ip_address = true
  key_name                    = aws_key_pair.demo.key_name
  vpc_security_group_ids      = [aws_security_group.demo.id]
  user_data                   = templatefile("${path.module}/bootstrap.sh.tftpl", { admin_cidr = var.admin_cidr })
  user_data_replace_on_change = false

  root_block_device {
    volume_type           = "gp3"
    volume_size           = 20
    encrypted             = true
    delete_on_termination = true
  }

  metadata_options {
    http_tokens = "required"
  }

  tags = { Name = "rental-hub-task2-demo", Project = "rental-hub", Purpose = "task-2-demo" }
}

output "instance_id" {
  value = aws_instance.demo.id
}

output "public_ip" {
  value = aws_instance.demo.public_ip
}

output "http_url" {
  value = "http://${aws_instance.demo.public_ip}"
}
