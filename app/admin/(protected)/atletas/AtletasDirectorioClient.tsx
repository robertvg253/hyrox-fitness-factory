'use client'

import { useState } from 'react'
import {
  Users,
  Search,
  Timer,
  Zap,
  Shirt,
  ShieldCheck,
  AlertCircle,
  Activity,
  Phone,
  Mail
} from 'lucide-react'

export interface AtletaDirectorioItem {
  id: string
  dorsal?: string | null
  nombres: string
  cedula: string
  telefono: string | null
  email: string
  talla_franela: string | null
  tests: {
    test1: string
    test2: string
    test3: string
    test4: string
  }
  promedioMMSS: string
  prMMSS: string
}

interface Props {
  atletas: AtletaDirectorioItem[]
}

export default function AtletasDirectorioClient({ atletas }: Props) {
  const [busqueda, setBusqueda] = useState('')

  const atletasFiltrados = atletas.filter((a) => {
    const q = busqueda.toLowerCase().trim()
    if (!q) return true
    const qSinHash = q.replace(/^#/, '')
    const qCleanNum = qSinHash.replace(/^0+/, '')
    const dorsalClean = a.dorsal ? a.dorsal.replace(/^0+/, '') : ''

    const matchDorsal = !!(
      a.dorsal &&
      (a.dorsal.toLowerCase().includes(q) ||
        `#${a.dorsal.toLowerCase()}`.includes(q) ||
        (qCleanNum && (dorsalClean === qCleanNum || dorsalClean.includes(qCleanNum))))
    )

    return (
      a.nombres.toLowerCase().includes(q) ||
      a.cedula.toLowerCase().includes(q) ||
      a.email.toLowerCase().includes(q) ||
      matchDorsal
    )
  })

  return (
    <div className="space-y-4">
      {/* Buscador */}
      <div className="p-4 rounded-3xl bg-zinc-950/70 backdrop-blur-xl border border-white/10 shadow-lg flex items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Buscar por nombre, cédula, correo o # dorsal..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-zinc-900/80 border border-zinc-800 rounded-2xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#02D7E5]"
          />
        </div>
        <span className="text-xs text-zinc-500 font-bold px-2">
          {atletasFiltrados.length} atleta(s)
        </span>
      </div>

      {/* Tabla Glassmorphism */}
      <div className="overflow-hidden rounded-3xl bg-zinc-950/80 backdrop-blur-xl border border-white/10 shadow-2xl">
        <div className="p-5 border-b border-zinc-900 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-[#02D7E5]" />
            <h2 className="text-base font-bold text-white tracking-tight">
              Directorio General de Atletas
            </h2>
          </div>
        </div>

        {atletasFiltrados.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <AlertCircle className="w-8 h-8 text-zinc-600 mx-auto" />
            <p className="text-sm font-bold text-zinc-400">
              No se encontraron atletas registrados
            </p>
            <p className="text-xs text-zinc-600">
              Prueba cambiando el término de búsqueda.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-900 text-[10px] font-bold uppercase tracking-wider text-zinc-400 bg-zinc-900/40">
                  <th className="py-3 px-5">Atleta</th>
                  <th className="py-3 px-4">Contacto</th>
                  <th className="py-3 px-4 text-center">Tests (1 al 4)</th>
                  <th className="py-3 px-4 text-center">Promedio</th>
                  <th className="py-3 px-5 text-center">Mejor Marca (PR)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900 text-xs">
                {atletasFiltrados.map((atleta) => (
                  <tr
                    key={atleta.id}
                    className="hover:bg-zinc-900/30 transition-colors group"
                  >
                    {/* Datos Atleta */}
                    <td className="py-4 px-5">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          {atleta.dorsal ? (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold bg-[#02D7E5]/15 text-[#02D7E5] border border-[#02D7E5]/30 shrink-0">
                              #{atleta.dorsal}
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-1 py-0.5 rounded-md text-[9px] font-mono font-semibold bg-zinc-800 text-zinc-500 border border-zinc-700/50 shrink-0">
                              S/D
                            </span>
                          )}
                          <span className="font-bold text-white text-sm block tracking-tight">
                            {atleta.nombres}
                          </span>
                        </div>
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

                    {/* Contacto */}
                    <td className="py-4 px-4">
                      <div className="space-y-1 text-zinc-400 text-[11px]">
                        <span className="flex items-center gap-1.5 truncate max-w-[200px]">
                          <Mail className="w-3 h-3 text-zinc-500 shrink-0" />
                          {atleta.email}
                        </span>
                        {atleta.telefono && (
                          <span className="flex items-center gap-1.5 font-mono">
                            <Phone className="w-3 h-3 text-zinc-500 shrink-0" />
                            {atleta.telefono}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Tiempos de los 4 Tests */}
                    <td className="py-4 px-4 text-center">
                      <div className="inline-grid grid-cols-4 gap-1.5 font-mono text-[11px]">
                        <span className="px-2 py-1 rounded bg-zinc-900 border border-zinc-800 text-zinc-300" title="Test 1">
                          {atleta.tests.test1}
                        </span>
                        <span className="px-2 py-1 rounded bg-zinc-900 border border-zinc-800 text-zinc-300" title="Test 2">
                          {atleta.tests.test2}
                        </span>
                        <span className="px-2 py-1 rounded bg-zinc-900 border border-zinc-800 text-zinc-300" title="Test 3">
                          {atleta.tests.test3}
                        </span>
                        <span className="px-2 py-1 rounded bg-zinc-900 border border-zinc-800 text-zinc-300" title="Test 4">
                          {atleta.tests.test4}
                        </span>
                      </div>
                    </td>

                    {/* Promedio */}
                    <td className="py-4 px-4 text-center">
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-zinc-900/80 border border-zinc-800 font-mono text-zinc-200 font-bold text-xs">
                        <Timer className="w-3.5 h-3.5 text-[#02D7E5]" />
                        <span>{atleta.promedioMMSS}</span>
                      </div>
                    </td>

                    {/* PR */}
                    <td className="py-4 px-5 text-center">
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-500/10 border border-amber-500/30 font-mono text-amber-300 font-bold text-xs shadow-sm shadow-amber-500/5">
                        <Zap className="w-3.5 h-3.5 text-amber-400" />
                        <span>{atleta.prMMSS}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
