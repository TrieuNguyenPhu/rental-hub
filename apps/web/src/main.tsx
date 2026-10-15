import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './styles/dashboard.css'
import './index.css'
import './styles/appShell.css'
import { createEstateStore } from './store'
import { browserStorage, createEstatePersistence } from './services/estatePersistence'
import { uploadHttpImage } from './services/uploadHttpImage'
import { createRemoteEstateStore } from './services/remoteEstateStore'
import './styles/dataWorkflows.css'

const root = createRoot(document.getElementById('root')!)
const sharedData = import.meta.env.VITE_STATIC_HOSTING === 'true'
const estateStore = sharedData
  ? await createRemoteEstateStore().catch((error: Error) => {
      root.render(<main role="alert">{error.message} <button onClick={() => location.reload()}>Thử lại</button></main>)
      return null
    })
  : createEstateStore(createEstatePersistence(browserStorage))

if (estateStore) root.render(
  <StrictMode>
    <BrowserRouter>
      <App services={{ estateStore, uploadImage: uploadHttpImage, maxImageBytes: sharedData ? 4 * 1024 * 1024 : 10 * 1024 * 1024, sharedData }} />
    </BrowserRouter>
  </StrictMode>,
)
