'use client'

import { useState } from 'react'
import { formatCaracasDate, formatCaracasTime } from '@/src/utils/timezone'
import { CheckCircle, XCircle, ChevronLeft, ChevronRight } from 'lucide-react'

interface ClientTablesProps {
  reservas: any[];
  ordenes: any[];
  modificadoresMap: Record<string, string>;
}

export default function ClientTables({ reservas, ordenes, modificadoresMap }: ClientTablesProps) {
  const [reservasPage, setReservasPage] = useState(1);
  const [ordenesPage, setOrdenesPage] = useState(1);
  
  const itemsPerPage = 5;

  // Pagination logic for Reservas
  const totalReservasPages = Math.ceil(reservas.length / itemsPerPage);
  const paginatedReservas = reservas.slice((reservasPage - 1) * itemsPerPage, reservasPage * itemsPerPage);

  // Pagination logic for Ordenes
  const totalOrdenesPages = Math.ceil(ordenes.length / itemsPerPage);
  const paginatedOrdenes = ordenes.slice((ordenesPage - 1) * itemsPerPage, ordenesPage * itemsPerPage);

  return (
    <div className="space-y-6">
      {/* TABS DE HISTORIAL - RESERVAS */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-sm flex flex-col">
        <div className="p-6 border-b border-zinc-800">
          <h2 className="text-xl font-bold text-white">Últimas Clases (Reservas)</h2>
        </div>
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead className="bg-zinc-800/50">
              <tr className="border-b border-zinc-800/50 text-sm text-zinc-400">
                <th className="py-3 font-medium whitespace-nowrap px-6">Disciplina</th>
                <th className="py-3 font-medium whitespace-nowrap px-6">Fecha</th>
                <th className="py-3 font-medium whitespace-nowrap px-6">Hora</th>
                <th className="py-3 font-medium whitespace-nowrap px-6">Estado</th>
                <th className="py-3 font-medium whitespace-nowrap px-6">Reservado El</th>
                <th className="py-3 font-medium whitespace-nowrap px-6">Modificado Por</th>
              </tr>
            </thead>
            <tbody>
              {paginatedReservas && paginatedReservas.length > 0 ? paginatedReservas.map((reserva: any) => {
                const rawClase = reserva.clases_programadas;
                const clase = Array.isArray(rawClase) ? rawClase[0] : rawClase;
                const disciplinaNombre = Array.isArray(clase?.disciplinas) ? clase.disciplinas[0]?.nombre : clase?.disciplinas?.nombre;

                return (
                  <tr key={reserva.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                    <td className="py-3 text-white px-6 whitespace-nowrap text-base font-medium">
                      {disciplinaNombre || clase?.nombre_clase || 'Clase'}
                    </td>
                    <td className="py-3 text-zinc-300 px-6 whitespace-nowrap text-sm" suppressHydrationWarning>
                      {clase?.fecha_hora_inicio ? formatCaracasDate(clase.fecha_hora_inicio) : '-'}
                    </td>
                    <td className="py-3 text-zinc-300 px-6 whitespace-nowrap text-sm" suppressHydrationWarning>
                      {clase?.fecha_hora_inicio ? formatCaracasTime(clase.fecha_hora_inicio) : '-'}
                    </td>
                    <td className="py-3 px-6 whitespace-nowrap">
                      {reserva.asistio_fisicamente ? (
                        <span className="flex items-center gap-1 text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-full w-max border border-emerald-500/20">
                          <CheckCircle className="w-3 h-3" /> ASISTIÓ
                        </span>
                      ) : reserva.estado_reserva === 'CANCELADA' ? (
                        <span className="flex items-center gap-1 text-xs font-bold text-red-400 bg-red-500/10 px-2 py-1 rounded-full w-max border border-red-500/20">
                          <XCircle className="w-3 h-3" /> CANCELADA
                        </span>
                      ) : reserva.estado_reserva === 'CONFIRMADA' ? (
                        <span className="flex items-center gap-1 text-xs font-bold text-blue-400 bg-blue-500/10 px-2 py-1 rounded-full w-max border border-blue-500/20">
                          <CheckCircle className="w-3 h-3" /> CONFIRMADA
                        </span>
                      ) : (
                        <span className="text-xs font-bold text-zinc-400 px-2 py-1">{reserva.estado_reserva}</span>
                      )}
                    </td>
                    <td className="py-3 text-zinc-400 text-sm px-6 whitespace-nowrap" suppressHydrationWarning>
                      {reserva.created_at ? formatCaracasDate(reserva.created_at) : '-'}
                    </td>
                    <td className="py-3 text-zinc-400 text-sm px-6 whitespace-nowrap">
                      {reserva.modificado_por ? (modificadoresMap[reserva.modificado_por] || 'Admin') : '-'}
                    </td>
                  </tr>
                )
              }) : (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-zinc-500">No hay reservas registradas</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {/* Pagination Reservas */}
        {totalReservasPages > 1 && (
          <div className="p-4 border-t border-zinc-800 flex justify-between items-center bg-zinc-900/50">
            <span className="text-sm text-zinc-400">Página {reservasPage} de {totalReservasPages}</span>
            <div className="flex gap-2">
              <button 
                onClick={() => setReservasPage(p => Math.max(1, p - 1))}
                disabled={reservasPage === 1}
                className="p-1 rounded bg-zinc-800 text-zinc-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button 
                onClick={() => setReservasPage(p => Math.min(totalReservasPages, p + 1))}
                disabled={reservasPage === totalReservasPages}
                className="p-1 rounded bg-zinc-800 text-zinc-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* TABS DE HISTORIAL - PAGOS */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-sm flex flex-col">
        <div className="p-6 border-b border-zinc-800">
          <h2 className="text-xl font-bold text-white">Historial de Pagos</h2>
        </div>
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead className="bg-zinc-800/50">
              <tr className="border-b border-zinc-800/50 text-sm text-zinc-400">
                <th className="py-3 font-medium px-6 whitespace-nowrap">Fecha</th>
                <th className="py-3 font-medium px-6 whitespace-nowrap">Concepto</th>
                <th className="py-3 font-medium px-6 whitespace-nowrap">Monto</th>
                <th className="py-3 font-medium px-6 whitespace-nowrap">Método</th>
                <th className="py-3 font-medium px-6 whitespace-nowrap">Estado</th>
              </tr>
            </thead>
            <tbody>
              {paginatedOrdenes && paginatedOrdenes.length > 0 ? paginatedOrdenes.map((orden: any) => {
                const metadata = typeof orden.metadata === 'string' ? JSON.parse(orden.metadata) : (orden.metadata || {});
                return (
                  <tr key={orden.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                    <td className="py-3 text-white px-6 whitespace-nowrap text-sm" suppressHydrationWarning>
                      {orden.created_at ? formatCaracasDate(orden.created_at) : '-'}
                    </td>
                    <td className="py-3 text-zinc-300 px-6 whitespace-nowrap text-base font-medium">Pago Suscripción</td>
                    <td className="py-3 font-bold text-white px-6 whitespace-nowrap text-base">
                      ${orden.monto}
                    </td>
                    <td className="py-3 text-zinc-400 text-sm px-6 whitespace-nowrap">
                      {metadata.metodo_pago || 'N/A'}
                    </td>
                    <td className="py-3 px-6 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded-full text-xs font-bold border ${
                        orden.estado === 'APROBADO' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                        orden.estado === 'PENDIENTE' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
                        'bg-red-500/10 text-red-400 border-red-500/20'
                      }`}>
                        {orden.estado}
                      </span>
                    </td>
                  </tr>
                )
              }) : (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-zinc-500">No hay pagos registrados</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {/* Pagination Pagos */}
        {totalOrdenesPages > 1 && (
          <div className="p-4 border-t border-zinc-800 flex justify-between items-center bg-zinc-900/50">
            <span className="text-sm text-zinc-400">Página {ordenesPage} de {totalOrdenesPages}</span>
            <div className="flex gap-2">
              <button 
                onClick={() => setOrdenesPage(p => Math.max(1, p - 1))}
                disabled={ordenesPage === 1}
                className="p-1 rounded bg-zinc-800 text-zinc-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button 
                onClick={() => setOrdenesPage(p => Math.min(totalOrdenesPages, p + 1))}
                disabled={ordenesPage === totalOrdenesPages}
                className="p-1 rounded bg-zinc-800 text-zinc-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
