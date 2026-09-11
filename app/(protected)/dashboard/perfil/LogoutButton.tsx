'use client'

import { createClient } from '@/src/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'

export default function LogoutButton() {
  const router = useRouter()
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <button
      onClick={handleLogout}
      className="w-full flex items-center justify-center gap-2 p-4 mt-8 rounded-2xl bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors font-medium tracking-wide"
    >
      <LogOut className="w-5 h-5" />
      Cerrar Sesión
    </button>
  )
}
