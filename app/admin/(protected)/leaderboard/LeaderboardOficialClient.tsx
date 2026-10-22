'use client'

import React, { useState } from 'react'
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
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  X
} from 'lucide-react'

export interface AtletaLeaderboardItem {
  id: string
  usuarioId: string
  posicion: number | null
  nombres: string
  cedula?: string
  heatAsignado: string
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
  items: AtletaLeaderboardItem[]
}

export default function LeaderboardOficialClient({
  simulacion,
  items
}: LeaderboardClientProps) {
  const router = useRouter()
  const [busqueda, setBusqueda] = useState('')
  const [heatFiltro, setHeatFiltro] = useState('TODOS')
  const [modalLiberar, setModalLiberar] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

  const tablaLiberada = Boolean(simulacion?.tabla_liberada)

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
          duration: 3500
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
          id: toastId
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

  // Filtrado de atletas y ordenamiento estricto: tiempos válidos primero (menor a mayor), nulos al final como DNF
  const itemsFiltrados = items
    .filter((item) => {
      const matchHeat = heatFiltro === 'TODOS' || item.heatAsignado === heatFiltro
      const matchBusqueda =
        !busqueda ||
        item.nombres.toLowerCase().includes(busqueda.toLowerCase()) ||
        (item.cedula && item.cedula.includes(busqueda))
      return matchHeat && matchBusqueda
    })
    .sort((a, b) => {
      const aValido = typeof a.tiempoResultadoSegundos === 'number' && a.tiempoResultadoSegundos > 0
      const bValido = typeof b.tiempoResultadoSegundos === 'number' && b.tiempoResultadoSegundos > 0
      if (aValido && bValido) {
        return (a.tiempoResultadoSegundos || 0) - (b.tiempoResultadoSegundos || 0)
      }
      if (aValido && !bValido) return -1
      if (!aValido && bValido) return 1
      return a.nombres.localeCompare(b.nombres)
    })

  const totalConTiempo = items.filter((i) => i.tiempoResultadoSegundos !== null).length

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
            Clasificación General — {simulacion?.nombre || 'Competición'}
          </h2>
          <p className="text-xs text-zinc-400">
            Atletas clasificados de menor a mayor tiempo oficial en pista. Los atletas sin tiempo registrado se listan al final como DNF.
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

      {/* 2. Filtros y Búsqueda */}
      <div className="p-4 md:p-5 rounded-3xl bg-zinc-950/70 border border-white/10 backdrop-blur-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Chips de Heats */}
        <div className="flex flex-wrap items-center gap-2">
          {['TODOS', 'Heat 1', 'Heat 2', 'Heat 3', 'Heat 4', 'Heat 5', 'Heat 6'].map((heat) => {
            const isSel = heatFiltro === heat
            return (
              <button
                key={heat}
                type="button"
                onClick={() => setHeatFiltro(heat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
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
        <div className="relative w-full md:w-64">
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

      {/* 3. Tabla de Leaderboard Global */}
      <div className="rounded-3xl bg-zinc-950/80 border border-white/10 backdrop-blur-xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 bg-zinc-900/40 text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                <th className="py-3.5 px-4 text-center w-16">Pos</th>
                <th className="py-3.5 px-4">Atleta</th>
                <th className="py-3.5 px-4 text-center">Heat</th>
                <th className="py-3.5 px-4 text-center">Promedio Previo</th>
                <th className="py-3.5 px-4 text-center">Tiempo Final</th>
                <th className="py-3.5 px-4 text-center">Diferencia</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-xs">
              {itemsFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-zinc-500">
                    No se encontraron atletas registrados para los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                itemsFiltrados.map((item) => {
                  const tieneTiempo = typeof item.tiempoResultadoSegundos === 'number' && item.tiempoResultadoSegundos > 0
                  const esPodio = tieneTiempo && item.posicion !== null && item.posicion <= 3

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-white/[0.02] transition-colors"
                    >
                      {/* Posición */}
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
                          </p>
                          {item.cedula && (
                            <p className="text-[10px] text-zinc-500">CI: {item.cedula}</p>
                          )}
                        </div>
                      </td>

                      {/* Heat */}
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-zinc-900 border border-white/10 text-xs font-bold text-white">
                          <Flame className="w-3 h-3 text-amber-400" />
                          <span>{item.heatAsignado}</span>
                        </span>
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
              className="flex-1 py-3 rounded-2xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-bold text-xs border border-zinc-800 transition-colors cursor-pointer"
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
