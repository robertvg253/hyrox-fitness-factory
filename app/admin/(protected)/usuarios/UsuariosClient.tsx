'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Search, UserPlus } from 'lucide-react'
import { formatCaracasDate } from '@/src/utils/timezone'
import ModalCobroManual from '@/components/admin/ModalCobroManual'
import ModalNuevoAtleta from '@/components/admin/ModalNuevoAtleta'
import ModalAsignarPlan from '@/components/admin/ModalAsignarPlan'

type Orden = {
  id: string;
  estado: string;
  created_at: string;
}

type Suscripcion = {
  id: string;
  estado: string;
  fecha_corte: string;
  sesiones_restantes?: number | null;
  plan_id?: string;
  planes?: {
    id: string;
    nombre: string;
    precio_usd: number;
    sedes?: string[];
  };
  ordenes_cobro: Orden[];
}

type Usuario = {
  id: string;
  nombre_completo: string;
  telefono: string;
  etiqueta_lead?: string | null;
  suscripciones: Suscripcion[];
}

interface UsuariosClientProps {
  initialUsuarios: Usuario[];
  activeSedeId: string | null;
}

export default function UsuariosClient({ initialUsuarios, activeSedeId }: UsuariosClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  
  const [searchTerm, setSearchTerm] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isNuevoAtletaModalOpen, setIsNuevoAtletaModalOpen] = useState(false)
  const [isAsignarPlanModalOpen, setIsAsignarPlanModalOpen] = useState(false)
  
  const [selectedSubId, setSelectedSubId] = useState<string | null>(null)
  const [selectedPrecio, setSelectedPrecio] = useState<number>(30)
  
  const [selectedUsuarioForPlan, setSelectedUsuarioForPlan] = useState<{ id: string, nombre: string } | null>(null)

  const handleOpenModal = (subId: string, precio: number = 30) => {
    setSelectedSubId(subId)
    setSelectedPrecio(precio)
    setIsModalOpen(true)
  }

  const handleModalSuccess = () => {
    startTransition(() => {
      router.refresh()
    })
  }

  const handleNuevoAtletaSuccess = (usuarioCreado: any) => {
    setIsNuevoAtletaModalOpen(false)
    setSelectedUsuarioForPlan({ id: usuarioCreado.id, nombre: usuarioCreado.nombre_completo })
    setIsAsignarPlanModalOpen(true)
  }

  const handleOpenAsignarPlan = (id: string, nombre: string) => {
    setSelectedUsuarioForPlan({ id, nombre })
    setIsAsignarPlanModalOpen(true)
  }

  const filteredUsuarios = initialUsuarios.filter((u) => {
    const search = searchTerm.toLowerCase()
    return (
      (u.nombre_completo && u.nombre_completo.toLowerCase().includes(search)) ||
      (u.telefono && u.telefono.toLowerCase().includes(search))
    )
  })

  // Helper para saber si tiene cobro en tránsito
  const tieneCobroEnTransito = (suscripciones: any) => {
    if (!suscripciones) return false;
    const subsArray = Array.isArray(suscripciones) ? suscripciones : [suscripciones];
    if (subsArray.length === 0) return false;

    // Buscamos en todas las suscripciones (o la activa)
    for (const sub of subsArray) {
      if (!sub.ordenes_cobro) continue;
      const ordenesArray = Array.isArray(sub.ordenes_cobro) ? sub.ordenes_cobro : [sub.ordenes_cobro];
      
      if (ordenesArray.length === 0) continue;

      // Ordenar descendente por fecha para tener la más reciente de primera
      const ordenesOrdenadas = [...ordenesArray].sort((a: any, b: any) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      // Solo evaluamos la orden más reciente
      const ultimaOrden = ordenesOrdenadas[0];
      if (ultimaOrden.estado === 'PENDIENTE' || ultimaOrden.estado === 'ENVIADO') {
        return true;
      }
    }
    return false;
  }

  // Helper para obtener el estado principal de suscripción
  const getEstadoSuscripcion = (suscripciones: any) => {
    if (!suscripciones) return null;
    const subsArray = Array.isArray(suscripciones) ? suscripciones : [suscripciones];
    if (subsArray.length === 0) return null;
    const activa = subsArray.find((s: any) => s.estado === 'ACTIVO');
    return activa || subsArray[0];
  }

  return (
    <div className="space-y-6">
      {/* Barra de búsqueda y Acción */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-zinc-900/50 p-4 rounded-xl border border-white/5">
        <div className="relative w-full sm:w-auto sm:flex-1 max-w-md">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <Search className="w-5 h-5 text-zinc-500" />
          </div>
          <input
            type="text"
            className="w-full bg-black/40 border border-white/10 text-white text-sm rounded-lg focus:ring-[#02D7E5] focus:border-[#02D7E5] block pl-10 p-2.5 transition-colors placeholder-zinc-500"
            placeholder="Buscar por nombre o teléfono..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button
          onClick={() => setIsNuevoAtletaModalOpen(true)}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#02D7E5] hover:bg-[#02D7E5]/90 text-black font-bold rounded-lg transition-colors text-sm"
        >
          <UserPlus className="w-4 h-4" />
          Nuevo Atleta
        </button>
      </div>

      {/* Tabla de Usuarios */}
      <div className="rounded-md border border-zinc-800 bg-black/20">
        <div className="relative w-full overflow-auto">
          <table className="w-full caption-bottom text-sm">
            <thead className="[&_tr]:border-b [&_tr]:border-zinc-800">
              <tr className="border-b transition-colors hover:bg-zinc-800/50 data-[state=selected]:bg-zinc-800">
                <th className="h-12 px-4 text-left align-middle font-medium text-zinc-400">Usuario</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-zinc-400">Teléfono</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-zinc-400">Estado Suscripción</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-zinc-400">Fecha de Corte</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-zinc-400">Cobros</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-zinc-400">Acciones</th>
              </tr>
            </thead>
            <tbody className="[&_tr:last-child]:border-0">
              {filteredUsuarios.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-zinc-500">
                    No se encontraron usuarios que coincidan con la búsqueda.
                  </td>
                </tr>
              ) : (
                filteredUsuarios.map((usuario) => {
                  const subPrincipal = getEstadoSuscripcion(usuario.suscripciones);
                  const enTransito = tieneCobroEnTransito(usuario.suscripciones);

                  return (
                    <tr 
                      key={usuario.id} 
                      onClick={() => router.push(`/admin/usuarios/${usuario.id}`)}
                      className="border-b border-zinc-800/50 transition-colors hover:bg-zinc-800/50 cursor-pointer"
                    >
                      <td className="p-4 align-middle font-medium text-white">
                        {usuario.nombre_completo || 'Sin nombre'}
                      </td>
                      <td className="p-4 align-middle text-zinc-400">
                        {usuario.telefono || '-'}
                      </td>
                      <td className="p-4 align-middle">
                        {!subPrincipal ? (
                          <span className="text-zinc-600 text-xs font-medium">Sin suscripción</span>
                        ) : (usuario.etiqueta_lead === 'PRUEBA_PENDIENTE' || (subPrincipal.planes?.nombre || '').toLowerCase().includes('prueba') || (subPrincipal.planes?.nombre || '').toLowerCase().includes('cortes')) ? (
                          <span className="inline-flex items-center rounded-full bg-purple-500/10 px-2.5 py-0.5 text-xs font-semibold text-purple-400 border border-purple-500/20 whitespace-nowrap">
                            CLASE DE PRUEBA
                          </span>
                        ) : subPrincipal.estado === 'ACTIVO' ? (
                          <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-500 border border-emerald-500/20">
                            ACTIVO
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-red-500/10 px-2.5 py-0.5 text-xs font-semibold text-red-500 border border-red-500/20">
                            INACTIVO
                          </span>
                        )}
                      </td>
                      <td className="p-4 align-middle text-zinc-300 text-sm">
                        {subPrincipal?.sesiones_restantes != null 
                          ? <span className="inline-flex items-center rounded-full bg-purple-500/10 px-2.5 py-0.5 text-xs font-semibold text-purple-400 border border-purple-500/20">{subPrincipal.sesiones_restantes} Sesiones Restantes</span>
                          : subPrincipal?.fecha_corte 
                            ? formatCaracasDate(subPrincipal.fecha_corte)
                            : '-'}
                      </td>
                      <td className="p-4 align-middle">
                        {enTransito ? (
                          <span className="inline-flex items-center rounded-full bg-blue-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-blue-400 border border-blue-500/20 uppercase tracking-wider">
                            Cobro en Tránsito
                          </span>
                        ) : (
                          <span className="text-zinc-600 text-xs">-</span>
                        )}
                      </td>
                      <td className="p-4 align-middle">
                        {(!subPrincipal || (usuario.etiqueta_lead === 'PRUEBA_PENDIENTE' || (subPrincipal.planes?.nombre || '').toLowerCase().includes('prueba') || (subPrincipal.planes?.nombre || '').toLowerCase().includes('cortes'))) ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenAsignarPlan(usuario.id, usuario.nombre_completo);
                            }}
                            className="px-3 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-semibold rounded-lg transition-colors border border-emerald-500/20 whitespace-nowrap"
                          >
                            Crear Suscripción
                          </button>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenModal(subPrincipal.id, subPrincipal.planes?.precio_usd || 30);
                            }}
                            className="px-3 py-1 bg-[#02D7E5]/10 hover:bg-[#02D7E5]/20 text-[#02D7E5] text-xs font-semibold rounded-lg transition-colors border border-[#02D7E5]/20 whitespace-nowrap"
                          >
                            Pago Manual
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedSubId && (
        <ModalCobroManual
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          suscripcionId={selectedSubId}
          precioPlan={selectedPrecio}
          onSuccess={handleModalSuccess}
        />
      )}

      <ModalNuevoAtleta 
        isOpen={isNuevoAtletaModalOpen}
        onClose={() => setIsNuevoAtletaModalOpen(false)}
        onSuccess={handleNuevoAtletaSuccess}
      />

      {selectedUsuarioForPlan && (
        <ModalAsignarPlan
          isOpen={isAsignarPlanModalOpen}
          onClose={() => setIsAsignarPlanModalOpen(false)}
          usuarioId={selectedUsuarioForPlan.id}
          usuarioNombre={selectedUsuarioForPlan.nombre}
          sedeId={activeSedeId}
          onSuccess={handleModalSuccess}
        />
      )}
    </div>
  )
}
