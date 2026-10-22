"use client";

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Users, 
  Flame,
  Timer,
  Trophy,
  LogOut, 
  Settings
} from 'lucide-react';
import { createClient } from '@/src/utils/supabase/client';
import { useState, useEffect } from 'react';
import { isSuperAdmin } from '@/src/utils/permissions';

type SubItem = {
  name: string;
  href: string;
};

type MenuItem = {
  name: string;
  icon: any;
  href?: string;
  subItems?: SubItem[];
};

type MenuGroup = {
  title: string;
  items: MenuItem[];
};

const menuGroups: MenuGroup[] = [
  {
    title: 'Competición Hyrox',
    items: [
      { name: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
      { name: 'Día de Competición', href: '/admin/carrera', icon: Timer },
      { name: 'Leaderboard Oficial', href: '/admin/leaderboard', icon: Trophy },
      { name: 'Gestión de Heats', href: '/admin/heats', icon: Flame },
      { name: 'Atletas', href: '/admin/atletas', icon: Users },
    ]
  }
];

interface SidebarProps {
  initialRole?: string;
  initialName?: string;
  initialEmail?: string;
}

export default function Sidebar({ initialRole, initialName, initialEmail }: SidebarProps = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();
  
  const [role, setRole] = useState<string>(initialRole || 'ADMIN');
  const [userName, setUserName] = useState<string>(initialName || 'Administrador');
  const [userEmail, setUserEmail] = useState<string>(initialEmail || '');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.email) {
        if (!initialName) setUserName(session.user.user_metadata?.name || 'Administrador');
        if (!initialEmail) setUserEmail(session.user.email || '');

        if (!initialRole) {
          supabase
            .from('usuarios')
            .select('rol, nombres')
            .eq('email', session.user.email)
            .maybeSingle()
            .then(({ data, error }) => {
              if (!error && data?.rol) {
                setRole(data.rol);
                if (data.nombres) setUserName(data.nombres);
              }
            });
        }
      }
    });
  }, [supabase, initialRole, initialName, initialEmail]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/admin/login');
    router.refresh();
  };

  return (
    <aside className="w-64 h-full bg-zinc-950/90 backdrop-blur-2xl border-r border-white/10 flex flex-col shadow-2xl z-50 shrink-0">
      
      {/* Brand Header */}
      <div className="p-6 border-b border-white/5">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-7 h-7 rounded-lg bg-[#02D7E5]/10 border border-[#02D7E5]/30 flex items-center justify-center text-[#02D7E5]">
            <Flame className="w-4 h-4 text-[#02D7E5]" />
          </div>
          <span className="text-[10px] font-bold text-[#02D7E5] uppercase tracking-widest">
            Hyrox Race Director
          </span>
        </div>
        <h2 className="text-xl font-bold italic text-white tracking-wide">
          Fitness <span className="text-[#02D7E5]">Factory</span>
        </h2>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-6">
        {menuGroups.map((group, idx) => (
          <div key={idx}>
            <h3 className="px-3 text-[10px] uppercase tracking-widest text-zinc-500 font-bold mb-2">
              {group.title}
            </h3>
            <ul className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href || (item.href !== '/admin/dashboard' && pathname?.startsWith(item.href || ''));

                return (
                  <li key={item.name}>
                    <Link
                      href={item.href || '#'}
                      className={`flex items-center gap-3 px-3.5 py-2.5 rounded-2xl transition-all duration-200 group text-xs font-bold ${
                        isActive 
                          ? 'text-black bg-[#02D7E5] shadow-[0_4px_15px_rgba(2,215,229,0.3)]' 
                          : 'text-zinc-400 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      <Icon className={`w-4 h-4 transition-transform ${isActive ? 'text-black' : 'text-zinc-400 group-hover:text-[#02D7E5]'}`} />
                      <span className="tracking-wide">{item.name}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Perfil Inferior Limpio (Sin selector de sede) */}
      <div className="flex items-center gap-3 p-4 border-t border-white/5 bg-black/40">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#02D7E5] to-cyan-700 flex items-center justify-center text-black font-extrabold text-xs shadow-md shadow-[#02D7E5]/20 shrink-0">
          {userName.substring(0, 2).toUpperCase()}
        </div>
        <div className="flex-1 overflow-hidden">
          <p className="text-xs font-bold text-white truncate">{userName}</p>
          <p className="text-[10px] text-zinc-500 truncate">{userEmail || 'admin@hyrox.local'}</p>
        </div>

        <button
          onClick={handleLogout}
          title="Cerrar Sesión"
          className="p-2 rounded-xl text-zinc-500 hover:bg-red-500/10 hover:text-red-400 transition-colors shrink-0"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
      
    </aside>
  );
}
