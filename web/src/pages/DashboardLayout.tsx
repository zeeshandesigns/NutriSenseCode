import { Outlet } from 'react-router-dom'
import Navbar from '../components/Navbar'

export default function DashboardLayout() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-5xl mx-auto p-6">
        <Outlet />
      </main>
    </div>
  )
}
