'use client'

import { useState, useEffect } from 'react'
import { Plus, Edit2, Loader2, AlertCircle } from 'lucide-react'
import ModalFormularioPlan from '@/components/admin/ModalFormularioPlan'
import { obtenerTodosLosPlanes, cambiarEstadoPlan } from './actions'
import toast from 'react-hot-toast'

export default function PlanesCatalogPage() {
  const [planes, setPlanes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [planToEdit, setPlanToEdit] = useState<any | null>(null)
  const [changingStatus, setChangingStatus] = useState<string | null>(null)

  const loadData = async () => {
    setLoading(true)
    try {
      const res = await obtenerTodosLosPlanes()
      if (res.success) {
        setPlanes(res.data || [])
      } else {
        toast.error('Error al cargar los planes')
      }
    } catch (err) {
      toast.error('Error de red al cargar planes')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleOpenModal = (plan?: any) => {
    setPlanToEdit(plan || null)
    setIsModalOpen(true)
  }

  const handleToggleEstado = async (plan: any) => {
    const nuevoEstado = plan.estado === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO'
    setChangingStatus(plan.id)
    try {
      const res = await cambiarEstadoPlan(plan.id, nuevoEstado)
      if (res.success) {
        toast.success(`Plan cambiado a ${nuevoEstado}`)
        loadData()
      } else {
        toast.error(res.error || 'Error al cambiar estado')
      }
    } catch (err) {
      toast.error('Error inesperado')
    } finally {
      setChangingStatus(null)
    }
  }

  const getStatusBadge = (estado: string) => {
    if (estado === 'ACTIVO') {
      return <span className="px-2.5 py-1 text-xs font-bold rounded-md bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">ACTIVO</span>
    }
    if (estado === 'INACTIVO') {
      return <span className="px-2.5 py-1 text-xs font-bold rounded-md bg-yellow-500/10 text-yellow-500 border border-yellow-500/20">INACTIVO</span>
    }
    return <span className="px-2.5 py-1 text-xs font-bold rounded-md bg-red-500/10 text-red-500 border border-red-500/20">ARCHIVADO</span>
  }

  return (
    <main className="p-6 max-w-7xl mx-auto space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Catálogo de Planes</h1>
          <p className="text-sm text-zinc-400 mt-1">Gestiona la oferta comercial y tarifas en todas las sedes.</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 bg-[#02D7E5] text-black font-bold px-4 py-2 rounded-lg hover:bg-[#02D7E5]/90 transition-colors shadow-lg shadow-[#02D7E5]/20"
        >
          <Plus className="w-5 h-5" />
          Nuevo Plan
        </button>
      </header>

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="text-zinc-500 border-b border-zinc-800">
              <tr>
                <th className="pb-4 font-medium">Nombre / Descripción</th>
                <th className="pb-4 font-medium">Precio (USD)</th>
                <th className="pb-4 font-medium">Vigencia</th>
                <th className="pb-4 font-medium">Sedes Habilitadas</th>
                <th className="pb-4 font-medium text-center">Estado</th>
                <th className="pb-4 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-zinc-500">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-[#02D7E5]" />
                    Cargando planes...
                  </td>
                </tr>
              ) : planes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-zinc-500 bg-zinc-900/30">
                    <AlertCircle className="w-8 h-8 mx-auto mb-3 opacity-50" />
                    No hay planes registrados en el catálogo.
                  </td>
                </tr>
              ) : (
                planes.map((plan) => (
                  <tr key={plan.id} className="hover:bg-zinc-800/30 transition-colors">
                    <td className="py-4">
                      <p className="font-bold text-white text-base">{plan.nombre}</p>
                      <p className="text-xs text-zinc-500 truncate max-w-xs">{plan.descripcion || 'Sin descripción'}</p>
                    </td>
                    <td className="py-4">
                      <span className="font-mono text-emerald-400 font-bold text-base">${plan.precio_usd}</span>
                    </td>
                    <td className="py-4 text-zinc-300">
                      {plan.frecuencia} Mes{plan.frecuencia !== 1 ? 'es' : ''}
                    </td>
                    <td className="py-4">
                      <div className="flex flex-wrap gap-1 max-w-[200px]">
                        {plan.nombres_sedes && plan.nombres_sedes.length > 0 ? (
                          plan.nombres_sedes.map((ns: string, i: number) => (
                            <span key={i} className="text-[10px] bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded-full border border-zinc-700">
                              {ns}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-zinc-500 italic">Ninguna</span>
                        )}
                      </div>
                    </td>
                    <td className="py-4 text-center">
                      <button 
                        onClick={() => handleToggleEstado(plan)}
                        disabled={changingStatus === plan.id}
                        className="hover:opacity-80 transition-opacity"
                        title="Clic para alternar estado"
                      >
                        {changingStatus === plan.id ? (
                          <Loader2 className="w-4 h-4 animate-spin mx-auto text-zinc-400" />
                        ) : (
                          getStatusBadge(plan.estado)
                        )}
                      </button>
                    </td>
                    <td className="py-4 text-right">
                      <button
                        onClick={() => handleOpenModal(plan)}
                        className="inline-flex items-center justify-center p-2 text-zinc-400 hover:text-[#02D7E5] hover:bg-zinc-800 rounded-lg transition-colors"
                        title="Editar Plan"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ModalFormularioPlan
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={loadData}
        planToEdit={planToEdit}
      />
    </main>
  )
}
