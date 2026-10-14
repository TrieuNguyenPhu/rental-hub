import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CognitoIdentityProviderClient, InitiateAuthCommand } from '@aws-sdk/client-cognito-identity-provider'
import { CognitoIdentityClient, GetIdCommand, GetCredentialsForIdentityCommand } from '@aws-sdk/client-cognito-identity'
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { createAwsAdmin } from '../../apps/web/src/services/awsAdmin.ts'

const config = { region: 'ap-southeast-1', clientId: 'client', userPoolId: 'pool', identityPoolId: 'identity', bucket: 'images' }

test('AWS configuration is explicit and each admin instance uses its own client ID', async t => {
  const calls: InitiateAuthCommand[] = []
  t.mock.method(CognitoIdentityProviderClient.prototype, 'send', async (command: InitiateAuthCommand) => {
    calls.push(command)
    return { AuthenticationResult: { IdToken: 'token', RefreshToken: 'refresh', ExpiresIn: 3600 } }
  })
  assert.equal(createAwsAdmin({}).admin.enabled, false)
  for (const key of Object.keys(config)) assert.equal(createAwsAdmin({ ...config, [key]: undefined }).admin.enabled, false)
  const first = createAwsAdmin(config)
  const second = createAwsAdmin({ ...config, clientId: 'second-client' })
  assert.equal(first.admin.enabled, true)
  await first.admin.signIn('first', 'first-password')
  await second.admin.signIn('second', 'second-password')
  assert.deepEqual(calls.map(command => command.input), [
    { ClientId: 'client', AuthFlow: 'USER_PASSWORD_AUTH', AuthParameters: { USERNAME: 'first', PASSWORD: 'first-password' } },
    { ClientId: 'second-client', AuthFlow: 'USER_PASSWORD_AUTH', AuthParameters: { USERNAME: 'second', PASSWORD: 'second-password' } },
  ])
})

test('AWS sign-in preserves challenge errors and upload validates input before browser processing', async t => {
  t.mock.method(CognitoIdentityProviderClient.prototype, 'send', async () => ({ ChallengeName: 'NEW_PASSWORD_REQUIRED' }))
  const aws = createAwsAdmin(config)
  await assert.rejects(aws.admin.signIn('admin', 'password'), /Cognito yêu cầu/)
  const signal = new AbortController().signal
  await assert.rejects(aws.uploadImage(new File(['x'], 'test.jpg', { type: 'image/jpeg' }), 'room', '../invalid', signal), /Bất động sản không hợp lệ/)
  await assert.rejects(aws.uploadImage(new File(['x'], 'test.gif', { type: 'image/gif' }), 'room', 'room-1', signal), /JPEG, PNG hoặc WebP/)
})

test('AWS sessions stay isolated through sign-out and paired uploads', async t => {
  const browser = {
    createImageBitmap: async () => ({ width: 1600, height: 1000, close() {} }),
    document: { createElement: () => ({
      getContext: () => ({ drawImage() {} }),
      toBlob: (callback: BlobCallback) => callback(new Blob(['webp'], { type: 'image/webp' })),
    }) },
  }
  for (const [name, value] of Object.entries(browser)) {
    const original = Object.getOwnPropertyDescriptor(globalThis, name)
    Object.defineProperty(globalThis, name, { configurable: true, value })
    t.after(() => {
      if (original) Object.defineProperty(globalThis, name, original)
      else Reflect.deleteProperty(globalThis, name)
    })
  }
  t.mock.method(CognitoIdentityProviderClient.prototype, 'send', async (command: InitiateAuthCommand) => ({
    AuthenticationResult: { IdToken: command.input.AuthParameters?.USERNAME, RefreshToken: 'refresh', ExpiresIn: 3600 },
  }))
  const identities: (GetIdCommand | GetCredentialsForIdentityCommand)[] = []
  t.mock.method(CognitoIdentityClient.prototype, 'send', async (command: GetIdCommand | GetCredentialsForIdentityCommand) => {
    identities.push(command)
    return command instanceof GetIdCommand ? { IdentityId: 'identity' } : {
      Credentials: { AccessKeyId: 'key', SecretKey: 'secret', SessionToken: 'session' },
    }
  })
  const puts: PutObjectCommand[] = []
  t.mock.method(S3Client.prototype, 'send', async (command: PutObjectCommand) => { puts.push(command); return {} })
  const first = createAwsAdmin(config)
  const second = createAwsAdmin(config)
  await first.admin.signIn('first', 'password')
  await second.admin.signIn('second', 'password')
  first.admin.signOut()
  const file = new File(['jpeg'], 'test.jpg', { type: 'image/jpeg' })
  const signal = new AbortController().signal
  await assert.rejects(first.uploadImage(file, 'room', 'room-1', signal), /Hãy đăng nhập Admin/)
  const asset = await second.uploadImage(file, 'room', 'room-1', signal)
  assert.equal(identities.length, 2)
  for (const command of identities) assert.deepEqual(command.input.Logins, { 'cognito-idp.ap-southeast-1.amazonaws.com/pool': 'second' })
  assert.deepEqual(puts.map(command => command.input.Key), [asset.url600.slice(1), asset.url1200.slice(1)])
  assert.deepEqual([asset.height600, asset.height1200], [375, 750])
  await assert.rejects(createAwsAdmin(config).uploadImage(file, 'room', 'room-1', signal), /Hãy đăng nhập Admin/)
})
