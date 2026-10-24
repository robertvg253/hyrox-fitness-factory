'use client'

import React, { useState, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  arrancarSimulacion,
  finalizarSimulacion,
  guardarTiempoResultado
} from './actions'
import toast from 'react-hot-toast'
import {
  Play,
  CheckCircle2,
  Pencil,
  Loader2,
  Flame,
  Users,
  Search,
  ArrowRight,
  ShieldAlert,
  Trophy,
  X,
  Timer,
  Lock,
  AlertCircle
} from 'lucide-react'

export interface AtletaCarrera {
  id: string
  dorsal?: string | null
  nombres: string
  partnerNombres?: string | null
  cedula?: string
  categoriaNombre?: string | null
  heatAsignado: string
  promedioMMSS: string
  promedioSegundos: number
  tiempoResultadoSegundos: number | null
  tiempoResultadoMMSS: string | null
}

interface CarreraClientProps {
  simulacion: {
    id: string
    nombre: string
    estado: string // 'PENDIENTE' | 'EN_CURSO' | 'FINALIZADA'
    heats_liberados?: boolean
  } | null
  atletas: AtletaCarrera[]
}

function getAtletaHeat(atleta: AtletaCarrera): string {
  const h = atleta.heatAsignado ? atleta.heatAsignado.trim() : ''
  if (!h || h === 'Sin Asignar' || h === 'Sin Heat Asignado') {
    return 'Sin Heat Asignado'
  }
  return h
}

/**
 * Función de formateo en vivo de máscara MM:SS
 * Elimina no numéricos, limita a 4 dígitos y pone los dos puntos automáticamente
 */
function formatInputMMSS(val: string): string {
  const digits = val.replace(/\D/g, '').slice(0, 4)
  if (digits.length <= 2) {
    return digits
  }
  return `${digits.slice(0, 2)}:${digits.slice(2, 4)}`
}

/**
 * Componente independiente para cada fila de atleta.
 * Garantiza aislamiento absoluto de estado por fila (evita sobrescrituras cruzadas).
 * Implementa autoguardado en onBlur o Enter.
 */
interface AtletaRowItemProps {
  atleta: AtletaCarrera
  index: number
  simulacionId: string | null
  pistaHabilitada: boolean
  onTiempoActualizado?: (atletaId: string, tiempoMMSS: string) => void
}

function AtletaRowItem({
  atleta,
  index,
  simulacionId,
  pistaHabilitada,
  onTiempoActualizado
}: AtletaRowItemProps) {
  // Estado local completamente aislado para este atleta
  const [val, setVal] = useState<string>(atleta.tiempoResultadoMMSS || '')
  const [tiempoGuardado, setTiempoGuardado] = useState<string | null>(atleta.tiempoResultadoMMSS || null)
  const [isEditing, setIsEditing] = useState<boolean>(!atleta.tiempoResultadoMMSS)
  const [isSaving, setIsSaving] = useState<boolean>(false)
  const [lastSavedVal, setLastSavedVal] = useState<string>(atleta.tiempoResultadoMMSS || '')
  const inputRef = useRef<HTMLInputElement>(null)

  // Máscara MM:SS en vivo mientras el usuario teclea
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatInputMMSS(e.target.value)
    setVal(formatted)
  }

  // Lógica de Autoguardado al perder foco (onBlur) o presionar Enter
  const handleAutoGuardar = async () => {
    if (!pistaHabilitada || !simulacionId) return
    const valorLimpio = val.trim()

    // Si no cambió respecto al último guardado válido, simplemente cerramos edición
    if (valorLimpio === lastSavedVal && tiempoGuardado) {
      setIsEditing(false)
      return
    }

    if (!valorLimpio) {
      if (tiempoGuardado) setIsEditing(false)
      return
    }

    setIsSaving(true)
    try {
      const res = await guardarTiempoResultado(simulacionId, atleta.id, valorLimpio)
      if (res.success && res.formateado) {
        setTiempoGuardado(res.formateado)
        setLastSavedVal(res.formateado)
        setVal(res.formateado)
        setIsEditing(false)
        onTiempoActualizado?.(atleta.id, res.formateado)
        toast.success(`${atleta.nombres}: ${res.formateado}`, {
          id: `save-${atleta.id}`,
          duration: 2000
        })
      } else {
        toast.error(res.error || 'Error al guardar el tiempo.')
      }
    } catch {
      toast.error('Error de conexión al autoguardar.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur()
    } else if (e.key === 'Escape') {
      setVal(lastSavedVal)
      if (tiempoGuardado) setIsEditing(false)
    }
  }

  const activarEdicion = () => {
    if (!pistaHabilitada) return
    setIsEditing(true)
    setTimeout(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    }, 40)
  }

  return (
    <div className="p-4 md:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-white/[0.02] transition-colors">
      {/* Datos del Atleta */}
      <div className="flex items-center gap-3 min-w-0">
        <span className="w-6 text-xs font-bold text-zinc-500 text-center">
          #{index + 1}
        </span>

        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            {atleta.dorsal ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-mono font-bold bg-[#02D7E5]/15 text-[#02D7E5] border border-[#02D7E5]/40 shadow-sm shrink-0">
                #{atleta.dorsal}
              </span>
            ) : (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-lg text-[10px] font-mono font-semibold bg-zinc-800 text-zinc-500 border border-zinc-700/50 shrink-0">
                S/D
              </span>
            )}
            <p className="font-bold text-sm text-white truncate">
              {atleta.nombres}
              {atleta.partnerNombres && (
                <span className="text-[#02D7E5] font-semibold text-xs ml-1.5">
                  & {atleta.partnerNombres}
                </span>
              )}
            </p>
            {atleta.categoriaNombre && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-bold bg-[#02D7E5]/10 text-[#02D7E5] border border-[#02D7E5]/30 tracking-wide uppercase shrink-0">
                {atleta.categoriaNombre}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2.5 text-xs text-zinc-400">
            {atleta.cedula && (
              <span className="text-[11px] text-zinc-500">
                CI: {atleta.cedula}
              </span>
            )}
            {atleta.cedula && <span className="text-[11px] text-zinc-600">•</span>}
            <span className="text-[11px] text-zinc-400">
              Promedio previo:{' '}
              <strong className="text-zinc-300 font-bold">
                {atleta.promedioMMSS}
              </strong>
            </span>
          </div>
        </div>
      </div>

      {/* Control de Tiempo con Autoguardado / Texto Fijo */}
      <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
        {tiempoGuardado && !isEditing ? (
          /* Estado Guardado: Texto verde fijo con botón de lápiz para editar */
          <div className="flex items-center gap-2">
            <div className="px-3.5 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 font-bold text-sm tracking-wider flex items-center gap-2 shadow-sm">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>{tiempoGuardado}</span>
            </div>

            <button
              type="button"
              onClick={activarEdicion}
              disabled={!pistaHabilitada}
              className={`p-2 rounded-xl border transition-colors ${
                pistaHabilitada
                  ? 'bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border-white/10 cursor-pointer'
                  : 'bg-zinc-900/50 text-zinc-600 border-zinc-800 cursor-not-allowed opacity-50'
              }`}
              title={pistaHabilitada ? 'Editar tiempo' : 'Pista bloqueada'}
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          /* Estado Input Activo: Input inline independiente con autoguardado en onBlur / Enter */
          <div className="relative flex items-center">
            <input
              ref={inputRef}
              type="text"
              placeholder="MM:SS"
              maxLength={5}
              value={val}
              onChange={handleChange}
              onBlur={handleAutoGuardar}
              onKeyDown={handleKeyDown}
              disabled={!pistaHabilitada || isSaving}
              className={`w-28 px-3 py-1.5 rounded-xl border text-center font-bold text-sm transition-all focus:outline-none ${
                !pistaHabilitada
                  ? 'bg-zinc-900/40 border-zinc-800 text-zinc-600 opacity-60 cursor-not-allowed'
                  : isSaving
                  ? 'bg-zinc-900 border-[#02D7E5]/50 text-white animate-pulse'
                  : 'bg-zinc-900 border-white/20 text-white focus:border-[#02D7E5] focus:ring-1 focus:ring-[#02D7E5]'
              }`}
              title={
                !pistaHabilitada
                  ? 'Pista bloqueada: arranca la simulación para habilitar la toma de tiempos'
                  : 'Escribe MM:SS (se autoguarda al salir o presionar Enter)'
              }
            />

            {/* Spinner inline mientras autoguarda */}
            {isSaving && (
              <div className="absolute right-2.5 flex items-center pointer-events-none">
                <Loader2 className="w-4 h-4 animate-spin text-[#02D7E5]" />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default function RegistroTiemposCarreraClient({
  simulacion,
  atletas
}: CarreraClientProps) {
  const router = useRouter()

  // Filtros
  const [selectedHeat, setSelectedHeat] = useState<string>('TODOS')
  const [busqueda, setBusqueda] = useState<string>('')

  // Control de Drawers Laterales (Slide-overs)
  const [drawerArrancarOpen, setDrawerArrancarOpen] = useState(false)
  const [drawerFinalizarOpen, setDrawerFinalizarOpen] = useState(false)
  const [isProcessingEstado, setIsProcessingEstado] = useState(false)

  // Rastreo de conteo actualizado en vivo
  const [tiemposRegistradosIds, setTiemposRegistradosIds] = useState<Set<string>>(() => {
    const init = new Set<string>()
    atletas.forEach((a) => {
      if (a.tiempoResultadoMMSS) init.add(a.id)
    })
    return init
  })

  const handleTiempoActualizado = (atletaId: string) => {
    setTiemposRegistradosIds((prev) => {
      const next = new Set(prev)
      next.add(atletaId)
      return next
    })
  }

  // Confirmar Arranque de Carrera desde Drawer
  const handleConfirmarArrancar = async () => {
    if (!simulacion?.id) return
    setIsProcessingEstado(true)
    const toastId = toast.loading('Dando largada oficial a la competición...')
    try {
      const res = await arrancarSimulacion(simulacion.id)
      if (res.success) {
        toast.success('¡Competición en curso! Pista habilitada para toma de tiempos.', {
          id: toastId,
          duration: 3500
        })
        setDrawerArrancarOpen(false)
        router.refresh()
      } else {
        toast.error(res.error || 'Error al arrancar competición.', { id: toastId })
      }
    } catch {
      toast.error('Error de red al arrancar competición.', { id: toastId })
    } finally {
      setIsProcessingEstado(false)
    }
  }

  // Confirmar Finalización de Carrera desde Drawer
  const handleConfirmarFinalizar = async () => {
    if (!simulacion?.id) return
    setIsProcessingEstado(true)
    const toastId = toast.loading('Finalizando competición...')
    try {
      const res = await finalizarSimulacion(simulacion.id)
      if (res.success) {
        toast.success('¡Competición finalizada! Leaderboard listo para publicar.', {
          id: toastId,
          duration: 3500
        })
        setDrawerFinalizarOpen(false)
        router.refresh()
      } else {
        toast.error(res.error || 'Error al finalizar competición.', { id: toastId })
      }
    } catch {
      toast.error('Error de red al finalizar.', { id: toastId })
    } finally {
      setIsProcessingEstado(false)
    }
  }

  // Condición de Pista Habilitada: ESTRICTAMENTE 'EN_CURSO'
  const pistaHabilitada = simulacion?.estado === 'EN_CURSO'

  // Extraer y ordenar todos los Heats presentes de forma 100% DINÁMICA
  const { heatsOrdenados, hayAtletasSinHeat } = useMemo(() => {
    const heatsSet = new Set<string>()
    let sinHeat = false

    atletas.forEach((a) => {
      const h = getAtletaHeat(a)
      if (h === 'Sin Heat Asignado') {
        sinHeat = true
      } else {
        heatsSet.add(h)
      }
    })

    // Ordenar de forma natural: "Heat 1", "Heat 2", ..., "Heat 10", "Heat 11"
    const ordenados = Array.from(heatsSet).sort((a, b) => {
      const numA = parseInt(a.match(/\d+/)?.[0] || '0', 10)
      const numB = parseInt(b.match(/\d+/)?.[0] || '0', 10)
      if (numA > 0 && numB > 0 && numA !== numB) {
        return numA - numB
      }
      return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
    })

    return { heatsOrdenados: ordenados, hayAtletasSinHeat: sinHeat }
  }, [atletas])

  // Todas las secciones a renderizar en orden: Heats válidos primero, y "Sin Heat Asignado" al final
  const todasLasSecciones = useMemo(() => {
    const list = [...heatsOrdenados]
    if (hayAtletasSinHeat) {
      list.push('Sin Heat Asignado')
    }
    return list
  }, [heatsOrdenados, hayAtletasSinHeat])

  // Filtrado de atletas
  const atletasFiltrados = useMemo(() => {
    return atletas.filter((a) => {
      const atletaHeat = getAtletaHeat(a)
      const matchHeat = selectedHeat === 'TODOS' || atletaHeat === selectedHeat
      const q = busqueda.trim().toLowerCase()
      if (!q) return matchHeat

      const qSinHash = q.replace(/^#/, '')
      const qCleanNum = qSinHash.replace(/^0+/, '')
      const dorsalClean = a.dorsal ? a.dorsal.replace(/^0+/, '') : ''

      const matchDorsal = !!(
        a.dorsal &&
        (a.dorsal.toLowerCase().includes(q) ||
          `#${a.dorsal.toLowerCase()}`.includes(q) ||
          (qCleanNum && (dorsalClean === qCleanNum || dorsalClean.includes(qCleanNum))))
      )

      const matchBusqueda =
        a.nombres.toLowerCase().includes(q) ||
        (a.partnerNombres && a.partnerNombres.toLowerCase().includes(q)) ||
        (a.categoriaNombre && a.categoriaNombre.toLowerCase().includes(q)) ||
        (a.cedula && a.cedula.includes(q)) ||
        matchDorsal

      return matchHeat && matchBusqueda
    })
  }, [atletas, selectedHeat, busqueda])

  // Métricas rápidas
  const totalConTiempo = tiemposRegistradosIds.size
  const totalPendientes = Math.max(0, atletas.length - totalConTiempo)

  return (
    <div className="space-y-6">
      {/* 1. Header de Estado y Acciones Superiores */}
      <div className="p-6 rounded-3xl bg-zinc-950/85 border border-white/10 backdrop-blur-xl shadow-2xl flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#02D7E5]">
              Centro de Pista Oficial
            </span>

            {/* Badge de Estado */}
            {simulacion?.estado === 'EN_CURSO' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                EN CURSO (PISTA HABILITADA)
              </span>
            )}
            {simulacion?.estado === 'PENDIENTE' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                <Lock className="w-3.5 h-3.5" />
                PISTA BLOQUEADA (PENDIENTE DE LARGADA)
              </span>
            )}
            {simulacion?.estado === 'FINALIZADA' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#02D7E5]/15 text-[#02D7E5] border border-[#02D7E5]/30">
                <CheckCircle2 className="w-3.5 h-3.5" />
                FINALIZADA (TIEMPOS CONSOLIDADOS)
              </span>
            )}
          </div>

          <h2 className="text-2xl font-bold text-white tracking-tight">
            {simulacion?.nombre || 'Ninguna Competición Activa'}
          </h2>
          <p className="text-xs text-zinc-400">
            {pistaHabilitada
              ? 'Toma de tiempos en vivo: los campos se guardan automáticamente al presionar Enter o cambiar de celda.'
              : 'La toma de tiempos se activará de forma automática en cuanto la carrera cambie a estado EN CURSO.'}
          </p>
        </div>

        {/* Acciones de Carrera con apertura de Drawers Laterales */}
        <div className="flex flex-wrap items-center gap-3">
          {/* CASO A: PENDIENTE */}
          {simulacion?.estado === 'PENDIENTE' && (
            <button
              type="button"
              onClick={() => setDrawerArrancarOpen(true)}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-400 hover:to-emerald-300 text-black font-bold text-sm shadow-xl shadow-emerald-500/25 active:scale-95 transition-all cursor-pointer"
              title="Dar largada oficial a la competición"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Arrancar Simulación</span>
            </button>
          )}

          {/* CASO B: EN CURSO */}
          {simulacion?.estado === 'EN_CURSO' && (
            <button
              type="button"
              onClick={() => setDrawerFinalizarOpen(true)}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-red-500 to-amber-500 hover:from-red-400 hover:to-amber-400 text-black font-bold text-sm shadow-xl shadow-red-500/25 active:scale-95 transition-all cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4 text-black" />
              <span>Finalizar Competición</span>
            </button>
          )}

          {/* CASO C: FINALIZADA */}
          {simulacion?.estado === 'FINALIZADA' && (
            <Link
              href="/admin/leaderboard"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-[#02D7E5] hover:bg-[#02D7E5]/90 text-black font-bold text-sm shadow-xl shadow-[#02D7E5]/25 active:scale-95 transition-all"
            >
              <Trophy className="w-4 h-4 text-black" />
              <span>Ver Leaderboard Oficial</span>
              <ArrowRight className="w-4 h-4 text-black" />
            </Link>
          )}
        </div>
      </div>

      {/* 2. Barra de Métricas y Filtros por Heat */}
      <div className="p-4 md:p-5 rounded-3xl bg-zinc-950/70 border border-white/10 backdrop-blur-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-900 border border-white/10">
              <Users className="w-4 h-4 text-[#02D7E5]" />
              <span className="text-zinc-400">Atletas:</span>
              <span className="font-bold text-white">{atletas.length}</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span className="text-zinc-400">Registrados:</span>
              <span className="font-bold text-emerald-400">{totalConTiempo}</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30">
              <Timer className="w-4 h-4 text-amber-400" />
              <span className="text-zinc-400">Pendientes:</span>
              <span className="font-bold text-amber-400">{totalPendientes}</span>
            </div>
          </div>

          {/* Buscador */}
          <div className="relative w-full md:w-64">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por atleta, cédula o # dorsal..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-zinc-900/90 border border-white/10 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#02D7E5]"
            />
          </div>
        </div>

        {/* Pestañas de Heats Dinámicas */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/5">
          <button
            type="button"
            onClick={() => setSelectedHeat('TODOS')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              selectedHeat === 'TODOS'
                ? 'bg-[#02D7E5] text-black shadow-md shadow-[#02D7E5]/20'
                : 'bg-zinc-900 text-zinc-400 hover:text-white border border-white/5'
            }`}
          >
            Todos ({atletas.length})
          </button>

          {heatsOrdenados.map((heat) => {
            const count = atletas.filter((a) => getAtletaHeat(a) === heat).length
            const isSel = selectedHeat === heat
            return (
              <button
                key={heat}
                type="button"
                onClick={() => setSelectedHeat(heat)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  isSel
                    ? 'bg-amber-400 text-black shadow-md shadow-amber-400/20'
                    : 'bg-zinc-900 text-zinc-400 hover:text-white border border-white/5'
                }`}
              >
                {heat} ({count})
              </button>
            )
          })}

          {hayAtletasSinHeat && (
            <button
              type="button"
              onClick={() => setSelectedHeat('Sin Heat Asignado')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                selectedHeat === 'Sin Heat Asignado'
                  ? 'bg-amber-500 text-black shadow-md shadow-amber-500/20'
                  : 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/30'
              }`}
            >
              <AlertCircle className="w-3.5 h-3.5" />
              <span>
                Sin Heat Asignado (
                {atletas.filter((a) => getAtletaHeat(a) === 'Sin Heat Asignado').length}
                )
              </span>
            </button>
          )}
        </div>
      </div>

      {/* 3. Listado de Heats con Filas de Atletas Aisladas */}
      <div className="space-y-6">
        {todasLasSecciones.filter((h) => selectedHeat === 'TODOS' || selectedHeat === h).map((heatKey) => {
          const esSinHeat = heatKey === 'Sin Heat Asignado'

          // Ordenar atletas de MENOR a MAYOR promedio (más rápidos arriba)
          const atletasDelHeat = atletasFiltrados
            .filter((a) => getAtletaHeat(a) === heatKey)
            .sort((a, b) => {
              if (!a.promedioSegundos && b.promedioSegundos) return 1
              if (a.promedioSegundos && !b.promedioSegundos) return -1
              if (a.promedioSegundos !== b.promedioSegundos) {
                return a.promedioSegundos - b.promedioSegundos
              }
              return a.nombres.localeCompare(b.nombres)
            })

          if (atletasDelHeat.length === 0 && selectedHeat !== 'TODOS') {
            return (
              <div
                key={heatKey}
                className="p-8 rounded-3xl bg-zinc-950/60 border border-dashed border-white/10 text-center text-zinc-500 text-xs"
              >
                No hay atletas asignados a {heatKey} que coincidan con la búsqueda.
              </div>
            )
          }

          if (atletasDelHeat.length === 0) return null

          return (
            <div
              key={heatKey}
              className={`rounded-3xl backdrop-blur-xl overflow-hidden shadow-2xl border ${
                esSinHeat
                  ? 'bg-zinc-950/80 border-amber-500/30'
                  : 'bg-zinc-950/80 border-white/10'
              }`}
            >
              {/* Cabecera del Heat */}
              <div
                className={`p-4 md:px-6 border-b flex items-center justify-between ${
                  esSinHeat
                    ? 'bg-amber-500/10 border-amber-500/20'
                    : 'bg-zinc-900/40 border-white/10'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                      esSinHeat
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                    }`}
                  >
                    {esSinHeat ? (
                      <AlertCircle className="w-4 h-4 text-amber-400" />
                    ) : (
                      <Flame className="w-4 h-4 text-amber-400" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white tracking-tight">
                      {heatKey}
                    </h3>
                    <p className="text-[10px] text-zinc-400">
                      {esSinHeat
                        ? 'Atletas pendientes por asignar tanda oficial de salida'
                        : 'Tanda oficial de salida'}
                    </p>
                  </div>
                </div>

                <span
                  className={`px-2.5 py-1 rounded-xl border text-xs font-bold ${
                    esSinHeat
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                      : 'bg-white/5 border-white/10 text-white'
                  }`}
                >
                  {atletasDelHeat.length} {atletasDelHeat.length === 1 ? 'atleta' : 'atletas'}
                </span>
              </div>

              {/* Filas de Atletas (Cada una maneja su propio estado independiente) */}
              <div className="divide-y divide-white/5">
                {atletasDelHeat.map((atleta, idx) => (
                  <AtletaRowItem
                    key={atleta.id}
                    atleta={atleta}
                    index={idx}
                    simulacionId={simulacion?.id || null}
                    pistaHabilitada={pistaHabilitada}
                    onTiempoActualizado={handleTiempoActualizado}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* DRAWER LATERAL: Arrancar Simulación (Slide-over desde la derecha) */}
      <div
        className={`fixed inset-0 z-50 transition-opacity duration-300 ${
          drawerArrancarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Backdrop oscuro con blur */}
        <div
          onClick={() => !isProcessingEstado && setDrawerArrancarOpen(false)}
          className="absolute inset-0 bg-black/80 backdrop-blur-sm cursor-pointer"
        />

        {/* Panel lateral deslizante */}
        <div
          className={`absolute inset-y-0 right-0 w-full sm:w-96 bg-zinc-950 border-l border-white/10 shadow-2xl p-6 flex flex-col justify-between transform transition-transform duration-300 ease-in-out ${
            drawerArrancarOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <div className="space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <Play className="w-5 h-5 fill-current" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white tracking-tight">
                    Arrancar Competición
                  </h3>
                  <p className="text-[11px] text-zinc-400">Largada oficial de pista</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !isProcessingEstado && setDrawerArrancarOpen(false)}
                className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-2 text-xs text-zinc-300 leading-relaxed">
              <p className="font-bold text-white text-sm">
                ¿Confirmas dar la largada a la simulación?
              </p>
              <p>
                El estado cambiará inmediatamente a <strong className="text-emerald-400">EN CURSO</strong> y se habilitará la toma oficial de tiempos en vivo para los jueces.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300">
              ✓ Los atletas y heats asignados se encuentran listos para la largada.
            </div>
          </div>

          <div className="pt-6 border-t border-white/10 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setDrawerArrancarOpen(false)}
              disabled={isProcessingEstado}
              className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirmarArrancar}
              disabled={isProcessingEstado}
              className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs shadow-md shadow-emerald-500/25 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
            >
              {isProcessingEstado ? 'Arrancando...' : 'Sí, Arrancar Carrera'}
            </button>
          </div>
        </div>
      </div>

      {/* DRAWER LATERAL: Finalizar Competición (Slide-over desde la derecha) */}
      <div
        className={`fixed inset-0 z-50 transition-opacity duration-300 ${
          drawerFinalizarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Backdrop oscuro con blur */}
        <div
          onClick={() => !isProcessingEstado && setDrawerFinalizarOpen(false)}
          className="absolute inset-0 bg-black/80 backdrop-blur-sm cursor-pointer"
        />

        {/* Panel lateral deslizante */}
        <div
          className={`absolute inset-y-0 right-0 w-full sm:w-96 bg-zinc-950 border-l border-white/10 shadow-2xl p-6 flex flex-col justify-between transform transition-transform duration-300 ease-in-out ${
            drawerFinalizarOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <div className="space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white tracking-tight">
                    Finalizar Competición
                  </h3>
                  <p className="text-[11px] text-zinc-400">Cierre oficial de pista</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !isProcessingEstado && setDrawerFinalizarOpen(false)}
                className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-2 text-xs text-zinc-300 leading-relaxed">
              <p className="font-bold text-white text-sm">
                ¿Estás seguro que deseas cerrar la competición?
              </p>
              <p>
                El evento pasará a estado <strong className="text-white">FINALIZADA</strong>. La pista de toma de tiempos se cerrará y podrás revisar y publicar la clasificación oficial en el módulo de Leaderboard.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
              💡 {totalConTiempo} de {atletas.length} atletas cuentan con tiempo oficial registrado.
            </div>
          </div>

          <div className="pt-6 border-t border-white/10 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setDrawerFinalizarOpen(false)}
              disabled={isProcessingEstado}
              className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirmarFinalizar}
              disabled={isProcessingEstado}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-500 to-amber-500 hover:from-red-400 hover:to-amber-400 text-black font-bold text-xs shadow-md shadow-red-500/25 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
            >
              {isProcessingEstado ? 'Finalizando...' : 'Sí, Finalizar Carrera'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
