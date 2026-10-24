'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Flame,
  Users,
  Clock,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Info,
  Layers,
  Sparkles
} from 'lucide-react'
import { Categoria } from '@/src/types'

export interface AtletaKanban {
  id: string
  usuarioId: string
  dorsal?: string | null
  nombres: string
  cedula?: string
  categoriaId?: string | null
  categoriaNombre?: string | null
  categoriaTipo?: 'individual' | 'dupla' | null
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
  categorias: Categoria[]
  atletas: AtletaKanban[]
}

export default function TableroKanbanHeats({
  simulacion,
  categorias,
  atletas,
}: TableroKanbanHeatsProps) {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>('TODAS')

  // Función para ordenar atletas de MENOR a MAYOR promedio (más rápidos arriba)
  const sortAtletasAsc = (a: AtletaKanban, b: AtletaKanban) => {
    if (!a.promedioSegundos && b.promedioSegundos) return 1
    if (a.promedioSegundos && !b.promedioSegundos) return -1
    if (a.promedioSegundos !== b.promedioSegundos) {
      return a.promedioSegundos - b.promedioSegundos
    }
    return a.nombres.localeCompare(b.nombres)
  }

  // Obtener lista dinámica de todos los heats actualmente asignados, ordenados por número secuencial
  const allAssignedHeats = useMemo(() => {
    const set = new Set<string>()
    atletas.forEach((a) => {
      if (a.heatAsignado) set.add(a.heatAsignado)
    })
    const list = Array.from(set)
    list.sort((a, b) => {
      const numA = parseInt(a.match(/\d+/)?.[0] || '0', 10)
      const numB = parseInt(b.match(/\d+/)?.[0] || '0', 10)
      return numA - numB
    })
    return list
  }, [atletas])

  // Organizar atletas por columnas dinámicas con orden interno de MENOR a MAYOR promedio
  const columns = useMemo(() => {
    const cols: Record<string, AtletaKanban[]> = {
      sin_asignar: [],
    }
    allAssignedHeats.forEach((h) => {
      cols[h] = []
    })

    atletas.forEach((atleta) => {
      if (atleta.heatAsignado && cols[atleta.heatAsignado]) {
        cols[atleta.heatAsignado].push(atleta)
      } else {
        cols.sin_asignar.push(atleta)
      }
    })

    // Ordenar atletas dentro de cada Heat de menor a mayor promedio
    Object.keys(cols).forEach((k) => {
      cols[k].sort(sortAtletasAsc)
    })

    return cols
  }, [atletas, allAssignedHeats])

  useEffect(() => {
    setMounted(true)
  }, [])

  // Conteo de métricas
  const totalAtletas = atletas.length
  const sinAsignarCount = columns.sin_asignar?.length || 0
  const totalAsignados = totalAtletas - sinAsignarCount

  // Filtrar heats visibles según la pestaña de categoría seleccionada
  const heatsVisibles = useMemo(() => {
    if (categoriaFiltro === 'TODAS') return allAssignedHeats
    return allAssignedHeats.filter((h) =>
      h.toLowerCase().includes(categoriaFiltro.toLowerCase().trim())
    )
  }, [allAssignedHeats, categoriaFiltro])

  // SSR hydration placeholder
  if (!mounted) {
    return (
      <div className="p-8 rounded-3xl bg-zinc-950/60 border border-white/10 flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3 text-zinc-400">
          <RefreshCw className="w-8 h-8 animate-spin text-[#02D7E5]" />
          <p className="text-sm font-semibold">Cargando visualizador de Heats...</p>
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

          <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-zinc-900/90 border border-white/10 text-xs">
            <Layers className="w-4 h-4 text-[#02D7E5]" />
            <span className="text-zinc-400">Heats Generados:</span>
            <span className="font-bold text-white">{allAssignedHeats.length}</span>
          </div>

          {sinAsignarCount > 0 && (
            <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs">
              <AlertCircle className="w-4 h-4 text-amber-400" />
              <span className="text-zinc-400">Sin Asignar:</span>
              <span className="font-bold text-amber-400">{sinAsignarCount}</span>
            </div>
          )}
        </div>
      </div>

      {/* Selector de Pestañas por Categoría */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        <button
          type="button"
          onClick={() => setCategoriaFiltro('TODAS')}
          className={`shrink-0 px-4 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
            categoriaFiltro === 'TODAS'
              ? 'bg-[#02D7E5] text-black shadow-lg shadow-[#02D7E5]/25'
              : 'bg-zinc-900/90 text-zinc-400 hover:text-white border border-white/5'
          }`}
        >
          Todos los Heats ({allAssignedHeats.length})
        </button>

        {categorias.map((cat) => {
          const isSelected = categoriaFiltro === cat.nombre
          const countHeatsCat = allAssignedHeats.filter((h) =>
            h.toLowerCase().includes(cat.nombre.toLowerCase().trim())
          ).length

          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setCategoriaFiltro(cat.nombre)}
              className={`shrink-0 flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                isSelected
                  ? 'bg-[#02D7E5] text-black shadow-lg shadow-[#02D7E5]/25'
                  : 'bg-zinc-900/90 text-zinc-400 hover:text-white border border-white/5'
              }`}
            >
              <span>{cat.nombre}</span>
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                  isSelected ? 'bg-black text-[#02D7E5]' : 'bg-white/10 text-zinc-300'
                }`}
              >
                {countHeatsCat}
              </span>
            </button>
          )
        })}
      </div>

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
              Atletas registrados sin tanda de Heat asignada por la mesa técnica
            </span>
          </div>

          <div className="flex flex-wrap gap-2.5 p-3 rounded-2xl min-h-[70px] bg-zinc-900/60 border border-white/5">
            {columns.sin_asignar.map((atleta) => (
              <div
                key={atleta.id}
                className="px-3 py-2 rounded-xl bg-zinc-900/95 border border-white/10 flex items-center gap-2 shadow-md"
              >
                <div className="flex items-center gap-2">
                  {atleta.dorsal ? (
                    <span className="px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold bg-[#02D7E5]/15 border border-[#02D7E5]/30 text-[#02D7E5] shrink-0">
                      #{atleta.dorsal}
                    </span>
                  ) : (
                    <span className="px-1 py-0.5 rounded-md text-[9px] font-mono font-semibold bg-zinc-800 text-zinc-500 border border-zinc-700/50 shrink-0">
                      S/D
                    </span>
                  )}
                  <span className="font-bold text-xs text-white max-w-[140px] truncate">
                    {atleta.nombres}
                  </span>
                  {atleta.categoriaNombre && (
                    <span className="px-1.5 py-0.5 rounded bg-[#02D7E5]/15 border border-[#02D7E5]/30 text-[9px] font-bold text-[#02D7E5] truncate max-w-[100px]">
                      {atleta.categoriaNombre}
                    </span>
                  )}
                  <span className="px-1.5 py-0.5 rounded bg-white/10 border border-white/10 text-[10px] font-semibold text-zinc-300">
                    {atleta.promedioMMSS}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tablero de Heats Dinámico (Modo Visualización Seguro) */}
      {heatsVisibles.length === 0 ? (
        <div className="p-12 rounded-3xl bg-zinc-950/60 border border-white/10 text-center flex flex-col items-center justify-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Sparkles className="w-7 h-7" />
          </div>
          <div className="max-w-md space-y-1">
            <h3 className="text-base font-bold text-white">No hay Heats generados para esta vista</h3>
            <p className="text-xs text-zinc-400">
              Los heats se heredan automáticamente desde las preinscripciones según la configuración de la mesa técnica.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {heatsVisibles.map((heatKey) => {
            const heatAtletas = columns[heatKey] || []
            const esCapacidadCompleta = heatAtletas.length === 10
            const esExcedido = heatAtletas.length > 10

            return (
              <div
                key={heatKey}
                className="flex flex-col rounded-3xl bg-zinc-950/85 border border-white/10 backdrop-blur-xl shadow-2xl"
              >
                {/* Cabecera del Heat Dinámico */}
                <div className="p-4 border-b border-white/10 flex items-center justify-between bg-zinc-900/40">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-[#02D7E5]/10 border border-[#02D7E5]/30 flex items-center justify-center shrink-0">
                      <Flame className="w-4 h-4 text-[#02D7E5]" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-white tracking-tight truncate" title={heatKey}>
                        {heatKey}
                      </h3>
                      <p className="text-[10px] font-semibold text-zinc-400">
                        Máx 10 Atletas
                      </p>
                    </div>
                  </div>

                  <span
                    className={`px-2.5 py-1 rounded-xl border text-xs font-bold shrink-0 ${
                      esExcedido
                        ? 'bg-red-500/20 text-red-400 border-red-500/40'
                        : esCapacidadCompleta
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                        : 'bg-white/5 border-white/10 text-white'
                    }`}
                  >
                    {heatAtletas.length}/10
                  </span>
                </div>

                {/* Lista de Atletas con altura delimitada y scroll vertical interno */}
                <div className="flex-1 p-3.5 h-[380px] overflow-y-auto space-y-2.5">
                  {heatAtletas.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-4 border border-dashed border-white/10 rounded-2xl text-zinc-500">
                      <Clock className="w-6 h-6 mb-2 text-zinc-600" />
                      <p className="text-xs font-bold text-zinc-400">Sin atletas asignados</p>
                      <p className="text-[11px] text-zinc-500 mt-0.5">
                        No hay participantes registrados en este Heat
                      </p>
                    </div>
                  ) : (
                    heatAtletas.map((atleta, index) => (
                      <div
                        key={atleta.id}
                        className="p-3 rounded-2xl bg-zinc-900/90 border border-white/10 shadow-sm flex items-center justify-between gap-3 select-none"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="w-5 h-5 rounded-lg bg-white/5 border border-white/10 text-[10px] font-bold text-zinc-400 flex items-center justify-center shrink-0">
                            {index + 1}
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              {atleta.dorsal ? (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold bg-[#02D7E5]/15 text-[#02D7E5] border border-[#02D7E5]/30 shrink-0">
                                  #{atleta.dorsal}
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-1 py-0.5 rounded-md text-[9px] font-mono font-semibold bg-zinc-800 text-zinc-500 border border-zinc-700/50 shrink-0">
                                  S/D
                                </span>
                              )}
                              <p className="font-bold text-sm text-white truncate">
                                {atleta.nombres}
                              </p>
                            </div>
                            {atleta.cedula && (
                              <p className="text-[10px] text-zinc-500 truncate mt-0.5">
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
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Nota Informativa Inferior */}
      <div className="p-4 rounded-2xl bg-zinc-950/60 border border-white/10 flex items-start gap-3 text-xs text-zinc-400">
        <Info className="w-4 h-4 text-[#02D7E5] shrink-0 mt-0.5" />
        <p>
          <strong className="font-bold text-white">Visualización Oficial de Heats:</strong> Los heats asignados por la mesa técnica en las preinscripciones se visualizan en modo seguro y protegido contra modificaciones accidentales para garantizar la consistencia de la competición.
        </p>
      </div>
    </div>
  )
}
