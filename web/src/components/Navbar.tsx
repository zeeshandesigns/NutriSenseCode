import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Camera, History, TrendingUp, MessageCircle, User, LogOut, UtensilsCrossed } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const NAV = [
  { to: '/dashboard', icon: Camera,        label: 'Scan' },
  { to: '/history',   icon: History,       label: 'History' },
  { to: '/insights',  icon: TrendingUp,    label: 'Insights' },
  { to: '/chatbot',   icon: MessageCircle, label: 'Ask AI' },
  { to: '/profile',   icon: User,          label: 'Profile' },
]

export default function Navbar() {
  const navigate = useNavigate()
  const location = useLocation()
  const { signOut } = useAuth()
  const isActive = (path: string) => location.pathname === path

  async function handleSignOut() {
    if (!window.confirm('Sign out of NutriSense AI?')) return
    await signOut()
    navigate('/')
  }

  return (
    <nav className="bg-brand-700 text-white shadow-md sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-6">
        <div className="flex justify-between items-center h-14">
          <Link to="/dashboard" className="flex items-center gap-2">
            <UtensilsCrossed className="h-5 w-5" />
            <span className="font-bold text-lg tracking-tight">NutriSense AI</span>
          </Link>

          <div className="hidden md:flex gap-5">
            {NAV.map(item => (
              <Link
                key={item.to} to={item.to}
                className={`flex items-center gap-1.5 text-sm hover:text-brand-100 transition-colors ${
                  isActive(item.to) ? 'text-brand-100 border-b-2 border-brand-100' : ''
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            ))}
          </div>

          <button onClick={handleSignOut} className="flex items-center gap-1.5 text-sm opacity-80 hover:opacity-100 transition-opacity">
            <LogOut className="h-4 w-4" />
            <span className="hidden md:inline">Sign Out</span>
          </button>
        </div>
      </div>
    </nav>
  )
}
