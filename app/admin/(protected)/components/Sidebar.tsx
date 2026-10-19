"use client";

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Users, 
  CreditCard, 
  UserCheck, 
  LogOut, 
  ChevronDown, 
  Box,
  CalendarDays,
  MapPin,
  TrendingUp,
  Settings
} from 'lucide-react';
import { createClient } from '@/src/utils/supabase/client';
import { useState, useEffect } from 'react';
import { useTenant } from './TenantProvider';
import { hasFinanceAccess, isSuperAdmin } from '@/src/utils/permissions';
import toast from 'react-hot-toast';

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
    title: 'Principal',
    items: [
      { name: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
      { name: 'Indicadores (KPIs)', href: '/admin/kpis', icon: TrendingUp },
    ]
  },
  {
    title: 'Gestión',
    items: [
      { 
        name: 'Catálogo', 
        icon: Box, 
        subItems: [
          { name: 'Disciplinas', href: '/admin/disciplinas' },
          { name: 'Planes', href: '/admin/catalogo/planes' },
          { name: 'Sede', href: '/admin/sede' }
        ] 
      },
      { name: 'Calendario', href: '/admin/calendario', icon: CalendarDays },
      { 
        name: 'Finanzas & Cobranza', 
        icon: CreditCard,
        subItems: [
          { name: 'Dashboard', href: '/admin/finanzas/dashboard' },
          { name: 'Cobros', href: '/admin/finanzas/cobros' },
          { name: 'Auditoría', href: '/admin/finanzas/cobros/auditoria' },
          { name: 'Webhooks', href: '/admin/finanzas/cobros/webhooks' }
        ]
      },
      { name: 'Usuarios', href: '/admin/usuarios', icon: Users },
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
  const { sedes, activeSede, setActiveSede } = useTenant();
  
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({});
  const [isSedeDropdownOpen, setIsSedeDropdownOpen] = useState(false);
  const [role, setRole] = useState<string>(initialRole || 'RECEPCION');
  const [userName, setUserName] = useState<string>(initialName || 'Usuario');
  const [userEmail, setUserEmail] = useState<string>(initialEmail || '');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.email) {
        if (!initialName) setUserName(session.user.user_metadata?.name || 'Administrador');
        if (!initialEmail) setUserEmail(session.user.email || '');

        if (!initialRole) {
          // Obtener el rol real directamente de la base de datos
          supabase
            .from('usuarios')
            .select('rol')
            .eq('email', session.user.email)
            .single()
            .then(({ data, error }) => {
              if (!error && data?.rol) {
                setRole(data.rol);
              } else {
                setRole(session.user.user_metadata?.role || 'RECEPCION');
              }
            });
        }
      }
    });
  }, [supabase, initialRole, initialName, initialEmail]);

  const isHighManagement = hasFinanceAccess(role);

  const filteredMenuGroups = menuGroups.map(group => ({
    ...group,
    items: group.items.filter(item => {
      // Ocultar Finanzas & Cobranza e Indicadores (KPIs) para RECEPCIONISTA / roles no gerenciales
      if (item.name === 'Finanzas & Cobranza' || item.name === 'Indicadores (KPIs)') {
        return isHighManagement;
      }
      return true;
    })
  })).filter(group => group.items.length > 0);

  const toggleMenu = (name: string) => {
    setOpenMenus(prev => ({
      ...prev,
      [name]: !prev[name]
    }));
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/admin/login');
  };

  const isSubItemActive = (subItems: SubItem[]) => {
    return subItems.some(item => pathname === item.href);
  };

  return (
    <aside className="w-72 h-full bg-white/5 backdrop-blur-2xl border-r border-white/10 flex flex-col shadow-2xl z-50">
      
      {/* Brand Header */}
      <div className="p-6">
        <h2 className="text-2xl font-bold italic text-white tracking-wide">
          Fitness <span className="text-[#02D7E5]">Factory</span>
        </h2>
        <p className="text-[10px] text-gray-500 mt-1 uppercase tracking-widest font-semibold">
          Admin Workspace
        </p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
        {filteredMenuGroups.map((group, idx) => (
          <div key={idx} className={idx > 0 ? "mt-8" : "mt-2"}>
            <h3 className="px-3 text-[10px] uppercase tracking-widest text-white/40 font-semibold mb-2">
              {group.title}
            </h3>
            <ul className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const hasSubItems = !!item.subItems;
                const isActive = item.href ? pathname === item.href : (hasSubItems && isSubItemActive(item.subItems!));
                const isOpen = openMenus[item.name] || isActive;

                return (
                  <li key={item.name}>
                    {hasSubItems ? (
                      <div>
                        <button
                          onClick={() => toggleMenu(item.name)}
                          className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-300 group ${
                            isActive 
                              ? 'text-white bg-white/5' 
                              : 'text-white/60 hover:bg-white/5 hover:text-white'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <Icon strokeWidth={1.5} className={`w-5 h-5 transition-colors ${isActive ? 'text-[#02D7E5]' : 'group-hover:text-[#02D7E5]'}`} />
                            <span className="font-medium text-sm tracking-wide">{item.name}</span>
                          </div>
                          <ChevronDown 
                            strokeWidth={1.5}
                            className={`w-4 h-4 transition-transform duration-300 ${isOpen ? 'rotate-180 text-[#02D7E5]' : ''}`} 
                          />
                        </button>
                        
                        {/* Submenú con animación Grid */}
                        <div className={`grid transition-all duration-300 ease-in-out ${isOpen ? 'grid-rows-[1fr] opacity-100 mt-1' : 'grid-rows-[0fr] opacity-0'}`}>
                          <div className="overflow-hidden">
                            <ul className="ml-5 pl-4 border-l border-white/10 mt-2 flex flex-col gap-2">
                              {item.subItems!.map((subItem) => {
                                const isSubActive = pathname === subItem.href;
                                return (
                                  <li key={subItem.name}>
                                    <Link
                                      href={subItem.href}
                                      className={`block py-2 px-3 rounded-lg text-sm transition-all duration-300 ${
                                        isSubActive
                                          ? 'text-[#02D7E5] bg-transparent font-medium'
                                          : 'text-white/40 hover:text-white transition-colors bg-transparent'
                                      }`}
                                    >
                                      {subItem.name}
                                    </Link>
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <Link
                        href={item.href!}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group ${
                          isActive 
                            ? 'text-white bg-white/5' 
                            : 'text-white/60 hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        <Icon strokeWidth={1.5} className={`w-5 h-5 transition-colors ${isActive ? 'text-[#02D7E5]' : 'group-hover:text-[#02D7E5]'}`} />
                        <span className="font-medium text-sm tracking-wide">{item.name}</span>
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Sede Switcher Pixel-Perfect */}
      <div className="px-4 pb-4 mt-auto">
        <div className="relative">
          <button 
            onClick={() => setIsSedeDropdownOpen(!isSedeDropdownOpen)}
            className="w-full flex items-center justify-between p-3 rounded-xl bg-black/40 border border-white/10 hover:bg-black/60 transition-colors group"
          >
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-8 h-8 rounded-lg bg-[#02D7E5]/10 flex items-center justify-center shrink-0">
                <MapPin className="w-4 h-4 text-[#02D7E5]" />
              </div>
              <div className="flex-1 text-left truncate">
                <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">Sede Activa</p>
                <p className="text-sm font-medium text-white truncate">
                  {activeSede?.nombre || "Seleccionar Sede"}
                </p>
              </div>
            </div>
            <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform duration-300 ${isSedeDropdownOpen ? 'rotate-180 text-white' : 'group-hover:text-white'}`} />
          </button>
          
          {/* Dropdown de Sedes */}
          <div className={`absolute bottom-full left-0 w-full mb-2 bg-[#0a0a0a] border border-white/10 rounded-xl overflow-hidden shadow-2xl transition-all duration-300 origin-bottom ${
            isSedeDropdownOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
          }`}>
            <ul className="max-h-48 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
              {sedes.map((sede) => (
                <li key={sede.id}>
                  <button
                    onClick={() => {
                      setActiveSede(sede);
                      setIsSedeDropdownOpen(false);
                    }}
                    className={`w-full text-left px-4 py-3 text-sm transition-colors ${
                      activeSede?.id === sede.id 
                        ? 'bg-[#02D7E5]/10 text-[#02D7E5] font-medium' 
                        : 'text-gray-400 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    {sede.nombre}
                  </button>
                </li>
              ))}
              {sedes.length === 0 && (
                <li className="px-4 py-3 text-sm text-gray-500">No hay sedes disponibles</li>
              )}
            </ul>
          </div>
        </div>
      </div>

      {/* Perfil Inferior Pixel-Perfect */}
      <div className="flex flex-row items-center gap-3 p-4 border-t border-white/5">
        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#02D7E5] to-blue-600 flex items-center justify-center text-white font-bold text-sm shadow-[0_0_15px_rgba(2,215,229,0.3)] shrink-0">
          {userName.substring(0, 2).toUpperCase()}
        </div>
        <div className="flex-1 overflow-hidden">
          <p className="text-sm font-semibold text-white truncate">{userName}</p>
          <p className="text-[11px] text-gray-500 truncate mt-0.5">{userEmail}</p>
        </div>
        
        {/* Botón Tuerca: Gestión de Staff (SUPERADMIN) */}
        {isSuperAdmin(role) && (
          <Link
            href="/admin/configuracion"
            title="Configuración del Sistema / Gestión de Staff"
            className={`p-2 rounded-xl transition-colors duration-300 ml-auto shrink-0 group ${
              pathname === '/admin/configuracion' 
                ? 'bg-[#02D7E5]/10 text-[#02D7E5]' 
                : 'text-gray-400 hover:bg-white/10 hover:text-[#02D7E5]'
            }`}
          >
            <Settings strokeWidth={1.5} className="w-5 h-5 transition-transform duration-300 group-hover:rotate-45" />
          </Link>
        )}

        <button
          onClick={handleLogout}
          title="Cerrar Sesión"
          className={`p-2 rounded-xl text-gray-500 hover:bg-red-500/10 hover:text-red-400 transition-colors duration-300 shrink-0 group ${!isSuperAdmin(role) ? 'ml-auto' : ''}`}
        >
          <LogOut strokeWidth={1.5} className="w-5 h-5 transition-colors group-hover:text-red-400" />
        </button>
      </div>
      
    </aside>
  );
}
