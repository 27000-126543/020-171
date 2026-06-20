import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Layout from '@/components/Layout'
import Dashboard from '@/pages/Dashboard'
import Annotation from '@/pages/Annotation'
import Comparison from '@/pages/Comparison'
import Library from '@/pages/Library'

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/annotation" element={<Annotation />} />
          <Route path="/comparison" element={<Comparison />} />
          <Route path="/library" element={<Library />} />
        </Route>
      </Routes>
    </Router>
  )
}
