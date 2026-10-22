'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Trophy, User } from 'lucide-react'

export function BottomNav() {
  const pathname = usePathname()

  const navItems = [
    {
      href: '/dashboard',
      label: 'Inicio',
      icon: Home,
      isActive: pathname === '/dashboard'
    },
    {
      href: '/dashboard/competicion',
      label: 'Competición',
      icon: Trophy,
      isActive: pathname?.startsWith('/dashboard/competicion')
    },
    {
      href: '/dashboard/perfil',
      label: 'Perfil',
      icon: User,
      isActive: pathname?.startsWith('/dashboard/perfil')
    }
  ]

  return (
    <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[92%] max-w-sm bg-zinc-950/85 backdrop-blur-2xl border border-white/10 rounded-3xl px-6 py-2.5 flex justify-around items-center z-50 shadow-[0_10px_35px_rgba(0,0,0,0.8)]">
      {navItems.map((item) => {
        const Icon = item.icon
        const active = item.isActive
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center justify-center gap-1 transition-all duration-200 py-1 px-4 rounded-2xl ${
              active
                ? 'text-[#02D7E5]'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Icon className={`w-5 h-5 transition-transform ${active ? 'scale-110 stroke-[2.2]' : 'stroke-[1.6]'}`} />
            <span
              className={`text-[10px] tracking-tight transition-colors ${
                active ? 'font-medium text-[#02D7E5]' : 'font-light text-zinc-400'
              }`}
            >
              {item.label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
