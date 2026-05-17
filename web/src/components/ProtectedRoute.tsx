import { Navigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '../context/AuthContext'

interface Props {
  children: ReactNode
  /** When true, this route is reachable even before onboarding is complete (e.g. /onboarding itself). */
  allowDuringOnboarding?: boolean
}

export default function ProtectedRoute({ children, allowDuringOnboarding = false }: Props) {
  const { session, profile } = useAuth()
  const location = useLocation()

  // still hydrating session or profile
  if (session === undefined || (session && profile === undefined)) return null

  if (!session) return <Navigate to="/login" replace />

  // incomplete onboarding can only access /onboarding
  if (profile && !profile.onboarding_complete && !allowDuringOnboarding) {
    return <Navigate to="/onboarding" replace />
  }

  // completed users shouldn't see /onboarding again
  if (profile?.onboarding_complete && location.pathname === '/onboarding') {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}
