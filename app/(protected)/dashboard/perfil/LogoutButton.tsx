'use client'

import { createClient } from '@/src/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { useState } from 'react'

export default function LogoutButton() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)

  const handleLogout = async () => {
    setLoading(true)
    try {
      await supabase.auth.signOut()
      router.push('/login')
      router.refresh()
    } catch (err) {
      console.error('Error al cerrar sesión:', err)
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      className="w-full flex items-center justify-center gap-2 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 hover:text-red-300 active:scale-[0.98] transition-all font-bold text-sm tracking-wide disabled:opacity-50"
    >
      <LogOut className="w-4 h-4" />
      <span>{loading ? 'Cerrando sesión...' : 'Cerrar Sesión'}</span>
    </button>
  )
}
