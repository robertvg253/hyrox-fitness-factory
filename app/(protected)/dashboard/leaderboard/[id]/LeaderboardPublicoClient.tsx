'use client'

import React, { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  Trophy,
  ArrowLeft,
  Search,
  X,
  Medal,
  Users,
  User,
  Clock,
  Sparkles,
  Info
} from 'lucide-react'
import { Categoria } from '@/src/types'

export interface AtletaPublicoItem {
  id: string
  usuarioId: string
  nombres: string
  partnerNombres?: string | null
  categoriaId?: string | null
  categoriaNombre?: string | null
  categoriaTipo: 'individual' | 'dupla'
  tiempoResultadoSegundos: number | null
  tiempoResultadoMMSS: string
}

interface LeaderboardPublicoClientProps {
  simulacion: {
    id: string
    nombre: string
    estado: string
    tabla_liberada: boolean
  }
  categorias: Categoria[]
  items: AtletaPublicoItem[]
  currentUserId: string
}

export default function LeaderboardPublicoClient({
  simulacion,
  categorias,
  items,
  currentUserId,
}: LeaderboardPublicoClientProps) {
  const [activeTab, setActiveTab] = useState<string>('overall_individual')
  const [busqueda, setBusqueda] = useState<string>('')

  // Lista de categorías únicas presentes en la data o configuración
  const tabsCategorias = useMemo(() => {
    const list: { id: string; label: string; tipo: 'individual' | 'dupla' }[] = []
    
    // Categorías oficiales
    categorias.forEach((c) => {
      const existe = list.some((item) => item.id === c.id || item.label.toLowerCase() === c.nombre.toLowerCase())
      if (!existe) {
        list.push({
          id: c.id,
          label: c.nombre,
          tipo: (c.tipo as 'individual' | 'dupla') || 'individual'
        })
      }
    })

    // Asegurarse de incluir categorías presentes en los items por si difieren
    items.forEach((item) => {
      if (item.categoriaNombre) {
        const existe = list.some((c) => c.label.toLowerCase() === item.categoriaNombre?.toLowerCase())
        if (!existe && item.categoriaId) {
          list.push({
            id: item.categoriaId,
            label: item.categoriaNombre,
            tipo: item.categoriaTipo
          })
        }
      }
    })

    return list
  }, [categorias, items])

  // Filtrado de atletas según la pestaña activa
  const itemsPorTab = useMemo(() => {
    const tabKey = (activeTab || '').toLowerCase().trim()

    if (tabKey === 'overall_individual') {
      return items.filter((i) => i.categoriaTipo === 'individual')
    }

    if (tabKey === 'overall_dupla' || tabKey === 'overall_duplas') {
      return items.filter((i) => i.categoriaTipo === 'dupla')
    }

    // Pestaña de Categoría específica por ID o Nombre
    const catTarget = tabsCategorias.find(
      (c) => c.id.toLowerCase() === tabKey || c.label.toLowerCase() === tabKey
    )

    return items.filter((i) => {
      const iCatId = i.categoriaId?.toLowerCase().trim()
      const iCatNombre = i.categoriaNombre?.toLowerCase().trim()

      if (iCatId && iCatId === tabKey) return true
      if (catTarget && iCatId && iCatId === catTarget.id.toLowerCase()) return true
      if (iCatNombre && iCatNombre === tabKey) return true
      if (catTarget && iCatNombre && iCatNombre === catTarget.label.toLowerCase()) return true
      return false
    })
  }, [items, activeTab, tabsCategorias])

  // Ranking estricto para el Tab activo:
  // Tiempos válidos (> 0) ordenados de menor a mayor con posiciones relativas 1, 2, 3...
  // Tiempos nulos o 0 al final como DNF
  const itemsRankeados = useMemo(() => {
    const conTiempo = itemsPorTab.filter(
      (i) => typeof i.tiempoResultadoSegundos === 'number' && i.tiempoResultadoSegundos > 0
    )
    conTiempo.sort((a, b) => (a.tiempoResultadoSegundos || 0) - (b.tiempoResultadoSegundos || 0))

    const rankeadosConPos = conTiempo.map((item, index) => ({
      ...item,
      posicion: index + 1 as number | null,
    }))

    const sinTiempo = itemsPorTab
      .filter((i) => i.tiempoResultadoSegundos === null || i.tiempoResultadoSegundos <= 0)
      .map((item) => ({
        ...item,
        posicion: null, // DNF
      }))
    sinTiempo.sort((a, b) => a.nombres.localeCompare(b.nombres))

    return [...rankeadosConPos, ...sinTiempo]
  }, [itemsPorTab])

  // Filtrar por búsqueda de nombre / partner
  const itemsFiltrados = useMemo(() => {
    if (!busqueda.trim()) return itemsRankeados
    const q = busqueda.toLowerCase().trim()
    return itemsRankeados.filter((item) => {
      const matchAtleta = item.nombres.toLowerCase().includes(q)
      const matchPartner = item.partnerNombres ? item.partnerNombres.toLowerCase().includes(q) : false
      const matchCat = item.categoriaNombre ? item.categoriaNombre.toLowerCase().includes(q) : false
      return matchAtleta || matchPartner || matchCat
    })
  }, [itemsRankeados, busqueda])

  // Conteo de participantes en la pestaña activa
  const totalClasificados = itemsRankeados.filter((i) => i.posicion !== null).length
  const totalDNF = itemsRankeados.filter((i) => i.posicion === null).length

  // Encontrar posición del atleta actual en este tab (si compitió aquí)
  const miResultadoEnTab = useMemo(() => {
    return itemsRankeados.find((i) => i.usuarioId === currentUserId)
  }, [itemsRankeados, currentUserId])

  return (
    <div className="space-y-4 px-4 pt-3 pb-8">
      {/* 1. Header Simple Móvil */}
      <div className="space-y-2">
        <Link
          href="/dashboard/competicion"
          className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Volver a Competición</span>
        </Link>

        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-[#02D7E5]/10 border border-[#02D7E5]/30 text-[#02D7E5] font-bold text-[10px] uppercase tracking-wider">
                Resultados Oficiales
              </span>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight mt-1">
              Leaderboard Oficial
            </h1>
            <p className="text-xs text-zinc-400 font-medium">
              {simulacion.nombre}
            </p>
          </div>

          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#02D7E5]/20 to-black border border-[#02D7E5]/40 flex items-center justify-center shrink-0 shadow-lg shadow-[#02D7E5]/10">
            <Trophy className="w-5 h-5 text-[#02D7E5]" />
          </div>
        </div>
      </div>

      {/* Tarjeta destacada de posición personal (si compitió en este tab) */}
      {miResultadoEnTab && (
        <div className="p-3.5 rounded-2xl bg-gradient-to-r from-[#02D7E5]/15 via-zinc-900 to-zinc-950 border border-[#02D7E5]/40 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#02D7E5] text-black font-black flex items-center justify-center text-sm shadow-md shadow-[#02D7E5]/20">
              {miResultadoEnTab.posicion ? `#${miResultadoEnTab.posicion}` : 'DNF'}
            </div>
            <div>
              <p className="text-[11px] font-bold text-[#02D7E5] uppercase tracking-wider">
                Tu Posición en este Tab
              </p>
              <p className="text-xs text-white font-semibold truncate max-w-[180px]">
                {miResultadoEnTab.nombres}
                {miResultadoEnTab.partnerNombres ? ` + ${miResultadoEnTab.partnerNombres}` : ''}
              </p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[10px] text-zinc-400 block font-medium">Tiempo Final</span>
            <span className="text-sm font-bold text-white">
              {miResultadoEnTab.tiempoResultadoMMSS}
            </span>
          </div>
        </div>
      )}

      {/* 2. Botonera de Tabs deslizables horizontalmente */}
      <div className="relative">
        <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap hide-scrollbar py-1">
          {/* Tab: Overall Individual */}
          <button
            type="button"
            onClick={() => setActiveTab('overall_individual')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
              activeTab === 'overall_individual'
                ? 'bg-[#02D7E5] text-black shadow-lg shadow-[#02D7E5]/25 scale-[1.02]'
                : 'bg-zinc-900/90 text-zinc-400 hover:text-white hover:bg-zinc-800 border border-white/5'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Overall Individual</span>
          </button>

          {/* Tab: Overall Duplas */}
          <button
            type="button"
            onClick={() => setActiveTab('overall_dupla')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
              activeTab === 'overall_dupla'
                ? 'bg-[#02D7E5] text-black shadow-lg shadow-[#02D7E5]/25 scale-[1.02]'
                : 'bg-zinc-900/90 text-zinc-400 hover:text-white hover:bg-zinc-800 border border-white/5'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Overall Duplas</span>
          </button>

          {/* Tabs por cada categoría existente */}
          {tabsCategorias.map((cat) => {
            const isActive = activeTab.toLowerCase() === cat.id.toLowerCase() || activeTab.toLowerCase() === cat.label.toLowerCase()
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveTab(cat.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                  isActive
                    ? 'bg-[#02D7E5] text-black shadow-lg shadow-[#02D7E5]/25 scale-[1.02]'
                    : 'bg-zinc-900/90 text-zinc-400 hover:text-white hover:bg-zinc-800 border border-white/5'
                }`}
              >
                <span>{cat.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* 3. Buscador sutil para encontrar atletas rápidamente */}
      <div className="relative">
        <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar atleta por nombre..."
          className="w-full bg-zinc-950/90 border border-white/10 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#02D7E5] transition-colors"
        />
        {busqueda && (
          <button
            onClick={() => setBusqueda('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Metadata resumen del tab */}
      <div className="flex items-center justify-between text-[11px] text-zinc-400 px-1 font-medium">
        <span>
          Mostrando <strong className="text-white font-bold">{itemsFiltrados.length}</strong> atletas
        </span>
        <div className="flex items-center gap-2">
          <span>Clasificados: <strong className="text-[#02D7E5] font-bold">{totalClasificados}</strong></span>
          {totalDNF > 0 && (
            <span>DNF: <strong className="text-zinc-500 font-bold">{totalDNF}</strong></span>
          )}
        </div>
      </div>

      {/* 4. Tabla de Posiciones con Scroll Interno Estricto */}
      <div className="relative rounded-2xl border border-white/10 bg-zinc-950/90 overflow-hidden shadow-2xl backdrop-blur-xl">
        <div className="max-h-[60vh] overflow-y-auto divide-y divide-white/5">
          <table className="w-full text-left text-xs border-collapse">
            {/* Header Sticky */}
            <thead className="sticky top-0 z-10 bg-zinc-900/95 backdrop-blur-md text-[10px] font-bold text-zinc-400 uppercase tracking-wider border-b border-white/10">
              <tr>
                <th className="py-2.5 px-3 w-14 text-center">Pos</th>
                <th className="py-2.5 px-3">Atleta</th>
                <th className="py-2.5 px-2 text-center">Categoría</th>
                <th className="py-2.5 px-3 text-right">Tiempo Final</th>
              </tr>
            </thead>

            {/* Cuerpo de la Tabla */}
            <tbody className="divide-y divide-white/5 text-zinc-300">
              {itemsFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-zinc-500">
                    <p className="text-xs font-medium">No se encontraron atletas en esta categoría.</p>
                  </td>
                </tr>
              ) : (
                itemsFiltrados.map((item) => {
                  const esYo = item.usuarioId === currentUserId
                  const esDNF = item.posicion === null

                  // Render badge o podio de posición
                  let badgePosicion: React.ReactNode = null
                  if (item.posicion === 1) {
                    badgePosicion = (
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-xl bg-amber-400 text-black font-black text-xs shadow-md shadow-amber-400/30">
                        1
                      </span>
                    )
                  } else if (item.posicion === 2) {
                    badgePosicion = (
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-xl bg-zinc-300 text-black font-black text-xs shadow-md shadow-zinc-300/20">
                        2
                      </span>
                    )
                  } else if (item.posicion === 3) {
                    badgePosicion = (
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-xl bg-amber-700 text-white font-black text-xs shadow-md shadow-amber-700/20">
                        3
                      </span>
                    )
                  } else if (esDNF) {
                    badgePosicion = (
                      <span className="inline-block px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 font-bold text-[9px] border border-white/5">
                        DNF
                      </span>
                    )
                  } else {
                    badgePosicion = (
                      <span className="font-bold text-zinc-400 text-xs">
                        #{item.posicion}
                      </span>
                    )
                  }

                  return (
                    <tr
                      key={item.id}
                      className={`transition-colors hover:bg-white/[0.03] ${
                        esYo
                          ? 'bg-[#02D7E5]/10 border-l-2 border-[#02D7E5]'
                          : ''
                      }`}
                    >
                      {/* Columna: Posición */}
                      <td className="py-3 px-3 text-center align-middle whitespace-nowrap">
                        {badgePosicion}
                      </td>

                      {/* Columna: Atleta */}
                      <td className="py-3 px-3 align-middle">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`font-semibold text-xs leading-tight ${esYo ? 'text-[#02D7E5]' : 'text-white'}`}>
                            {item.nombres}
                          </span>
                          {esYo && (
                            <span className="px-1.5 py-0.2 rounded bg-[#02D7E5] text-black font-extrabold text-[9px] uppercase tracking-wide">
                              Tú
                            </span>
                          )}
                        </div>
                        {item.partnerNombres && (
                          <div className="text-[10px] text-zinc-400 font-medium flex items-center gap-1 mt-0.5">
                            <span className="text-zinc-600">+</span>
                            <span className="truncate max-w-[140px]">{item.partnerNombres}</span>
                          </div>
                        )}
                      </td>

                      {/* Columna: Categoría */}
                      <td className="py-3 px-2 text-center align-middle whitespace-nowrap">
                        <span className="inline-block px-2 py-0.5 rounded-full bg-zinc-900 border border-white/10 text-[10px] font-semibold text-zinc-300">
                          {item.categoriaNombre || 'General'}
                        </span>
                      </td>

                      {/* Columna: Tiempo Final */}
                      <td className="py-3 px-3 text-right align-middle whitespace-nowrap">
                        <span
                          className={`font-mono text-xs font-bold tracking-tight ${
                            esDNF
                              ? 'text-zinc-500 font-normal'
                              : 'text-[#02D7E5]'
                          }`}
                        >
                          {item.tiempoResultadoMMSS}
                        </span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
