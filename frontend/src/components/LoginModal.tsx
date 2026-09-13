import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

/**
 * LoginModal is deprecated in favor of the dedicated /login panel.
 * If anything triggers isLoginModalOpen, it automatically redirects to /login.
 */
export const LoginModal: React.FC = () => {
  const { isLoginModalOpen, setLoginModalOpen } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (isLoginModalOpen) {
      setLoginModalOpen(false)
      navigate('/login')
    }
  }, [isLoginModalOpen, setLoginModalOpen, navigate])

  return null
}
