'use client'

import { useState } from 'react'
import { Pencil, Loader2, X } from 'lucide-react'
import { formatCaracasDate } from '@/src/utils/timezone'
import { actualizarFechaCorteManual } from '../actions'

interface Props {
  suscripcionId: string;
  fechaCorteActual: string | null;
  currentUserRole: string;
}

export default function EditFechaCorte({ suscripcionId, fechaCorteActual, currentUserRole }: Props) {
  const isAuthorized = ['SUPERADMIN', 'ADMIN', 'GERENTE', 'ENCARGADO'].includes(currentUserRole);
  const [isOpen, setIsOpen] = useState(false);
  const [nuevaFecha, setNuevaFecha] = useState(fechaCorteActual ? fechaCorteActual.split('T')[0] : '');
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState('');

  if (!isAuthorized) {
    return <p className="text-base font-medium text-white" suppressHydrationWarning>{fechaCorteActual ? formatCaracasDate(fechaCorteActual) : 'N/A'}</p>;
  }

  const handleSave = async () => {
    if (!nuevaFecha) return;
    setIsPending(true);
    setError('');
    try {
      await actualizarFechaCorteManual(suscripcionId, nuevaFecha);
      setIsOpen(false);
    } catch (err: any) {
      setError(err.message || 'Error al actualizar la fecha');
    } finally {
      setIsPending(false);
    }
  }

  return (
    <>
      <div className="flex items-center gap-2 text-base font-medium text-white" suppressHydrationWarning>
        {fechaCorteActual ? formatCaracasDate(fechaCorteActual) : 'N/A'}
        <button 
          onClick={() => setIsOpen(true)}
          className="p-1 rounded bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
          title="Editar Fecha de Vencimiento"
        >
          <Pencil className="w-4 h-4" />
        </button>
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 w-full max-w-sm shadow-xl relative">
            <button 
              onClick={() => setIsOpen(false)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-xl font-bold text-white mb-4">Editar Vencimiento</h3>
            
            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Nueva Fecha de Corte</label>
                <input 
                  type="date"
                  value={nuevaFecha}
                  onChange={(e) => setNuevaFecha(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-lg p-2 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setIsOpen(false)}
                  disabled={isPending}
                  className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={isPending || !nuevaFecha}
                  className="px-4 py-2 text-sm bg-emerald-500 hover:bg-emerald-600 text-black font-bold rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  Guardar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
