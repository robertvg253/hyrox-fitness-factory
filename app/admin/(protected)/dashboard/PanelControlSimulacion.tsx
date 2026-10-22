'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Trophy,
  Play,
  CheckCircle2,
  PlusCircle,
  Clock,
  Flame,
  Users,
  Timer,
  ArrowRight
} from 'lucide-react'
import toast from 'react-hot-toast'
import {
  crearSimulacion,
  cambiarEstadoSimulacion
} from './actions'

interface SimulacionData {
  id: string
  nombre: string
  estado: string
  tabla_liberada: boolean
  fecha_creacion: string
}

interface PanelControlProps {
  simulacion: SimulacionData | null
  totalAtletas: number
  totalAsignados: number
  totalTiemposRegistrados: number
}

export default function PanelControlSimulacion({
  simulacion,
  totalAtletas,
  totalAsignados,
  totalTiemposRegistrados
}: PanelControlProps) {
  const [loading, setLoading] = useState(false)
  const [nombreNueva, setNombreNueva] = useState('')
  const [mostrarModalCrear, setMostrarModalCrear] = useState(false)

  // Manejador para Crear Nueva Simulación
  const handleCrear = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setLoading(true)
    try {
      const res = await crearSimulacion(nombreNueva.trim() || undefined)
      if (res.success) {
        toast.success(`Simulación "${res.data.nombre}" creada exitosamente.`)
        setMostrarModalCrear(false)
        setNombreNueva('')
      } else {
        toast.error(res.error || 'Error al crear la simulación.')
      }
    } catch {
      toast.error('Error de conexión al crear simulación.')
    } finally {
      setLoading(false)
    }
  }

  // Visual Helper para Estado
  const getBadgeEstado = () => {
    if (!simulacion) {
      return (
        <span className="px-3 py-1 rounded-full text-xs font-bold bg-zinc-800 text-zinc-400 border border-zinc-700">
          SIN SIMULACIÓN ACTIVA
        </span>
      )
    }

    switch (simulacion.estado) {
      case 'PENDIENTE':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <Clock className="w-3.5 h-3.5" />
            PENDIENTE (ASIGNACIÓN)
          </span>
        )
      case 'EN_CURSO':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            EN CURSO (COMPITIENDO)
          </span>
        )
      case 'FINALIZADA':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#02D7E5]/15 text-[#02D7E5] border border-[#02D7E5]/30">
            <CheckCircle2 className="w-3.5 h-3.5" />
            FINALIZADA
          </span>
        )
      default:
        return null
    }
  }

  return (
    <section className="space-y-4">
      {/* Bento Grid Superior */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Card 1 (Span 2): Control Central de la Simulación */}
        <div className="lg:col-span-2 relative overflow-hidden rounded-3xl bg-zinc-950/80 backdrop-blur-xl border border-white/10 p-6 shadow-2xl flex flex-col justify-between">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#02D7E5] to-transparent opacity-80" />
          <div className="absolute -top-16 -right-16 w-44 h-44 bg-[#02D7E5]/10 rounded-full blur-3xl pointer-events-none" />

          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-[#02D7E5]" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                  Centro de Control Hyrox
                </span>
              </div>
              {getBadgeEstado()}
            </div>

            <div>
              <h2 className="text-2xl font-bold text-white tracking-tight">
                {simulacion?.nombre || 'Ninguna Competición Activa'}
              </h2>
              <p className="text-xs text-zinc-400 mt-1">
                {simulacion
                  ? `Estado actual del evento. Accede al módulo de Competición para la gestión de largada y registro de tiempos.`
                  : `Crea una nueva simulación para empezar a convocar atletas y asignar heats de salida.`}
              </p>
            </div>
          </div>

          {/* Botonera de Acciones del Dashboard */}
          <div className="pt-6 mt-4 border-t border-zinc-900 flex flex-wrap items-center gap-3">
            {/* Si no hay simulación */}
            {!simulacion ? (
              <button
                type="button"
                onClick={() => setMostrarModalCrear(true)}
                disabled={loading}
                className="px-6 py-3 bg-[#02D7E5] hover:bg-[#02D7E5]/90 text-black font-extrabold text-sm rounded-2xl transition-all shadow-[0_4px_20px_rgba(2,215,229,0.35)] flex items-center gap-2 active:scale-[0.98] disabled:opacity-50 cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Crear Nueva Simulación</span>
              </button>
            ) : (
              /* Si ya está creada: Botón "Ir a Competición" */
              <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                <Link
                  href="/admin/carrera"
                  className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-[#02D7E5] hover:from-emerald-400 hover:to-[#02D7E5]/90 text-black font-extrabold text-sm rounded-2xl transition-all shadow-[0_4px_20px_rgba(2,215,229,0.35)] flex items-center gap-2 active:scale-[0.98]"
                >
                  <Timer className="w-4 h-4 text-black" />
                  <span>Ir a Competición</span>
                  <ArrowRight className="w-4 h-4 text-black" />
                </Link>

                {simulacion.estado === 'FINALIZADA' && (
                  <button
                    type="button"
                    onClick={() => setMostrarModalCrear(true)}
                    disabled={loading}
                    className="px-4 py-3 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-bold text-xs rounded-2xl border border-zinc-800 transition-all flex items-center gap-2 cursor-pointer"
                  >
                    <PlusCircle className="w-3.5 h-3.5 text-[#02D7E5]" />
                    <span>Crear Siguiente Simulación</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Card 2: Métricas Bento Resumen */}
        <div className="rounded-3xl bg-zinc-950/80 backdrop-blur-xl border border-white/10 p-6 shadow-2xl flex flex-col justify-between space-y-4">
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#02D7E5]">
              Estadísticas de Jornada
            </span>
            <h3 className="text-base font-bold text-white tracking-tight">
              Métricas Operativas
            </h3>
          </div>

          <div className="space-y-3">
            {/* Total Atletas */}
            <div className="p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-zinc-800 flex items-center justify-center text-[#02D7E5]">
                  <Users className="w-4 h-4" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase">
                    Atletas Registrados
                  </span>
                  <span className="text-xs text-zinc-500">Censo general</span>
                </div>
              </div>
              <span className="text-lg font-bold text-white">{totalAtletas}</span>
            </div>

            {/* Heats Asignados */}
            <div className="p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400">
                  <Flame className="w-4 h-4" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase">
                    Heats Asignados
                  </span>
                  <span className="text-xs text-zinc-500">Atletas con tanda</span>
                </div>
              </div>
              <span className="text-lg font-bold text-amber-300">
                {totalAsignados} / {totalAtletas}
              </span>
            </div>

            {/* Tiempos Registrados */}
            <div className="p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                  <Timer className="w-4 h-4" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase">
                    Tiempos Finales
                  </span>
                  <span className="text-xs text-zinc-500">Resultados cargados</span>
                </div>
              </div>
              <span className="text-lg font-bold text-emerald-400">
                {totalTiemposRegistrados}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Modal UI Real para Crear Nueva Simulación (Sin window.confirm/prompt) */}
      {mostrarModalCrear && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-md p-6 bg-zinc-950 border border-zinc-800 rounded-3xl shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#02D7E5]">
                Configuración de Jornada
              </span>
              <h3 className="text-xl font-bold text-white tracking-tight mt-0.5">
                Crear Nueva Simulación
              </h3>
              <p className="text-xs text-zinc-400 mt-1">
                Ingresa un nombre para la competición o déjalo vacío para asignación automática.
              </p>
            </div>

            <form onSubmit={handleCrear} className="space-y-4">
              <div>
                <label className="text-[11px] font-bold text-zinc-300 uppercase block mb-1.5">
                  Nombre de la Competición
                </label>
                <input
                  type="text"
                  placeholder="Ej. Simulación Hyrox Categoría Start"
                  value={nombreNueva}
                  onChange={(e) => setNombreNueva(e.target.value)}
                  className="w-full px-4 py-3 bg-zinc-900/80 border border-zinc-800 rounded-2xl text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-[#02D7E5]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setMostrarModalCrear(false)}
                  disabled={loading}
                  className="px-4 py-2.5 rounded-2xl text-zinc-400 hover:text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2.5 bg-[#02D7E5] hover:bg-[#02D7E5]/90 text-black font-bold text-xs rounded-2xl transition-all shadow-md shadow-[#02D7E5]/20 disabled:opacity-50 cursor-pointer"
                >
                  {loading ? 'Creando...' : 'Crear Simulación'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  )
}
