'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Settings, 
  UserPlus, 
  ShieldCheck, 
  Search, 
  Building, 
  Mail, 
  CreditCard, 
  Users, 
  CheckCircle2 
} from 'lucide-react'
import ModalCrearStaff from './ModalCrearStaff'

interface StaffUser {
  id: string
  nombre_completo: string | null
  email: string | null
  cedula_rif: string | null
  rol: string
  sede_id: string | null
  sedes?: { id: string; nombre: string } | null
}

interface Sede {
  id: string
  nombre: string
}

interface Props {
  initialStaff: StaffUser[]
  sedes: Sede[]
}

export default function ConfiguracionClient({ initialStaff, sedes }: Props) {
  const router = useRouter()
  const [searchTerm, setSearchTerm] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)

  // Filtro de búsqueda
  const filteredStaff = initialStaff.filter((member) => {
    const q = searchTerm.toLowerCase()
    const nameMatch = member.nombre_completo?.toLowerCase().includes(q)
    const emailMatch = member.email?.toLowerCase().includes(q)
    const cedulaMatch = member.cedula_rif?.toLowerCase().includes(q)
    const rolMatch = member.rol?.toLowerCase().includes(q)
    const sedeMatch = member.sedes?.nombre?.toLowerCase().includes(q)
    return nameMatch || emailMatch || cedulaMatch || rolMatch || sedeMatch
  })

  // Conteo de roles para métricas
  const totalStaff = initialStaff.length
  const recepcionistasCount = initialStaff.filter(s => s.rol === 'RECEPCIONISTA' || s.rol === 'RECEPCION').length
  const gerentesCount = initialStaff.filter(s => s.rol.includes('GERENTE') || s.rol === 'SUPERADMIN').length

  const getRoleBadge = (rol: string) => {
    const r = rol.toUpperCase()
    if (r === 'SUPERADMIN') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
          <ShieldCheck className="w-3 h-3" /> SUPERADMIN
        </span>
      )
    }
    if (r.includes('GERENTE')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-[#02D7E5]/10 text-[#02D7E5] border border-[#02D7E5]/20">
          <ShieldCheck className="w-3 h-3" /> {r === 'GERENTE_SEDE' ? 'GERENTE DE SEDE' : 'GERENTE'}
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
        <Users className="w-3 h-3" /> RECEPCIONISTA
      </span>
    )
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-300">
      {/* Encabezado Principal */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/10">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-[#02D7E5]/10 border border-[#02D7E5]/20 rounded-2xl text-[#02D7E5] shadow-[0_0_20px_rgba(2,215,229,0.15)]">
            <Settings className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Configuración del Sistema
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              Control de acceso administrativo y asignación de personal por sede
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#02D7E5] hover:bg-[#02D7E5]/90 text-black font-bold text-sm transition-all shadow-[0_0_20px_rgba(2,215,229,0.25)] shrink-0"
        >
          <UserPlus className="w-4 h-4" />
          + Nuevo Miembro del Staff
        </button>
      </div>

      {/* KPI Cards Resumen */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/10 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Staff</p>
            <p className="text-2xl font-bold text-white mt-1">{totalStaff}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-300">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/10 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Recepcionistas</p>
            <p className="text-2xl font-bold text-emerald-400 mt-1">{recepcionistasCount}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/10 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Gerencia & Superadmin</p>
            <p className="text-2xl font-bold text-[#02D7E5] mt-1">{gerentesCount}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#02D7E5]/10 border border-[#02D7E5]/20 flex items-center justify-center text-[#02D7E5]">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Sección: Gestión de Staff */}
      <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/10 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">Gestión de Staff</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Personal activo con acceso al panel de administración
            </p>
          </div>

          {/* Buscador */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-gray-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nombre, correo o rol..."
              className="w-full bg-black/40 border border-white/10 text-white text-xs rounded-xl pl-9 pr-4 py-2.5 focus:outline-none focus:border-[#02D7E5] transition-colors"
            />
          </div>
        </div>

        {/* Tabla de Staff */}
        <div className="overflow-x-auto rounded-xl border border-white/5">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 bg-black/40 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                <th className="py-3.5 px-4">Miembro del Staff</th>
                <th className="py-3.5 px-4">Cédula / RIF</th>
                <th className="py-3.5 px-4">Rol Asignado</th>
                <th className="py-3.5 px-4">Sede Principal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-sm">
              {filteredStaff.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-gray-500 text-xs">
                    No se encontraron miembros del personal con ese criterio de búsqueda.
                  </td>
                </tr>
              ) : (
                filteredStaff.map((member) => (
                  <tr key={member.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#02D7E5]/20 to-blue-500/20 border border-white/10 flex items-center justify-center font-bold text-xs text-white shrink-0">
                          {(member.nombre_completo || member.email || 'FF')
                            .substring(0, 2)
                            .toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-white text-sm truncate">
                            {member.nombre_completo || 'Sin nombre registrado'}
                          </p>
                          <p className="text-xs text-gray-400 truncate flex items-center gap-1 mt-0.5">
                            <Mail className="w-3 h-3 text-gray-500" />
                            {member.email || 'Sin correo'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-gray-300">
                      {member.cedula_rif || 'N/A'}
                    </td>
                    <td className="py-3.5 px-4">
                      {getRoleBadge(member.rol)}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-white/5 border border-white/10 text-gray-300">
                        <Building className="w-3 h-3 text-[#02D7E5]" />
                        {member.sedes?.nombre || 'Todas / Central'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Creación */}
      <ModalCrearStaff
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        sedes={sedes}
        onSuccess={() => {
          router.refresh()
        }}
      />
    </div>
  )
}
