'use client'

import { useState } from 'react'
import {
  Users,
  Search,
  Flame,
  Timer,
  Save,
  Check,
  Shirt,
  ShieldCheck,
  AlertCircle,
  Filter,
  CheckCircle2
} from 'lucide-react'
import toast from 'react-hot-toast'
import { asignarHeatAtleta, guardarTiempoResultado } from './actions'

export interface AtletaRow {
  id: string
  nombres: string
  cedula: string
  telefono: string | null
  email: string
  talla_franela: string | null
  tiempoPromedioSegundos: number
  tiempoPromedioMMSS: string
  heatAsignado: string | null
  tiempoResultadoSegundos: number | null
  tiempoResultadoMMSS: string
}

interface TablaGestionAtletasProps {
  atletas: AtletaRow[]
  simulacionId: string | null
  estadoSimulacion: string | null
}

const OPCIONES_HEAT = [
  { valor: 'Rojo', label: 'Heat Rojo', color: 'bg-red-500/20 text-red-400 border-red-500/40' },
  { valor: 'Azul', label: 'Heat Azul', color: 'bg-blue-500/20 text-blue-400 border-blue-500/40' },
  { valor: 'Amarillo', label: 'Heat Amarillo', color: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40' },
  { valor: 'Verde', label: 'Heat Verde', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' }
]

export default function TablaGestionAtletas({
  atletas,
  simulacionId,
  estadoSimulacion
}: TablaGestionAtletasProps) {
  const [busqueda, setBusqueda] = useState('')
  const [filtroHeat, setFiltroHeat] = useState<string>('TODOS')

  // Estados locales para los inputs de tiempo (por atleta ID)
  const [tiemposInput, setTiemposInput] = useState<Record<string, string>>(() => {
    const inicial: Record<string, string> = {}
    atletas.forEach((a) => {
      inicial[a.id] = a.tiempoResultadoMMSS !== '--:--' ? a.tiempoResultadoMMSS : ''
    })
    return inicial
  })

  // Estados de carga por fila
  const [savingHeat, setSavingHeat] = useState<Record<string, boolean>>({})
  const [savingTiempo, setSavingTiempo] = useState<Record<string, boolean>>({})

  // Determinar si los inputs de tiempo están habilitados
  // La regla estricta dice: "Debe estar deshabilitado o invisible si la simulación está 'PENDIENTE'"
  const inputTiempoHabilitado = Boolean(
    simulacionId && (estadoSimulacion === 'EN_CURSO' || estadoSimulacion === 'FINALIZADA')
  )

  // Máscara para formatear tiempo MM:SS mientras escribe
  const handleTiempoChange = (atletaId: string, valor: string) => {
    const raw = valor.replace(/\D/g, '').slice(0, 4)
    let formatted = raw
    if (raw.length >= 3) {
      formatted = `${raw.slice(0, 2)}:${raw.slice(2)}`
    }
    setTiemposInput((prev) => ({ ...prev, [atletaId]: formatted }))
  }

  // 1. Manejador para cambio de Heat
  const handleCambioHeat = async (atleta: AtletaRow, nuevoHeat: string) => {
    if (!simulacionId) {
      toast.error('Primero debes crear o activar una simulación.')
      return
    }

    setSavingHeat((prev) => ({ ...prev, [atleta.id]: true }))
    try {
      const res = await asignarHeatAtleta(
        simulacionId,
        atleta.id,
        nuevoHeat,
        atleta.tiempoPromedioSegundos
      )

      if (res.success) {
        toast.success(
          nuevoHeat
            ? `Heat ${nuevoHeat} asignado a ${atleta.nombres.split(' ')[0]}`
            : `Heat removido para ${atleta.nombres.split(' ')[0]}`
        )
      } else {
        toast.error(res.error || 'Error al asignar heat.')
      }
    } catch {
      toast.error('Error de conexión al asignar heat.')
    } finally {
      setSavingHeat((prev) => ({ ...prev, [atleta.id]: false }))
    }
  }

  // 2. Manejador para guardar Tiempo Final
  const handleGuardarTiempo = async (atleta: AtletaRow) => {
    if (!simulacionId) {
      toast.error('Primero debes activar una simulación.')
      return
    }

    const valorMMSS = tiemposInput[atleta.id]?.trim()
    if (!valorMMSS || !valorMMSS.includes(':')) {
      toast.error('Ingresa un tiempo en formato MM:SS (ej. 45:30)')
      return
    }

    setSavingTiempo((prev) => ({ ...prev, [atleta.id]: true }))
    try {
      const res = await guardarTiempoResultado(simulacionId, atleta.id, valorMMSS)
      if (res.success) {
        toast.success(`Tiempo de ${atleta.nombres.split(' ')[0]} registrado: ${valorMMSS}`)
      } else {
        toast.error(res.error || 'Error al guardar el tiempo.')
      }
    } catch {
      toast.error('Error de conexión al guardar tiempo.')
    } finally {
      setSavingTiempo((prev) => ({ ...prev, [atleta.id]: false }))
    }
  }

  // Filtrado de atletas
  const atletasFiltrados = atletas.filter((atleta) => {
    const matchBusqueda =
      atleta.nombres.toLowerCase().includes(busqueda.toLowerCase()) ||
      atleta.cedula.toLowerCase().includes(busqueda.toLowerCase())

    if (!matchBusqueda) return false

    if (filtroHeat === 'TODOS') return true
    if (filtroHeat === 'SIN_HEAT') return !atleta.heatAsignado
    return atleta.heatAsignado === filtroHeat
  })

  return (
    <section className="space-y-4">
      {/* Barra de Filtros y Búsqueda */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-4 rounded-3xl bg-zinc-950/70 backdrop-blur-xl border border-white/10 shadow-lg">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Buscar atleta por nombre o cédula..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-zinc-900/80 border border-zinc-800 rounded-2xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#02D7E5]"
          />
        </div>

        {/* Píldoras de Filtro por Heat */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          <button
            onClick={() => setFiltroHeat('TODOS')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
              filtroHeat === 'TODOS'
                ? 'bg-[#02D7E5] text-black shadow-sm shadow-[#02D7E5]/30'
                : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
            }`}
          >
            Todos ({atletas.length})
          </button>
          {['Rojo', 'Azul', 'Amarillo', 'Verde'].map((color) => {
            const count = atletas.filter((a) => a.heatAsignado === color).length
            return (
              <button
                key={color}
                onClick={() => setFiltroHeat(color)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                  filtroHeat === color
                    ? 'bg-zinc-800 text-white border border-[#02D7E5]'
                    : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
                }`}
              >
                {color} ({count})
              </button>
            )
          })}
          <button
            onClick={() => setFiltroHeat('SIN_HEAT')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
              filtroHeat === 'SIN_HEAT'
                ? 'bg-zinc-800 text-amber-300 border border-amber-500/40'
                : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
            }`}
          >
            Sin Asignar ({atletas.filter((a) => !a.heatAsignado).length})
          </button>
        </div>
      </div>

      {/* Contenedor Principal: Lista y Tabla Glassmorphism */}
      <div className="overflow-hidden rounded-3xl bg-zinc-950/80 backdrop-blur-xl border border-white/10 shadow-2xl">
        <div className="p-5 border-b border-zinc-900 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-[#02D7E5]" />
            <h3 className="text-base font-bold text-white tracking-tight">
              Directorio de Atletas y Registro de Heats
            </h3>
          </div>
          <span className="text-xs text-zinc-500 font-semibold">
            {atletasFiltrados.length} atleta(s) en lista
          </span>
        </div>

        {atletasFiltrados.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <AlertCircle className="w-8 h-8 text-zinc-600 mx-auto" />
            <p className="text-sm font-bold text-zinc-400">
              No se encontraron atletas con los criterios seleccionados
            </p>
            <p className="text-xs text-zinc-600">
              Prueba cambiando el filtro de búsqueda o el selector de heat.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-900 text-[10px] font-bold uppercase tracking-wider text-zinc-400 bg-zinc-900/40">
                  <th className="py-3 px-5">Atleta</th>
                  <th className="py-3 px-4 text-center">Promedio (4 Tests)</th>
                  <th className="py-3 px-4">Asignación de Heat</th>
                  <th className="py-3 px-5">
                    Tiempo de Carrera {estadoSimulacion === 'PENDIENTE' && '(Esperando Inicio)'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900 text-xs">
                {atletasFiltrados.map((atleta) => {
                  const tieneTiempoGuardado =
                    typeof atleta.tiempoResultadoSegundos === 'number' &&
                    atleta.tiempoResultadoSegundos > 0

                  return (
                    <tr
                      key={atleta.id}
                      className="hover:bg-zinc-900/30 transition-colors group"
                    >
                      {/* 1. Datos del Atleta */}
                      <td className="py-4 px-5">
                        <div className="space-y-1">
                          <span className="font-bold text-white text-sm block tracking-tight">
                            {atleta.nombres}
                          </span>
                          <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-400">
                            <span className="flex items-center gap-1 font-mono">
                              <ShieldCheck className="w-3 h-3 text-[#02D7E5]" />
                              {atleta.cedula}
                            </span>
                            {atleta.talla_franela && (
                              <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-300 font-semibold text-[10px]">
                                <Shirt className="w-2.5 h-2.5 text-[#02D7E5]" />
                                Talla {atleta.talla_franela}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* 2. Promedio Histórico */}
                      <td className="py-4 px-4 text-center">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-zinc-900/80 border border-zinc-800 font-mono text-zinc-200 font-bold text-xs">
                          <Timer className="w-3.5 h-3.5 text-[#02D7E5]" />
                          <span>{atleta.tiempoPromedioMMSS}</span>
                        </div>
                      </td>

                      {/* 3. Selector de Heat */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <select
                            value={atleta.heatAsignado || ''}
                            onChange={(e) => handleCambioHeat(atleta, e.target.value)}
                            disabled={savingHeat[atleta.id] || !simulacionId}
                            className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all focus:outline-none focus:ring-1 focus:ring-[#02D7E5] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                              atleta.heatAsignado === 'Rojo'
                                ? 'bg-red-500/15 text-red-300 border-red-500/40'
                                : atleta.heatAsignado === 'Azul'
                                ? 'bg-blue-500/15 text-blue-300 border-blue-500/40'
                                : atleta.heatAsignado === 'Amarillo'
                                ? 'bg-yellow-500/15 text-yellow-300 border-yellow-500/40'
                                : atleta.heatAsignado === 'Verde'
                                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                                : 'bg-zinc-900 text-zinc-400 border-zinc-800'
                            }`}
                          >
                            <option value="" className="bg-zinc-900 text-zinc-400">
                              -- Sin Asignar --
                            </option>
                            <option value="Rojo" className="bg-zinc-900 text-red-400">
                              Heat Rojo
                            </option>
                            <option value="Azul" className="bg-zinc-900 text-blue-400">
                              Heat Azul
                            </option>
                            <option value="Amarillo" className="bg-zinc-900 text-yellow-300">
                              Heat Amarillo
                            </option>
                            <option value="Verde" className="bg-zinc-900 text-emerald-400">
                              Heat Verde
                            </option>
                          </select>

                          {savingHeat[atleta.id] && (
                            <span className="text-[10px] text-zinc-500 animate-pulse">
                              Guardando...
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 4. Input de Tiempo Final y Botón de Guardado */}
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-2">
                          {inputTiempoHabilitado ? (
                            <>
                              <div className="relative">
                                <input
                                  type="text"
                                  placeholder="MM:SS"
                                  value={tiemposInput[atleta.id] || ''}
                                  onChange={(e) =>
                                    handleTiempoChange(atleta.id, e.target.value)
                                  }
                                  maxLength={5}
                                  className="w-24 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-white font-mono text-xs text-center focus:outline-none focus:border-[#02D7E5]"
                                />
                              </div>

                              <button
                                onClick={() => handleGuardarTiempo(atleta)}
                                disabled={savingTiempo[atleta.id]}
                                title="Guardar tiempo de carrera"
                                className="px-3 py-2 bg-[#02D7E5] hover:bg-[#02D7E5]/90 text-black font-bold text-xs rounded-xl transition-all shadow-sm shadow-[#02D7E5]/20 flex items-center gap-1.5 active:scale-[0.98] disabled:opacity-50"
                              >
                                {savingTiempo[atleta.id] ? (
                                  <span className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <Save className="w-3.5 h-3.5" />
                                )}
                                <span>Guardar</span>
                              </button>

                              {tieneTiempoGuardado && (
                                <span
                                  className="text-emerald-400 flex items-center gap-1 text-[11px] font-bold"
                                  title="Tiempo registrado"
                                >
                                  <CheckCircle2 className="w-4 h-4" />
                                </span>
                              )}
                            </>
                          ) : (
                            <div className="flex items-center gap-1.5 text-zinc-500 text-xs italic bg-zinc-900/50 px-3 py-1.5 rounded-xl border border-zinc-800/50">
                              <AlertCircle className="w-3.5 h-3.5" />
                              <span>Habilitado al arrancar competición</span>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}
