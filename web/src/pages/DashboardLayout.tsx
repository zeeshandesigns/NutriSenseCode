import { Outlet } from 'react-router-dom'
import Navbar from '../components/Navbar'

export default function DashboardLayout() {
  return (
    <div className="min-h-screen bg-[#F8FAF9]">
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 md:px-6 py-8">
        <Outlet />
      </main>
    </div>
  )
}
