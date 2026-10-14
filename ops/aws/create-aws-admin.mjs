import { randomBytes } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { AdminCreateUserCommand, AdminSetUserPasswordCommand, CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider'

const account = execFileSync('aws', ['sts', 'get-caller-identity', '--query', 'Account', '--output', 'text'], { encoding: 'utf8' }).trim()
if (account !== '287872994400') throw new Error('Wrong AWS account')
const repository = fileURLToPath(new URL('../..', import.meta.url))
const output = JSON.parse(execFileSync('terraform', [`-chdir=${path.join(repository, 'infra/aws')}`, 'output', '-json', 'deployment'], { encoding: 'utf8' }))
const file = path.join(os.homedir(), '.ssh', 'rental-hub-task3-admin.txt')
if (fs.existsSync(file)) throw new Error(`Credential file already exists: ${file}`)
const password = `A!a1${randomBytes(24).toString('base64url')}`
fs.mkdirSync(path.dirname(file), { recursive: true })
fs.writeFileSync(file, `Username: admin\nPassword: ${password}\nWebsite: https://${output.DomainName}\n`, { flag: 'wx', mode: 0o600 })
const client = new CognitoIdentityProviderClient({ region: output.Region })
await client.send(new AdminCreateUserCommand({ UserPoolId: output.AdminUserPoolId, Username: 'admin', TemporaryPassword: password, MessageAction: 'SUPPRESS' }))
await client.send(new AdminSetUserPasswordCommand({ UserPoolId: output.AdminUserPoolId, Username: 'admin', Password: password, Permanent: true }))
console.log(`Admin credential saved to ${file}`)
