import React, { useState, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Projects from './pages/Projects'
import ProjectDetail from './pages/ProjectDetail'
import Intelligence from './pages/Intelligence'
import MapView from './pages/MapView'
import StateAnalysis from './pages/StateAnalysis'
import Reports from './pages/Reports'
import ContractorPanel from './pages/ContractorPanel'
import AdminPanel from './pages/AdminPanel'
import LoginPage from './pages/LoginPage'
import { AuthProvider, useAuth } from './context/AuthContext'

function AdminRoute() {
  const { role } = useAuth()
  if (role !== 'admin' && role !== 'subadmin') {
    return <Navigate to="/login?tab=admin" replace />
  }
  return <AdminPanel />
}

function ContractorRoute() {
  const { role } = useAuth()
  if (role !== 'contractor') {
    return <Navigate to="/login?tab=contractor" replace />
  }
  return <ContractorPanel />
}

export default function App() {
  // 1. Explicitly make light theme the default (false) unless user specifically chose dark mode
  const [darkMode, setDarkMode] = useState(() => {
    const savedTheme = localStorage.getItem('theme_preference') ?? localStorage.getItem('theme')
    if (savedTheme === 'dark') {
      return true
    }
    // Default to light mode (false)
    return false
  })

  // 2. Add or remove the 'dark' global modifier class on the main root document
  useEffect(() => {
    const root = window.document.documentElement
    if (darkMode) {
      root.classList.add('dark')
      localStorage.setItem('theme', 'dark')
      localStorage.setItem('theme_preference', 'dark')
    } else {
      root.classList.remove('dark')
      localStorage.setItem('theme', 'light')
      localStorage.setItem('theme_preference', 'light')
    }
  }, [darkMode])

  return (
    <AuthProvider>
      <Routes>
        {/* Pass dark mode state down as props so the toggle button can live inside Layout */}
        <Route element={<Layout darkMode={darkMode} setDarkMode={setDarkMode} />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/admin" element={<AdminRoute />} />
          <Route path="/contractor" element={<ContractorRoute />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/projects/:id" element={<ProjectDetail />} />
          <Route path="/map" element={<MapView />} />
          <Route path="/intelligence" element={<Intelligence />} />
          <Route path="/state-analysis" element={<StateAnalysis />} />
          <Route path="/reports" element={<Reports />} />
        </Route>
      </Routes>
    </AuthProvider>
  )
}


