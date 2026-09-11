'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, CalendarDays, MessageSquare, User } from 'lucide-react'

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-sm bg-zinc-900/60 backdrop-blur-xl border border-zinc-800 rounded-full px-6 py-4 flex justify-between items-center z-50 shadow-2xl">
      <Link href="/dashboard" className={`flex flex-col items-center gap-1 ${pathname === '/dashboard' ? 'text-brand-primary' : 'text-zinc-500 hover:text-zinc-300'} transition-colors`}>
        <Home className="w-6 h-6" />
      </Link>
      <Link href="/dashboard/reservas" className={`flex flex-col items-center gap-1 ${pathname === '/dashboard/reservas' ? 'text-brand-primary' : 'text-zinc-500 hover:text-zinc-300'} transition-colors`}>
        <CalendarDays className="w-6 h-6" />
      </Link>
      <Link href="/dashboard/messages" className={`flex flex-col items-center gap-1 ${pathname === '/dashboard/messages' ? 'text-brand-primary' : 'text-zinc-500 hover:text-zinc-300'} transition-colors`}>
        <MessageSquare className="w-6 h-6" />
      </Link>
      <Link href="/dashboard/perfil" className={`flex flex-col items-center gap-1 ${pathname === '/dashboard/perfil' ? 'text-brand-primary' : 'text-zinc-500 hover:text-zinc-300'} transition-colors`}>
        <User className="w-6 h-6" />
      </Link>
    </nav>
  )
}
