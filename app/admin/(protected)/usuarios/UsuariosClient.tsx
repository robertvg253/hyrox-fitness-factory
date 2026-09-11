'use client'

import { useState } from 'react'
import { Search } from 'lucide-react'

type Orden = {
  id: string;
  estado: string;
  created_at: string;
}

type Suscripcion = {
  id: string;
  estado: string;
  fecha_corte: string;
  ordenes_cobro: Orden[];
}

type Usuario = {
  id: string;
  nombre_completo: string;
  telefono: string;
  suscripciones: Suscripcion[];
}

interface UsuariosClientProps {
  initialUsuarios: Usuario[];
}

export default function UsuariosClient({ initialUsuarios }: UsuariosClientProps) {
  const [searchTerm, setSearchTerm] = useState('')

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
      {/* Barra de búsqueda */}
      <div className="flex items-center gap-4 bg-zinc-900/50 p-4 rounded-xl border border-white/5">
        <div className="relative flex-1 max-w-md">
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
              </tr>
            </thead>
            <tbody className="[&_tr:last-child]:border-0">
              {filteredUsuarios.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-4 text-center text-zinc-500">
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
                      className="border-b border-zinc-800/50 transition-colors hover:bg-zinc-800/30"
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
                        {subPrincipal?.fecha_corte 
                          ? new Date(subPrincipal.fecha_corte).toLocaleDateString('es-ES')
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
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
