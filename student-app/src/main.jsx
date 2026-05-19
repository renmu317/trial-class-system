import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, useParams } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import ReportPage from './pages/ReportPage.jsx'

// Wrapper to extract token param
function ReportPageWrapper() {
  const { token } = useParams()
  return <ReportPage token={token} />
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/report/:token" element={<ReportPageWrapper />} />
        <Route path="*" element={<App />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
