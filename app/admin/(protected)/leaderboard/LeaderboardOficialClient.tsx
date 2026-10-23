'use client'

import React, { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { toggleTablaLiberada } from '../dashboard/actions'
import toast from 'react-hot-toast'
import {
  Trophy,
  Globe,
  Lock,
  Search,
  Flame,
  Clock,
  TrendingDown,
  TrendingUp,
  Minus,
  Eye,
  EyeOff,
  X,
  Users,
  User,
  Medal,
  Layers
} from 'lucide-react'
import { Categoria } from '@/src/types'

export interface AtletaLeaderboardItem {
  id: string
  usuarioId: string
  posicion: number | null
  nombres: string
  partnerNombres?: string | null
  cedula?: string
  categoriaId?: string | null
  categoriaNombre?: string | null
  categoriaTipo?: 'individual' | 'dupla' | null
  heatAsignado: string
  salidaAsignada?: string | null
  promedioMMSS: string
  promedioSegundos: number
  tiempoResultadoMMSS: string | null
  tiempoResultadoSegundos: number | null
  diferenciaSegundos: number | null
  diferenciaTexto: string
}

interface LeaderboardClientProps {
  simulacion: {
    id: string
    nombre: string
    estado: string
    tabla_liberada: boolean
  } | null
  categorias: Categoria[]
  items: AtletaLeaderboardItem[]
}

function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

export default function LeaderboardOficialClient({
  simulacion,
  categorias,
  items,
}: LeaderboardClientProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<string>('overall_individual')
  const [busqueda, setBusqueda] = useState('')
  const [heatFiltro, setHeatFiltro] = useState('TODOS')
  const [modalLiberar, setModalLiberar] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

  const tablaLiberada = Boolean(simulacion?.tabla_liberada)

  // 1. Filtrar atletas según la pestaña activa
  const itemsPorTab = useMemo(() => {
    const tabKey = (activeTab || '').toLowerCase().trim()

    if (tabKey === 'overall_individual') {
      return items.filter((i) => {
        const tipo = i.categoriaTipo?.toLowerCase().trim()
        const nombre = i.categoriaNombre?.toLowerCase().trim() || ''
        return tipo === 'individual' || (!tipo && !nombre.includes('dupla') && !i.partnerNombres)
      })
    }

    if (tabKey === 'overall_dupla' || tabKey === 'overall_duplas') {
      return items.filter((i) => {
        const tipo = i.categoriaTipo?.toLowerCase().trim()
        const nombre = i.categoriaNombre?.toLowerCase().trim() || ''
        return tipo === 'dupla' || tipo === 'duplas' || nombre.includes('dupla') || Boolean(i.partnerNombres?.trim())
      })
    }

    // Tab de Categoría específica por ID o Nombre
    const selectedCat = categorias.find((c) => {
      const cId = c.id?.toLowerCase().trim()
      const cNombre = c.nombre?.toLowerCase().trim()
      return cId === tabKey || cNombre === tabKey
    })

    return items.filter((i) => {
      const iCatId = i.categoriaId?.toLowerCase().trim()
      const iCatNombre = i.categoriaNombre?.toLowerCase().trim()

      if (iCatId && iCatId === tabKey) return true
      if (selectedCat && iCatId && iCatId === selectedCat.id?.toLowerCase().trim()) return true
      if (iCatNombre && iCatNombre === tabKey) return true
      if (selectedCat && iCatNombre && iCatNombre === selectedCat.nombre?.toLowerCase().trim()) return true
      return false
    })
  }, [items, activeTab, categorias])

  // 2. Ranking estricto para la pestaña activa:
  // Tiempos válidos (> 0) ordenados de menor a mayor con posiciones relativas 1, 2, 3...
  // Tiempos nulos/0 al final como DNF
  const itemsRankeados = useMemo(() => {
    const conTiempo = itemsPorTab.filter(
      (i) => typeof i.tiempoResultadoSegundos === 'number' && i.tiempoResultadoSegundos > 0
    )
    conTiempo.sort((a, b) => (a.tiempoResultadoSegundos || 0) - (b.tiempoResultadoSegundos || 0))

    const rankeadosConPos = conTiempo.map((item, index) => ({
      ...item,
      posicion: index + 1,
    }))

    const sinTiempo = itemsPorTab
      .filter((i) => i.tiempoResultadoSegundos === null || i.tiempoResultadoSegundos <= 0)
      .map((item) => ({
        ...item,
        posicion: null,
      }))
    sinTiempo.sort((a, b) => a.nombres.localeCompare(b.nombres))

    return [...rankeadosConPos, ...sinTiempo]
  }, [itemsPorTab])

  // 3. Heats dinámicos disponibles en el tab activo
  const heatsEnTab = useMemo(() => {
    const set = new Set<string>()
    itemsPorTab.forEach((i) => {
      if (i.heatAsignado && i.heatAsignado !== 'Sin Asignar') {
        set.add(i.heatAsignado)
      }
    })
    const list = Array.from(set)
    list.sort((a, b) => {
      const numA = parseInt(a.match(/\d+/)?.[0] || '0', 10)
      const numB = parseInt(b.match(/\d+/)?.[0] || '0', 10)
      return numA - numB
    })
    return ['TODOS', ...list]
  }, [itemsPorTab])

  // 4. Filtrar por búsqueda y Heat
  const itemsFiltrados = useMemo(() => {
    return itemsRankeados.filter((item) => {
      const matchHeat = heatFiltro === 'TODOS' || item.heatAsignado === heatFiltro
      const matchBusqueda =
        !busqueda ||
        item.nombres.toLowerCase().includes(busqueda.toLowerCase()) ||
        (item.partnerNombres && item.partnerNombres.toLowerCase().includes(busqueda.toLowerCase())) ||
        (item.cedula && item.cedula.includes(busqueda))
      return matchHeat && matchBusqueda
    })
  }, [itemsRankeados, heatFiltro, busqueda])

  // Cambiar pestaña activa y resetear filtro de heat
  const handleTabChange = (tabKey: string) => {
    setActiveTab(tabKey)
    setHeatFiltro('TODOS')
  }

  // Título y descripción dinámicos según el tab
  const tabMetadata = useMemo(() => {
    const tabKey = (activeTab || '').toLowerCase().trim()
    if (tabKey === 'overall_individual') {
      return {
        titulo: 'Overall Individual',
        descripcion: 'Clasificación unificada de todos los atletas participantes en categorías individuales.',
      }
    }
    if (tabKey === 'overall_dupla' || tabKey === 'overall_duplas') {
      return {
        titulo: 'Overall Duplas',
        descripcion: 'Clasificación unificada de todas las parejas y atletas en categorías de duplas.',
      }
    }
    const cat = categorias.find((c) => {
      const cId = c.id?.toLowerCase().trim()
      const cNombre = c.nombre?.toLowerCase().trim()
      return cId === tabKey || cNombre === tabKey
    })
    return {
      titulo: cat ? toTitleCase(cat.nombre) : 'Categoría',
      descripcion: `Ranking oficial exclusivo para la categoría ${cat ? toTitleCase(cat.nombre) : ''}.`,
    }
  }, [activeTab, categorias])

  // Confirmar liberación de la tabla
  const handleConfirmarLiberacion = async () => {
    if (!simulacion?.id) return
    setIsProcessing(true)
    const toastId = toast.loading('Liberando tabla de posiciones a los atletas...')
    try {
      const res = await toggleTablaLiberada(simulacion.id, true)
      if (res.success) {
        toast.success('¡Tabla de posiciones liberada y visible para todos los usuarios!', {
          id: toastId,
          duration: 3500,
        })
        setModalLiberar(false)
        router.refresh()
      } else {
        toast.error(res.error || 'Error al liberar la tabla.', { id: toastId })
      }
    } catch {
      toast.error('Error de red al liberar la tabla.', { id: toastId })
    } finally {
      setIsProcessing(false)
    }
  }

  // Ocultar tabla de posiciones
  const handleOcultarTabla = async () => {
    if (!simulacion?.id) return
    setIsProcessing(true)
    const toastId = toast.loading('Ocultando tabla de posiciones...')
    try {
      const res = await toggleTablaLiberada(simulacion.id, false)
      if (res.success) {
        toast.success('Tabla de posiciones ocultada. Ahora está en modo privado.', {
          id: toastId,
        })
        router.refresh()
      } else {
        toast.error(res.error || 'Error al ocultar la tabla.', { id: toastId })
      }
    } catch {
      toast.error('Error de red al ocultar la tabla.', { id: toastId })
    } finally {
      setIsProcessing(false)
    }
  }

  const countIndiv = useMemo(() => {
    return items.filter((i) => {
      const tipo = i.categoriaTipo?.toLowerCase().trim()
      const nombre = i.categoriaNombre?.toLowerCase().trim() || ''
      return tipo === 'individual' || (!tipo && !nombre.includes('dupla') && !i.partnerNombres)
    }).length
  }, [items])

  const countDupla = useMemo(() => {
    return items.filter((i) => {
      const tipo = i.categoriaTipo?.toLowerCase().trim()
      const nombre = i.categoriaNombre?.toLowerCase().trim() || ''
      return tipo === 'dupla' || tipo === 'duplas' || nombre.includes('dupla') || Boolean(i.partnerNombres?.trim())
    }).length
  }, [items])

  return (
    <div className="space-y-6">
      {/* 1. Barra de Control de Publicación y Estado */}
      <div className="p-5 md:p-6 rounded-3xl bg-zinc-950/85 border border-white/10 backdrop-blur-xl shadow-2xl flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#02D7E5]">
              Ranking Oficial
            </span>

            {tablaLiberada ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                <Eye className="w-3.5 h-3.5" />
                TABLA LIBERADA (PÚBLICA)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                <EyeOff className="w-3.5 h-3.5" />
                TABLA PRIVADA (BORRADOR)
              </span>
            )}
          </div>

          <h2 className="text-2xl font-bold text-white tracking-tight">
            {tabMetadata.titulo} — {simulacion?.nombre || 'Competición'}
          </h2>
          <p className="text-xs text-zinc-400">
            {tabMetadata.descripcion} Atletas clasificados de menor a mayor tiempo oficial en pista.
          </p>
        </div>

        {/* Botón Exclusivo de Publicación */}
        <div>
          {!tablaLiberada ? (
            <button
              type="button"
              onClick={() => setModalLiberar(true)}
              disabled={!simulacion}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-[#02D7E5] hover:bg-[#02D7E5]/90 text-black font-extrabold text-sm shadow-xl shadow-[#02D7E5]/25 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
            >
              <Globe className="w-4 h-4 text-black" />
              <span>Liberar Tabla de Posiciones a Usuarios</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleOcultarTabla}
              disabled={isProcessing || !simulacion}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 font-bold text-xs active:scale-95 transition-all cursor-pointer disabled:opacity-50"
            >
              <Lock className="w-4 h-4 text-zinc-400" />
              <span>Ocultar Tabla a Usuarios</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Sistema de Navegación por Pestañas (Tabs) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none border-b border-zinc-900 pt-1">
        {/* Tab 1: Overall Individual */}
        <button
          type="button"
          onClick={() => handleTabChange('overall_individual')}
          className={`shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'overall_individual'
              ? 'bg-[#02D7E5] text-black shadow-lg shadow-[#02D7E5]/25'
              : 'bg-zinc-900/90 text-zinc-400 hover:text-white border border-white/5'
          }`}
        >
          <User className="w-3.5 h-3.5" />
          <span>Overall Individual</span>
          <span
            className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
              activeTab === 'overall_individual' ? 'bg-black text-[#02D7E5]' : 'bg-white/10 text-zinc-300'
            }`}
          >
            {countIndiv}
          </span>
        </button>

        {/* Tab 2: Overall Duplas */}
        <button
          type="button"
          onClick={() => handleTabChange('overall_dupla')}
          className={`shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'overall_dupla'
              ? 'bg-[#02D7E5] text-black shadow-lg shadow-[#02D7E5]/25'
              : 'bg-zinc-900/90 text-zinc-400 hover:text-white border border-white/5'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Overall Duplas</span>
          <span
            className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
              activeTab === 'overall_dupla' ? 'bg-black text-[#02D7E5]' : 'bg-white/10 text-zinc-300'
            }`}
          >
            {countDupla}
          </span>
        </button>

        <div className="h-6 w-px bg-zinc-800 mx-1 shrink-0" />

        {/* Tabs 3 a 6: Tablas separadas por Categoría específica */}
        {categorias.map((cat) => {
          const catIdNorm = cat.id?.toLowerCase().trim()
          const catNombreNorm = cat.nombre?.toLowerCase().trim()
          const isSelected =
            activeTab?.toLowerCase().trim() === catIdNorm ||
            activeTab?.toLowerCase().trim() === catNombreNorm

          const countCat = items.filter((i) => {
            const iCatId = i.categoriaId?.toLowerCase().trim()
            const iCatNombre = i.categoriaNombre?.toLowerCase().trim()
            return iCatId === catIdNorm || (iCatNombre && iCatNombre === catNombreNorm)
          }).length

          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => handleTabChange(cat.id)}
              className={`shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                isSelected
                  ? 'bg-amber-400 text-black shadow-lg shadow-amber-400/25'
                  : 'bg-zinc-900/90 text-zinc-400 hover:text-white border border-white/5'
              }`}
            >
              <Medal className="w-3.5 h-3.5" />
              <span>{toTitleCase(cat.nombre)}</span>
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                  isSelected ? 'bg-black text-amber-400' : 'bg-white/10 text-zinc-300'
                }`}
              >
                {countCat}
              </span>
            </button>
          )
        })}
      </div>

      {/* 3. Filtros Secundarios y Búsqueda */}
      <div className="p-4 md:p-5 rounded-3xl bg-zinc-950/70 border border-white/10 backdrop-blur-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Chips de Heats dinámicos para esta vista */}
        <div className="flex flex-wrap items-center gap-2 overflow-x-auto pb-1">
          <span className="text-xs font-bold text-zinc-500 mr-1 flex items-center gap-1">
            <Flame className="w-3.5 h-3.5 text-amber-400" />
            Heats:
          </span>
          {heatsEnTab.map((heat) => {
            const isSel = heatFiltro === heat
            return (
              <button
                key={heat}
                type="button"
                onClick={() => setHeatFiltro(heat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                  isSel
                    ? 'bg-[#02D7E5] text-black shadow-md shadow-[#02D7E5]/20'
                    : 'bg-zinc-900 text-zinc-400 hover:text-white border border-white/5'
                }`}
              >
                {heat}
              </button>
            )
          })}
        </div>

        {/* Buscador */}
        <div className="relative w-full md:w-64 shrink-0">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por nombre o CI..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-zinc-900/90 border border-white/10 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#02D7E5]"
          />
        </div>
      </div>

      {/* 4. Tabla de Leaderboard Reutilizable con Datos Filtrados */}
      <div className="rounded-3xl bg-zinc-950/80 border border-white/10 backdrop-blur-xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 bg-zinc-900/40 text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                <th className="py-3.5 px-4 text-center w-16">Pos</th>
                <th className="py-3.5 px-4">Atleta</th>
                <th className="py-3.5 px-4 text-center">Categoría</th>
                <th className="py-3.5 px-4 text-center">Heat</th>
                <th className="py-3.5 px-4 text-center">Promedio Previo</th>
                <th className="py-3.5 px-4 text-center">Tiempo Final</th>
                <th className="py-3.5 px-4 text-center">Diferencia</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-xs">
              {itemsFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-zinc-500">
                    No se encontraron atletas registrados para esta pestaña o filtro.
                  </td>
                </tr>
              ) : (
                itemsFiltrados.map((item) => {
                  const tieneTiempo =
                    typeof item.tiempoResultadoSegundos === 'number' && item.tiempoResultadoSegundos > 0
                  const esPodio = tieneTiempo && item.posicion !== null && item.posicion <= 3

                  return (
                    <tr key={item.id} className="hover:bg-white/[0.02] transition-colors">
                      {/* Posición Relativa al Tab */}
                      <td className="py-3.5 px-4 text-center font-bold">
                        {tieneTiempo && item.posicion !== null ? (
                          item.posicion === 1 ? (
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-xl bg-amber-400 text-black font-extrabold text-xs shadow-md shadow-amber-400/25">
                              🥇
                            </span>
                          ) : item.posicion === 2 ? (
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-xl bg-zinc-300 text-black font-extrabold text-xs shadow-md">
                              🥈
                            </span>
                          ) : item.posicion === 3 ? (
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-xl bg-amber-700 text-white font-extrabold text-xs shadow-md">
                              🥉
                            </span>
                          ) : (
                            <span className="text-zinc-400 font-bold">#{item.posicion}</span>
                          )
                        ) : (
                          <span className="inline-block px-2 py-0.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-500 font-bold text-[10px]">
                            DNF
                          </span>
                        )}
                      </td>

                      {/* Atleta */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5">
                          <p className={`font-bold text-sm ${esPodio ? 'text-white' : 'text-zinc-200'}`}>
                            {item.nombres}
                            {item.partnerNombres && (
                              <span className="text-[#02D7E5] font-semibold text-xs ml-1.5">
                                & {item.partnerNombres}
                              </span>
                            )}
                          </p>
                          {item.cedula && (
                            <p className="text-[10px] text-zinc-500">CI: {item.cedula}</p>
                          )}
                        </div>
                      </td>

                      {/* Categoría */}
                      <td className="py-3.5 px-4 text-center">
                        {item.categoriaNombre ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-zinc-900 border border-white/10 text-[11px] font-bold text-[#02D7E5]">
                            {toTitleCase(item.categoriaNombre)}
                          </span>
                        ) : (
                          <span className="text-zinc-600 font-semibold">—</span>
                        )}
                      </td>

                      {/* Heat */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="inline-flex flex-col items-center gap-0.5">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-zinc-900 border border-white/10 text-xs font-bold text-white max-w-[180px] truncate">
                            <Flame className="w-3 h-3 text-amber-400 shrink-0" />
                            <span className="truncate">{item.heatAsignado}</span>
                          </span>
                          {item.salidaAsignada && (
                            <span className="text-[10px] text-zinc-400 font-semibold">
                              {item.salidaAsignada}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Promedio Previo */}
                      <td className="py-3.5 px-4 text-center text-zinc-400 font-semibold">
                        {item.promedioMMSS}
                      </td>

                      {/* Tiempo Final Oficial */}
                      <td className="py-3.5 px-4 text-center">
                        {tieneTiempo ? (
                          <span
                            className={`inline-block px-3 py-1 rounded-xl font-bold text-xs tracking-wider ${
                              esPodio
                                ? 'bg-amber-400/20 text-amber-300 border border-amber-400/40'
                                : 'bg-[#02D7E5]/15 text-[#02D7E5] border border-[#02D7E5]/30'
                            }`}
                          >
                            {item.tiempoResultadoMMSS}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 font-bold text-xs tracking-wider">
                            DNF
                          </span>
                        )}
                      </td>

                      {/* Diferencia vs Promedio */}
                      <td className="py-3.5 px-4 text-center">
                        {tieneTiempo && item.diferenciaSegundos !== null ? (
                          item.diferenciaSegundos < 0 ? (
                            <span className="inline-flex items-center gap-1 text-emerald-400 font-bold text-xs">
                              <TrendingDown className="w-3.5 h-3.5" />
                              <span>{item.diferenciaTexto}</span>
                            </span>
                          ) : item.diferenciaSegundos > 0 ? (
                            <span className="inline-flex items-center gap-1 text-amber-400 font-bold text-xs">
                              <TrendingUp className="w-3.5 h-3.5" />
                              <span>{item.diferenciaTexto}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-zinc-400 font-bold text-xs">
                              <Minus className="w-3.5 h-3.5" />
                              <span>00:00</span>
                            </span>
                          )
                        ) : (
                          <span className="text-zinc-600 font-semibold">—</span>
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

      {/* DRAWER LATERAL: Confirmación para Liberar Tabla de Posiciones */}
      <div
        className={`fixed inset-0 z-50 transition-opacity duration-300 ${
          modalLiberar ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Backdrop oscuro */}
        <div
          className="absolute inset-0 bg-black/80 backdrop-blur-sm cursor-pointer"
          onClick={() => !isProcessing && setModalLiberar(false)}
        />

        {/* Panel lateral derecho (Slide-over) */}
        <div
          className={`absolute inset-y-0 right-0 w-full sm:w-96 bg-zinc-950 border-l border-white/10 shadow-2xl p-6 flex flex-col justify-between transform transition-transform duration-300 ease-in-out ${
            modalLiberar ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <div className="space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#02D7E5]/10 border border-[#02D7E5]/30 flex items-center justify-center text-[#02D7E5]">
                  <Trophy className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#02D7E5]">
                    Confirmación
                  </span>
                  <h3 className="text-lg font-bold text-white tracking-tight">
                    Liberar Tabla
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !isProcessing && setModalLiberar(false)}
                className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-zinc-900/70 border border-zinc-800 text-xs text-zinc-300 leading-relaxed">
                ¿Estás seguro que deseas liberar la tabla de posiciones? Todos los atletas registrados podrán ver el ranking general y sus resultados oficiales en su módulo de Competición.
              </div>

              <div className="p-3.5 rounded-2xl bg-cyan-950/20 border border-[#02D7E5]/20 flex items-start gap-2.5">
                <Globe className="w-4 h-4 text-[#02D7E5] shrink-0 mt-0.5" />
                <p className="text-[11px] text-[#02D7E5] font-semibold leading-relaxed">
                  Esta acción hace pública la clasificación oficial en tiempo real para todos los participantes.
                </p>
              </div>
            </div>
          </div>

          {/* Footer de Acciones del Drawer */}
          <div className="pt-6 border-t border-white/10 flex items-center gap-3">
            <button
              type="button"
              onClick={() => setModalLiberar(false)}
              disabled={isProcessing}
              className="flex-1 py-3 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs border border-zinc-800 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirmarLiberacion}
              disabled={isProcessing}
              className="flex-1 py-3 rounded-2xl bg-[#02D7E5] hover:bg-[#02D7E5]/90 text-black font-extrabold text-xs shadow-lg shadow-[#02D7E5]/25 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
            >
              {isProcessing ? 'Liberando...' : 'Confirmar y Liberar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
