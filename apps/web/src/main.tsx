import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'
import { createEstateStore } from './store'
import { browserStorage, createEstatePersistence } from './services/estatePersistence'
import { createAwsAdmin } from './services/awsAdmin'
import { uploadHttpImage } from './services/uploadHttpImage'

const aws = createAwsAdmin({
  region: import.meta.env.VITE_AWS_REGION,
  clientId: import.meta.env.VITE_AWS_ADMIN_CLIENT_ID,
  userPoolId: import.meta.env.VITE_AWS_ADMIN_USER_POOL_ID,
  identityPoolId: import.meta.env.VITE_AWS_ADMIN_IDENTITY_POOL_ID,
  bucket: import.meta.env.VITE_AWS_WEBSITE_BUCKET,
})

const services = {
  estateStore: createEstateStore(createEstatePersistence(browserStorage)),
  admin: aws.admin,
  uploadImage: aws.admin.enabled ? aws.uploadImage : uploadHttpImage,
}

createRoot(document.getElementById('root')!).render(<StrictMode><BrowserRouter><App services={services} /></BrowserRouter></StrictMode>)
