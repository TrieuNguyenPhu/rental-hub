import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'
import { createEstateStore } from './store'
import { browserStorage, createEstatePersistence } from './services/estatePersistence'
import { uploadHttpImage } from './services/uploadHttpImage'

const services = {
  estateStore: createEstateStore(createEstatePersistence(browserStorage)),
  uploadImage: import.meta.env.VITE_STATIC_HOSTING === 'true' ? null : uploadHttpImage,
}

createRoot(document.getElementById('root')!).render(<StrictMode><BrowserRouter><App services={services} /></BrowserRouter></StrictMode>)
