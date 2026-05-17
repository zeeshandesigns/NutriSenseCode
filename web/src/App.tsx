import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Onboarding from './pages/Onboarding'
import DashboardLayout from './pages/DashboardLayout'
import Today from './pages/Today'
import History from './pages/History'
import Insights from './pages/Insights'
import Chatbot from './pages/Chatbot'
import Profile from './pages/Profile'

function LoginRoute() {
  const { session } = useAuth()
  if (session === undefined) return null
  return session ? <Navigate to="/dashboard" replace /> : <Login />
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<LoginRoute />} />
        <Route path="/onboarding" element={
          <ProtectedRoute allowDuringOnboarding>
            <Onboarding />
          </ProtectedRoute>
        } />
        <Route element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
          <Route path="/dashboard" element={<Today />} />
          <Route path="/history"   element={<History />} />
          <Route path="/insights"  element={<Insights />} />
          <Route path="/chatbot"   element={<Chatbot />} />
          <Route path="/profile"   element={<Profile />} />
        </Route>
      </Routes>
    </AuthProvider>
  )
}
