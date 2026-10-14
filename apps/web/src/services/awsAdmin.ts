import { CognitoIdentityProviderClient, InitiateAuthCommand } from '@aws-sdk/client-cognito-identity-provider'
import { CognitoIdentityClient, GetCredentialsForIdentityCommand, GetIdCommand } from '@aws-sdk/client-cognito-identity'
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import type { EntityType, ImageAsset } from '../../../../packages/domain/models.ts'
import type { AdminSession, UploadImage } from '../domain/contracts.ts'

export interface AwsAdminConfig {
  region?: string
  clientId?: string
  userPoolId?: string
  identityPoolId?: string
  bucket?: string
}

function webp(bitmap: ImageBitmap, width: 600 | 1200): Promise<{ blob: Blob; height: number }> {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = Math.round(bitmap.height * width / bitmap.width)
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Trình duyệt không hỗ trợ xử lý ảnh.')
  context.drawImage(bitmap, 0, 0, width, canvas.height)
  return new Promise((resolve, reject) => canvas.toBlob(blob => {
    if (!blob || blob.type !== 'image/webp') reject(new Error('Trình duyệt không hỗ trợ xuất WebP.'))
    else resolve({ blob, height: canvas.height })
  }, 'image/webp', 0.8))
}

export function createAwsAdmin({ region, clientId, userPoolId, identityPoolId, bucket }: AwsAdminConfig): { admin: AdminSession; uploadImage: UploadImage } {
  const enabled = Boolean(region && clientId && userPoolId && identityPoolId && bucket)
  const provider = `cognito-idp.${region}.amazonaws.com/${userPoolId}`
  const identityProvider = new CognitoIdentityProviderClient({ region })
  const identity = new CognitoIdentityClient({ region })
  let session: { idToken: string; refreshToken: string; expiresAt: number } | undefined

  async function signInAdmin(username: string, password: string) {
    const result = await identityProvider.send(new InitiateAuthCommand({ ClientId: clientId, AuthFlow: 'USER_PASSWORD_AUTH', AuthParameters: { USERNAME: username, PASSWORD: password } }))
    const auth = result.AuthenticationResult
    if (!auth?.IdToken || !auth.RefreshToken || !auth.ExpiresIn) throw new Error('Cognito yêu cầu bước đăng nhập khác. Kiểm tra tài khoản Admin.')
    session = { idToken: auth.IdToken, refreshToken: auth.RefreshToken, expiresAt: Date.now() + auth.ExpiresIn * 1000 }
  }

  function signOutAdmin() { session = undefined }

  async function credentials() {
    if (!session) throw new Error('Hãy đăng nhập Admin trước khi tải ảnh.')
    if (Date.now() >= session.expiresAt - 60_000) {
      const result = await identityProvider.send(new InitiateAuthCommand({ ClientId: clientId, AuthFlow: 'REFRESH_TOKEN_AUTH', AuthParameters: { REFRESH_TOKEN: session.refreshToken } }))
      if (!result.AuthenticationResult?.IdToken || !result.AuthenticationResult.ExpiresIn) throw new Error('Phiên Admin đã hết hạn. Hãy đăng nhập lại.')
      session = { ...session, idToken: result.AuthenticationResult.IdToken, expiresAt: Date.now() + result.AuthenticationResult.ExpiresIn * 1000 }
    }
    const Logins = { [provider]: session.idToken }
    const id = await identity.send(new GetIdCommand({ IdentityPoolId: identityPoolId, Logins }))
    if (!id.IdentityId) throw new Error('Không nhận được danh tính AWS.')
    const result = await identity.send(new GetCredentialsForIdentityCommand({ IdentityId: id.IdentityId, Logins }))
    const value = result.Credentials
    if (!value?.AccessKeyId || !value.SecretKey || !value.SessionToken) throw new Error('Không nhận được quyền tải ảnh AWS.')
    return { accessKeyId: value.AccessKeyId, secretAccessKey: value.SecretKey, sessionToken: value.SessionToken }
  }

  async function uploadAwsImage(file: File, entityType: EntityType, entityId: string, signal: AbortSignal): Promise<ImageAsset> {
    if (!['building', 'room'].includes(entityType) || !/^[A-Za-z0-9_-]{1,64}$/.test(entityId)) throw new Error('Bất động sản không hợp lệ.')
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || !file.size || file.size > 10 * 1024 * 1024) throw new Error('Chọn ảnh JPEG, PNG hoặc WebP tối đa 10 MiB.')
    const bitmap = await createImageBitmap(file)
    let small, large
    try {
      if (bitmap.width < 1200 || bitmap.width * bitmap.height > 20_000_000 || Math.round(bitmap.height * 1200 / bitmap.width) > 16383) throw new Error('Cần ảnh rộng từ 1200px, tối đa 20 MP và cao phù hợp.')
      small = await webp(bitmap, 600)
      large = await webp(bitmap, 1200)
    } finally { bitmap.close() }
    if (signal.aborted) throw new DOMException('Upload cancelled', 'AbortError')
    const s3 = new S3Client({ region, credentials: await credentials() })
    const id = crypto.randomUUID()
    const base = `${Math.floor(Date.now() / 1000)}-${crypto.randomUUID()}`
    const path = `images/${entityType}-image/${entityId}/${id}/${base}`
    // shortcut: a failed second PUT can leave one unlinked image; add cleanup when image references are stored centrally.
    for (const [size, output] of [[600, small], [1200, large]] as const) {
      if (signal.aborted) throw new DOMException('Upload cancelled', 'AbortError')
      await s3.send(new PutObjectCommand({ Bucket: bucket, Key: `${path}_${size}.webp`, Body: output.blob, ContentType: 'image/webp', CacheControl: 'public,max-age=31536000,immutable' }), { abortSignal: signal })
    }
    return { id, url600: `/${path}_600.webp`, url1200: `/${path}_1200.webp`, width600: 600, width1200: 1200, height600: small.height, height1200: large.height, bytes600: small.blob.size, bytes1200: large.blob.size }
  }

  return { admin: { enabled, signIn: signInAdmin, signOut: signOutAdmin }, uploadImage: uploadAwsImage }
}
