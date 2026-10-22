'use client'

import { useState, useEffect } from 'react'
import { X, Loader2, Save } from 'lucide-react'
import toast from 'react-hot-toast'
import { obtenerSedesParaSelect, upsertPlan } from '@/app/admin/(protected)/planes/actions'

interface ModalFormularioPlanProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  planToEdit?: any | null
}

export default function ModalFormularioPlan({ isOpen, onClose, onSuccess, planToEdit }: ModalFormularioPlanProps) {
  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(false)
  
  const [nombre, setNombre] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [precioUsd, setPrecioUsd] = useState('0.00')
  const [frecuencia, setFrecuencia] = useState(1) // Por defecto 1 mes
  const [tipo, setTipo] = useState<'TIEMPO' | 'SESIONES'>('TIEMPO')
  const [sesionesTotal, setSesionesTotal] = useState<number | ''>('')
  const [estado, setEstado] = useState('ACTIVO')
  const [sedesSeleccionadas, setSedesSeleccionadas] = useState<string[]>([])
  
  const [sedesDisponibles, setSedesDisponibles] = useState<any[]>([])

  useEffect(() => {
    if (isOpen) {
      cargarSedes()
      if (planToEdit) {
        setNombre(planToEdit.nombre || '')
        setDescripcion(planToEdit.descripcion || '')
        setPrecioUsd(planToEdit.precio_usd?.toString() || '0.00')
        setFrecuencia(planToEdit.frecuencia || 1)
        setTipo(planToEdit.tipo || 'TIEMPO')
        setSesionesTotal(planToEdit.sesiones_total || '')
        setEstado(planToEdit.estado || 'ACTIVO')
        setSedesSeleccionadas(planToEdit.sedes || [])
      } else {
        // Formulario en blanco
        setNombre('')
        setDescripcion('')
        setPrecioUsd('0.00')
        setFrecuencia(1)
        setTipo('TIEMPO')
        setSesionesTotal('')
        setEstado('ACTIVO')
        setSedesSeleccionadas([])
      }
    }
  }, [isOpen, planToEdit])

  const cargarSedes = async () => {
    setLoadingData(true)
    try {
      const res = await obtenerSedesParaSelect()
      if (res.success) {
        setSedesDisponibles(res.data || [])
      } else {
        toast.error('Error al cargar sedes')
      }
    } catch (err) {
      toast.error('Error al cargar sedes')
    } finally {
      setLoadingData(false)
    }
  }

  const toggleSede = (sedeId: string) => {
    setSedesSeleccionadas(prev => 
      prev.includes(sedeId) 
        ? prev.filter(id => id !== sedeId)
        : [...prev, sedeId]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!nombre.trim()) {
      return toast.error('El nombre es obligatorio')
    }
    if (parseFloat(precioUsd) <= 0) {
      return toast.error('El precio debe ser mayor a 0')
    }
    if (tipo === 'TIEMPO' && frecuencia <= 0) {
      return toast.error('La vigencia (frecuencia) debe ser al menos de 1 mes')
    }
    if (tipo === 'SESIONES' && (sesionesTotal === '' || sesionesTotal <= 0)) {
      return toast.error('Debe ingresar una cantidad válida de sesiones')
    }

    setLoading(true)
    try {
      const payload = {
        id: planToEdit?.id,
        nombre: nombre.trim(),
        descripcion: descripcion.trim(),
        precio_usd: parseFloat(precioUsd),
        estado,
        sedes: sedesSeleccionadas,
        tipo,
        sesiones_total: tipo === 'SESIONES' ? Number(sesionesTotal) : null
      }

      const res = await upsertPlan(payload)
      if (res.success) {
        toast.success(planToEdit ? 'Plan actualizado exitosamente' : 'Plan creado exitosamente')
        onSuccess()
        onClose()
      } else {
        toast.error(res.error || 'Error al guardar el plan')
      }
    } catch (err: any) {
      toast.error('Error inesperado')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 w-full max-w-md bg-zinc-950 border-l border-white/10 z-50 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between p-6 border-b border-white/10 bg-zinc-900/50">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              {planToEdit ? 'Editar Plan' : 'Nuevo Plan'}
            </h2>
            <button type="button" onClick={onClose} className="p-2 text-zinc-400 hover:text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-white/10">
          {loadingData ? (
            <div className="flex justify-center p-8">
              <Loader2 className="w-8 h-8 animate-spin text-[#02D7E5]" />
            </div>
          ) : (
            <form id="plan-form" onSubmit={handleSubmit} className="space-y-6">
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1.5">Nombre del Plan <span className="text-red-400">*</span></label>
                  <input
                    type="text"
                    required
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-[#02D7E5] transition-colors"
                    placeholder="Ej. Plan Mensual Base"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1.5">Descripción (Opcional)</label>
                  <textarea
                    value={descripcion}
                    onChange={(e) => setDescripcion(e.target.value)}
                    rows={2}
                    className="w-full bg-zinc-900 border border-zinc-800 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-[#02D7E5] transition-colors resize-none"
                    placeholder="Detalles sobre lo que incluye el plan..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-zinc-400 mb-1.5">Precio (USD) <span className="text-red-400">*</span></label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 font-medium">$</span>
                      <input
                        type="number"
                        required
                        step="0.01"
                        min="0"
                        value={precioUsd}
                        onChange={(e) => setPrecioUsd(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 text-white rounded-xl pl-9 pr-4 py-3 focus:outline-none focus:border-[#02D7E5] transition-colors font-mono"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-400 mb-1.5">Tipo de Plan <span className="text-red-400">*</span></label>
                    <select
                      value={tipo}
                      onChange={(e) => setTipo(e.target.value as 'TIEMPO' | 'SESIONES')}
                      className="w-full bg-zinc-900 border border-zinc-800 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-[#02D7E5] transition-colors"
                    >
                      <option value="TIEMPO">Por Tiempo (Vigencia)</option>
                      <option value="SESIONES">Por Sesiones</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {tipo === 'TIEMPO' ? (
                    <div>
                      <label className="block text-sm font-medium text-zinc-400 mb-1.5">Vigencia (Meses) <span className="text-red-400">*</span></label>
                      <input
                        type="number"
                        required
                        min="1"
                        step="1"
                        value={frecuencia}
                        onChange={(e) => setFrecuencia(parseInt(e.target.value) || 1)}
                        className="w-full bg-zinc-900 border border-zinc-800 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-[#02D7E5] transition-colors"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="block text-sm font-medium text-zinc-400 mb-1.5">Cantidad de Sesiones <span className="text-red-400">*</span></label>
                      <input
                        type="number"
                        required
                        min="1"
                        step="1"
                        value={sesionesTotal}
                        onChange={(e) => setSesionesTotal(parseInt(e.target.value) || '')}
                        className="w-full bg-zinc-900 border border-zinc-800 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-[#02D7E5] transition-colors"
                        placeholder="Ej. 12"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-zinc-400 mb-1.5">Estado <span className="text-red-400">*</span></label>
                    <select
                      value={estado}
                      onChange={(e) => setEstado(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-[#02D7E5] transition-colors"
                    >
                      <option value="ACTIVO">ACTIVO (Visible para ventas)</option>
                      <option value="INACTIVO">INACTIVO (Pausado temporalmente)</option>
                      <option value="ARCHIVADO">ARCHIVADO (Retirado del catálogo)</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-white/5">
                <label className="block text-sm font-medium text-zinc-400 mb-3">Sedes Disponibles</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {sedesDisponibles.map(sede => (
                    <label key={sede.id} className="flex items-center gap-3 p-3 bg-zinc-900/50 hover:bg-zinc-800 border border-zinc-800 rounded-xl cursor-pointer transition-colors">
                      <input 
                        type="checkbox"
                        checked={sedesSeleccionadas.includes(sede.id)}
                        onChange={() => toggleSede(sede.id)}
                        className="w-4 h-4 rounded border-zinc-700 bg-zinc-900 text-[#02D7E5] focus:ring-[#02D7E5]"
                      />
                      <span className="text-sm text-zinc-300 select-none">{sede.nombre}</span>
                    </label>
                  ))}
                  {sedesDisponibles.length === 0 && (
                    <p className="text-zinc-500 text-sm">No hay sedes registradas en el sistema.</p>
                  )}
                </div>
              </div>

            </form>
          )}
        </div>

          <div className="p-6 border-t border-white/10 bg-zinc-900/50 mt-auto flex gap-3">
            <button 
              type="button" 
              onClick={onClose} 
              disabled={loading}
              className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-bold rounded-xl transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              form="plan-form"
              disabled={loading || loadingData}
              className="flex-[2] py-3 bg-[#02D7E5] hover:bg-[#02D7E5]/90 text-black font-bold rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-[#02D7E5]/20"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Save className="w-5 h-5" /> Guardar Plan</>}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
