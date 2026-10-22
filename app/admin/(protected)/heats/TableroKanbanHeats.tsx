'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import { autoAsignarHeats, actualizarHeatAtleta, liberarHeats } from './actions'
import toast from 'react-hot-toast'
import {
  Flame,
  Wand2,
  Users,
  Clock,
  GripVertical,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Info,
  Globe,
  Eye,
  EyeOff,
  X
} from 'lucide-react'

export interface AtletaKanban {
  id: string
  nombres: string
  cedula?: string
  promedioSegundos: number
  promedioMMSS: string
  heatAsignado: string | null
}

interface TableroKanbanHeatsProps {
  simulacion: {
    id: string
    nombre: string
    estado: string
    heats_liberados?: boolean
  } | null
  atletas: AtletaKanban[]
}

const HEATS = ['Heat 1', 'Heat 2', 'Heat 3', 'Heat 4', 'Heat 5', 'Heat 6'] as const

export default function TableroKanbanHeats({ simulacion, atletas }: TableroKanbanHeatsProps) {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [isAutoAssigning, setIsAutoAssigning] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isLiberando, setIsLiberando] = useState(false)

  // Función para ordenar atletas de MENOR a MAYOR promedio (más rápidos arriba)
  const sortAtletasAsc = (a: AtletaKanban, b: AtletaKanban) => {
    if (!a.promedioSegundos && b.promedioSegundos) return 1
    if (a.promedioSegundos && !b.promedioSegundos) return -1
    if (a.promedioSegundos !== b.promedioSegundos) {
      return a.promedioSegundos - b.promedioSegundos
    }
    return a.nombres.localeCompare(b.nombres)
  }

  // Organizar atletas por columnas con orden interno de MENOR a MAYOR promedio
  const buildColumns = (list: AtletaKanban[]) => {
    const cols: Record<string, AtletaKanban[]> = {
      'Heat 1': [],
      'Heat 2': [],
      'Heat 3': [],
      'Heat 4': [],
      'Heat 5': [],
      'Heat 6': [],
      sin_asignar: [],
    }
    list.forEach((atleta) => {
      if (atleta.heatAsignado && cols[atleta.heatAsignado]) {
        cols[atleta.heatAsignado].push(atleta)
      } else {
        cols.sin_asignar.push(atleta)
      }
    })

    // Ordenar atletas dentro de cada Heat de menor a mayor promedio
    HEATS.forEach((h) => {
      cols[h].sort(sortAtletasAsc)
    })
    cols.sin_asignar.sort(sortAtletasAsc)

    return cols
  }

  const [columns, setColumns] = useState<Record<string, AtletaKanban[]>>(() => buildColumns(atletas))

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    setColumns(buildColumns(atletas))
  }, [atletas])

  // Botón Asignación Automática (1 al 6): Heat 1 más rápidos, Heat 6 más lentos e incompletos
  const handleAutoAsignar = async () => {
    if (!simulacion?.id) {
      toast.error('Primero debes crear o activar una simulación en el Dashboard.')
      return
    }

    setIsAutoAssigning(true)
    const toastId = toast.loading('Dividiendo completos de menor a mayor (Heat 1 al 6) y penalizando incompletos a Heat 6...')

    try {
      const res = await autoAsignarHeats(simulacion.id)
      if (res.success) {
        toast.success(
          `¡${res.totalAsignados} atletas organizados! (${res.completosCount} completos divididos de Heat 1 a 6, ${res.incompletosCount} incompletos en Heat 6)`,
          { id: toastId, duration: 4000 }
        )
        router.refresh()
      } else {
        toast.error(res.error || 'Error al auto-asignar heats.', { id: toastId })
      }
    } catch (err: any) {
      toast.error('Error de conexión al asignar heats.', { id: toastId })
    } finally {
      setIsAutoAssigning(false)
    }
  }

  // Confirmar publicación / liberación de Heats
  const handleConfirmarLiberacion = async () => {
    if (!simulacion?.id) {
      toast.error('No hay simulación activa.')
      return
    }

    setIsLiberando(true)
    const toastId = toast.loading('Publicando heats para todos los atletas...')

    try {
      const res = await liberarHeats(simulacion.id, true)
      if (res.success) {
        toast.success('¡Heats liberados con éxito! Los usuarios ya pueden ver su tanda asignada.', {
          id: toastId,
          duration: 3500,
        })
        setIsModalOpen(false)
        router.refresh()
      } else {
        toast.error(res.error || 'Error al liberar heats.', { id: toastId })
      }
    } catch (err: any) {
      toast.error('Error de conexión al liberar heats.', { id: toastId })
    } finally {
      setIsLiberando(false)
    }
  }

  // Ocultar heats a borrador (si estuviesen liberados)
  const handleOcultarHeats = async () => {
    if (!simulacion?.id) return
    setIsLiberando(true)
    const toastId = toast.loading('Cambiando a modo borrador...')

    try {
      const res = await liberarHeats(simulacion.id, false)
      if (res.success) {
        toast.success('Heats ocultados. Ahora están en modo borrador.', { id: toastId })
        router.refresh()
      } else {
        toast.error(res.error || 'Error al ocultar heats.', { id: toastId })
      }
    } catch (err: any) {
      toast.error('Error de red al ocultar heats.', { id: toastId })
    } finally {
      setIsLiberando(false)
    }
  }

  // Manejo de Drag & Drop
  const handleDragEnd = async (result: DropResult) => {
    const { source, destination, draggableId } = result

    if (!destination) return
    if (source.droppableId === destination.droppableId && source.index === destination.index) {
      return
    }

    const sourceCol = source.droppableId
    const destCol = destination.droppableId

    const newSourceList = Array.from(columns[sourceCol] || [])
    const [movedAtleta] = newSourceList.splice(source.index, 1)
    if (!movedAtleta) return

    const newDestList = sourceCol === destCol ? newSourceList : Array.from(columns[destCol] || [])
    const targetHeat = destCol === 'sin_asignar' ? null : destCol
    const updatedMovedAtleta = { ...movedAtleta, heatAsignado: targetHeat }
    newDestList.splice(destination.index, 0, updatedMovedAtleta)

    const nextState = {
      ...columns,
      [sourceCol]: newSourceList,
      [destCol]: newDestList,
    }

    // 1. Optimistic Update inmediato en la UI
    setColumns(nextState)

    if (!simulacion?.id) {
      toast.error('No hay simulación activa.')
      return
    }

    // 2. Server Action en segundo plano
    try {
      const res = await actualizarHeatAtleta(simulacion.id, draggableId, targetHeat)
      if (!res.success) {
        toast.error(res.error || 'Error al persistir el cambio.')
        // Revertir estado si falló
        setColumns(columns)
      } else {
        toast.success(
          targetHeat
            ? `${movedAtleta.nombres} → ${targetHeat}`
            : `${movedAtleta.nombres} desasignado`,
          { id: `dnd-${draggableId}`, duration: 1800 }
        )
      }
    } catch (err: any) {
      toast.error('Error de red al actualizar atleta.')
      setColumns(columns)
    }
  }

  // Conteo de métricas
  const totalAtletas = atletas.length
  const sinAsignarCount = columns.sin_asignar?.length || 0
  const totalAsignados = totalAtletas - sinAsignarCount
  const heatsEstanLiberados = Boolean(simulacion?.heats_liberados)

  // SSR hydration placeholder
  if (!mounted) {
    return (
      <div className="p-8 rounded-3xl bg-zinc-950/60 border border-white/10 flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3 text-zinc-400">
          <RefreshCw className="w-8 h-8 animate-spin text-[#02D7E5]" />
          <p className="text-sm font-semibold">Cargando tablero interactivo de Heats...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Barra de Acciones y Estadísticas Superiores */}
      <div className="p-5 md:p-6 rounded-3xl bg-zinc-950/80 border border-white/10 backdrop-blur-xl shadow-2xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-zinc-900/90 border border-white/10 text-xs">
            <Users className="w-4 h-4 text-[#02D7E5]" />
            <span className="text-zinc-400">Total:</span>
            <span className="font-bold text-white">{totalAtletas} atletas</span>
          </div>

          <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-zinc-900/90 border border-white/10 text-xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span className="text-zinc-400">Asignados:</span>
            <span className="font-bold text-emerald-400">{totalAsignados}</span>
          </div>

          {sinAsignarCount > 0 && (
            <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs">
              <AlertCircle className="w-4 h-4 text-amber-400" />
              <span className="text-zinc-400">Sin Asignar:</span>
              <span className="font-bold text-amber-400">{sinAsignarCount}</span>
            </div>
          )}

          {/* Estado de Publicación a Atletas */}
          {heatsEstanLiberados ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-bold">
              <Eye className="w-4 h-4 text-emerald-400" />
              <span>Heats Públicos a Atletas</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs font-bold">
              <EyeOff className="w-4 h-4 text-amber-400" />
              <span>Estado: Borrador (Oculto)</span>
            </div>
          )}
        </div>

        {/* Botones Principales de Acción */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Botón: Asignación Automática (1 al 6) */}
          <button
            type="button"
            onClick={handleAutoAsignar}
            disabled={isAutoAssigning || !simulacion}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-5 py-3 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-black font-bold text-sm shadow-lg shadow-amber-500/25 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {isAutoAssigning ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-black" />
                <span>Asignando Heats...</span>
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4 text-black" />
                <span>Asignación Automática (1 al 6)</span>
              </>
            )}
          </button>

          {/* Botón de Acento Cyan: Liberar Heats a Usuarios */}
          {!heatsEstanLiberados ? (
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              disabled={!simulacion}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-[#02D7E5] hover:bg-[#02D7E5]/90 text-black font-bold text-sm shadow-lg shadow-[#02D7E5]/25 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
            >
              <Globe className="w-4 h-4 text-black" />
              <span>Liberar Heats a Usuarios</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleOcultarHeats}
              disabled={isLiberando || !simulacion}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 font-bold text-xs active:scale-95 transition-all cursor-pointer disabled:opacity-50"
              title="Volver a poner los heats en modo borrador"
            >
              <EyeOff className="w-4 h-4 text-zinc-400" />
              <span>Ocultar a Usuarios (Borrador)</span>
            </button>
          )}
        </div>
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        {/* Bandeja de Atletas Sin Asignar (Si los hay) */}
        {columns.sin_asignar && columns.sin_asignar.length > 0 && (
          <div className="p-4 md:p-5 rounded-3xl bg-zinc-950/70 border border-amber-500/30 backdrop-blur-xl">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold text-white">
                  Atletas Pendientes de Asignar ({columns.sin_asignar.length})
                </h3>
              </div>
              <span className="text-[11px] text-zinc-400">
                Arrastra a un atleta directamente a cualquier Heat
              </span>
            </div>

            <Droppable droppableId="sin_asignar" direction="horizontal">
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={`flex flex-wrap gap-2.5 p-3 rounded-2xl min-h-[70px] transition-colors ${
                    snapshot.isDraggingOver
                      ? 'bg-amber-500/10 border-2 border-dashed border-amber-500/50'
                      : 'bg-zinc-900/60 border border-white/5'
                  }`}
                >
                  {columns.sin_asignar.map((atleta, index) => (
                    <Draggable key={atleta.id} draggableId={atleta.id} index={index}>
                      {(dragProvided, dragSnapshot) => (
                        <div
                          ref={dragProvided.innerRef}
                          {...dragProvided.draggableProps}
                          {...dragProvided.dragHandleProps}
                          className={`group px-3 py-2 rounded-xl bg-zinc-900/95 border border-white/10 hover:border-amber-400/50 flex items-center gap-2 shadow-md cursor-grab active:cursor-grabbing transition-all ${
                            dragSnapshot.isDragging ? 'scale-105 shadow-2xl ring-2 ring-amber-400 z-50' : ''
                          }`}
                        >
                          <GripVertical className="w-3.5 h-3.5 text-zinc-600 group-hover:text-amber-400 shrink-0" />
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-white max-w-[140px] truncate">
                              {atleta.nombres}
                            </span>
                            <span className="px-1.5 py-0.5 rounded bg-white/10 border border-white/10 text-[10px] font-semibold text-zinc-300">
                              {atleta.promedioMMSS}
                            </span>
                          </div>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </div>
        )}

        {/* Tablero Kanban: Grid de 3 columnas por 2 filas (Heats 1 al 6) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {HEATS.map((heatKey, heatIndex) => {
            const heatAtletas = columns[heatKey] || []
            // Indicador de ritmo (Heat 1 más rápidos -> Heat 6 más lentos)
            const ritmoTag =
              heatIndex === 0
                ? 'Menor Tiempo / Ritmo Élite (Más Rápidos)'
                : heatIndex === 5
                ? 'Mayor Tiempo / Incompletos / Ritmo Base'
                : `Bloque ${heatIndex + 1}`

            return (
              <div
                key={heatKey}
                className="flex flex-col rounded-3xl bg-zinc-950/85 border border-white/10 backdrop-blur-xl shadow-2xl"
              >
                {/* Cabecera del Heat */}
                <div className="p-4 border-b border-white/10 flex items-center justify-between bg-zinc-900/40">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-[#02D7E5]/10 border border-[#02D7E5]/30 flex items-center justify-center">
                      <Flame className="w-4 h-4 text-[#02D7E5]" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white tracking-tight">
                        {heatKey}
                      </h3>
                      <p className="text-[10px] font-semibold text-zinc-400">{ritmoTag}</p>
                    </div>
                  </div>

                  <span className="px-2.5 py-1 rounded-xl bg-white/5 border border-white/10 text-xs font-bold text-white">
                    {heatAtletas.length} {heatAtletas.length === 1 ? 'atleta' : 'atletas'}
                  </span>
                </div>

                {/* Zona de Drop con altura fija y scroll interno */}
                <Droppable droppableId={heatKey}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`flex-1 p-3.5 h-[400px] overflow-y-auto space-y-2.5 transition-colors ${
                        snapshot.isDraggingOver
                          ? 'bg-[#02D7E5]/5 border-2 border-dashed border-[#02D7E5]/50'
                          : 'bg-transparent'
                      }`}
                    >
                      {heatAtletas.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center p-4 border border-dashed border-white/10 rounded-2xl text-zinc-500">
                          <Clock className="w-6 h-6 mb-2 text-zinc-600" />
                          <p className="text-xs font-bold text-zinc-400">Sin atletas asignados</p>
                          <p className="text-[11px] text-zinc-500 mt-0.5">
                            Arrastra atletas aquí o usa la asignación automática
                          </p>
                        </div>
                      ) : (
                        heatAtletas.map((atleta, index) => (
                          <Draggable key={atleta.id} draggableId={atleta.id} index={index}>
                            {(dragProvided, dragSnapshot) => (
                              <div
                                ref={dragProvided.innerRef}
                                {...dragProvided.draggableProps}
                                {...dragProvided.dragHandleProps}
                                className={`group p-3 rounded-2xl bg-zinc-900/90 hover:bg-zinc-800/90 border border-white/10 hover:border-amber-400/40 shadow-lg flex items-center justify-between gap-3 cursor-grab active:cursor-grabbing transition-all select-none ${
                                  dragSnapshot.isDragging
                                    ? 'scale-105 shadow-2xl ring-2 ring-amber-400 bg-zinc-900 z-50'
                                    : ''
                                }`}
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <GripVertical className="w-4 h-4 text-zinc-600 group-hover:text-amber-400 shrink-0" />
                                  <div className="min-w-0">
                                    <p className="font-bold text-sm text-white truncate">
                                      {atleta.nombres}
                                    </p>
                                    {atleta.cedula && (
                                      <p className="text-[10px] text-zinc-500 truncate">
                                        CI: {atleta.cedula}
                                      </p>
                                    )}
                                  </div>
                                </div>

                                <div className="shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-500/10 border border-amber-500/25">
                                  <Clock className="w-3 h-3 text-amber-400" />
                                  <span className="text-xs font-bold text-amber-300">
                                    {atleta.promedioMMSS}
                                  </span>
                                </div>
                              </div>
                            )}
                          </Draggable>
                        ))
                      )}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            )
          })}
        </div>
      </DragDropContext>

      {/* DRAWER LATERAL: Liberar Heats a Usuarios (Slide-over desde la derecha) */}
      <div
        className={`fixed inset-0 z-50 transition-opacity duration-300 ${
          isModalOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Backdrop oscuro con blur */}
        <div
          onClick={() => !isLiberando && setIsModalOpen(false)}
          className="absolute inset-0 bg-black/80 backdrop-blur-sm cursor-pointer"
        />

        {/* Panel lateral deslizante */}
        <div
          className={`absolute inset-y-0 right-0 w-full sm:w-96 bg-zinc-950 border-l border-white/10 shadow-2xl p-6 flex flex-col justify-between transform transition-transform duration-300 ease-in-out ${
            isModalOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <div className="space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#02D7E5]/10 border border-[#02D7E5]/30 flex items-center justify-center text-[#02D7E5]">
                  <Globe className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white tracking-tight">
                    Liberar Heats
                  </h3>
                  <p className="text-[11px] text-zinc-400">Publicar tandas a usuarios</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !isLiberando && setIsModalOpen(false)}
                className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-2 text-xs text-zinc-200 leading-relaxed">
              <p className="font-bold text-white text-sm">
                ¿Estás seguro que deseas liberar los heats?
              </p>
              <p>
                Los usuarios podrán ver su categoría asignada tanto en su Dashboard como en el módulo de Competición.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#02D7E5]/10 border border-[#02D7E5]/20 text-xs text-[#02D7E5]">
              💡 La largada oficial en pista solo se habilitará una vez que los heats estén liberados.
            </div>
          </div>

          <div className="pt-6 border-t border-white/10 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              disabled={isLiberando}
              className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirmarLiberacion}
              disabled={isLiberando}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#02D7E5] hover:bg-[#02D7E5]/90 text-black font-bold text-xs shadow-md shadow-[#02D7E5]/20 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
            >
              {isLiberando ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-black" />
                  <span>Liberando...</span>
                </>
              ) : (
                <>
                  <Globe className="w-4 h-4 text-black" />
                  <span>Confirmar y Liberar</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Nota Explicativa Inferior */}
      <div className="p-4 rounded-2xl bg-zinc-950/60 border border-white/10 flex items-start gap-3 text-xs text-zinc-400">
        <Info className="w-4 h-4 text-[#02D7E5] shrink-0 mt-0.5" />
        <p>
          <strong className="font-bold text-white">Lógica Matemática de Heats:</strong> Los atletas con 4 tests completos se ordenan de menor a mayor tiempo promedio (los más rápidos al <strong className="text-white">Heat 1</strong>, los más lentos al <strong className="text-white">Heat 6</strong>). Los atletas con tests incompletos (&lt; 4 tests) se penalizan asignándose de forma directa al <strong className="text-white">Heat 6</strong>. Dentro de cada Heat, los atletas se visualizan ordenados de menor a mayor promedio.
        </p>
      </div>
    </div>
  )
}
