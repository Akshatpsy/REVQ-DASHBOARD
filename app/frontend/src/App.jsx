import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import ProductPage from './ProductPage'
import './index.css'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/product/:id" element={<ProductPage />} />
        {/* Redirect root to product 2 for testing since we only have product 2 & 3 */}
        <Route path="/" element={<Navigate to="/product/2" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
