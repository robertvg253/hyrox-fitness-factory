import { createClient } from '@/src/utils/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  Trophy,
  Flame,
  Calendar,
  Clock,
  MapPin,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Activity,
  Zap
} from 'lucide-react'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Conversor de segundos a formato MM:SS
function formatSegundosAMM_SS(totalSec: number | null | undefined): string {
  if (totalSec === null || totalSec === undefined || totalSec <= 0) return '--:--'
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

export default async function CompeticionPage() {
  const supabase = await createClient()

  // 1. Validar sesión de usuario
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // 2. Consultar la simulación activa o más reciente
  const { data: simulacion } = await supabase
    .from('simulaciones')
    .select('id, nombre, estado, tabla_liberada, heats_liberados, fecha_creacion')
    .order('fecha_creacion', { ascending: false })
    .limit(1)
    .maybeSingle()

  // 3. Consultar registro del atleta en participantes_simulacion con join explícito a categorías
  let { data: partData } = await supabase
    .from('participantes_simulacion')
    .select('*, categorias:categoria_id(nombre)')
    .eq('usuario_id', user.id)
    .single()

  console.log("Data Participante:", partData);

  // Fallback con supabaseAdmin en caso de que RLS aún no haya sido aplicado en Supabase
  if (!partData) {
    try {
      const supabaseAdmin = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )
      const { data: partAdmin } = await supabaseAdmin
        .from('participantes_simulacion')
        .select('*, categorias:categoria_id(nombre)')
        .eq('usuario_id', user.id)
        .single()
      if (partAdmin) {
        partData = partAdmin
        console.log("Data Participante (Admin Fallback):", partData);
      }
    } catch (err) {
      console.warn('[CompeticionPage] Fallback admin error:', err)
    }
  }

  interface ParticipanteConCategoria {
    id: string
    simulacion_id: string
    usuario_id: string
    heat_asignado: string | null
    salida_asignada?: string | null
    promedio_previo_segundos: number | null
    tiempo_resultado_segundos: number | null
    asistio: boolean | null
    categoria_id: string | null
    partner_nombres: string | null
    categorias: {
      nombre: string
    } | {
      nombre: string
    }[] | null
  }

  const participante = partData as ParticipanteConCategoria | null

  // Extracción Defensiva: maneja tanto objeto como arreglo según la vista de Supabase
  const nombreCategoria = Array.isArray(participante?.categorias)
    ? participante?.categorias[0]?.nombre
    : participante?.categorias?.nombre

  const heatAsignado = participante?.heat_asignado || null
  const salidaAsignada = participante?.salida_asignada || null
  const estaInscrito = Boolean(participante)
  const tablaLiberada = Boolean(simulacion?.tabla_liberada)
  const heatsLiberados = Boolean(simulacion?.heats_liberados)

  return (
    <main className="pb-12 px-4 pt-4 space-y-6 max-w-md mx-auto">
      {/* 1. Header de Sección */}
      <header className="space-y-1">
        <span className="text-[10px] font-bold tracking-widest text-[#02D7E5] uppercase">
          Calendario Oficial
        </span>
        <h1 className="text-2xl font-bold text-white tracking-tight">
          Próxima Competición
        </h1>
        <p className="text-xs text-zinc-400">
          Detalles de la jornada Hyrox, cronograma y asignación de heats.
        </p>
      </header>

      {/* 2. Banner de Resultados (ESTADO B) si la tabla está liberada */}
      {tablaLiberada && simulacion && (
        <section className="animate-in fade-in duration-500">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-zinc-900 via-cyan-950/40 to-black border border-[#02D7E5]/50 p-6 shadow-2xl shadow-[#02D7E5]/15">
            <div className="absolute -top-12 -right-12 w-40 h-40 bg-[#02D7E5]/20 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 space-y-4">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-[#02D7E5]/15 text-[#02D7E5] border border-[#02D7E5]/30">
                  <span className="w-2 h-2 rounded-full bg-[#02D7E5] animate-pulse" />
                  RESULTADOS OFICIALES
                </span>
                <Trophy className="w-6 h-6 text-[#02D7E5]" />
              </div>

              <div>
                <h2 className="text-xl font-bold text-white tracking-tight mb-1">
                  ¡Resultados Publicados!
                </h2>
                <p className="text-xs text-zinc-300 leading-relaxed font-medium">
                  La tabla de clasificación final para {simulacion.nombre} ya se encuentra liberada.
                </p>
              </div>

              {participante?.tiempo_resultado_segundos && (
                <div className="flex items-center justify-between p-3 rounded-2xl bg-black/40 border border-[#02D7E5]/30 backdrop-blur-md">
                  <span className="text-xs font-semibold text-zinc-400">Tu Tiempo Oficial:</span>
                  <span className="text-sm font-bold text-[#02D7E5]">
                    {formatSegundosAMM_SS(participante.tiempo_resultado_segundos)}
                  </span>
                </div>
              )}

              {/* Botón de Acento Cyan */}
              <Link
                href={`/dashboard/leaderboard/${simulacion.id}`}
                className="w-full py-3.5 px-5 bg-[#02D7E5] hover:bg-[#02D7E5]/90 text-black font-bold text-sm rounded-2xl transition-all shadow-[0_4px_20px_rgba(2,215,229,0.35)] flex items-center justify-center gap-2 active:scale-[0.98]"
              >
                <Trophy className="w-4 h-4 text-black" />
                <span>Ver posiciones / Resultados</span>
                <ArrowRight className="w-4 h-4 text-black" />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* 3. Tarjeta Destacada: Categoría / Heat Asignado */}
      <section className="animate-in fade-in duration-500">
        <div className="relative overflow-hidden rounded-3xl bg-zinc-950/80 backdrop-blur-xl border border-white/10 p-6 shadow-2xl">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#02D7E5] to-transparent opacity-80" />

          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 pt-0.5">
                Asignación de Heat
              </span>
              <div className="flex flex-col items-end">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#02D7E5]/10 text-[#02D7E5] border border-[#02D7E5]/30 tracking-wide uppercase text-right">
                  {nombreCategoria?.toUpperCase() || 'SIN CATEGORÍA'}
                </span>
                {participante?.partner_nombres && (
                  <p className="text-sm text-zinc-400 mt-1">
                    Compañero: <span className="text-white">{participante.partner_nombres}</span>
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-zinc-400">Tanda Asignada:</span>
                
                {heatAsignado ? (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Flame className="w-7 h-7 text-[#02D7E5] shrink-0" />
                      <h2 className="text-3xl font-black tracking-tight text-[#02D7E5]">
                        {heatAsignado}
                      </h2>
                    </div>
                    {salidaAsignada && (
                      <div className="flex items-center gap-1.5 text-zinc-300 font-bold text-sm">
                        <Clock className="w-4 h-4 text-[#02D7E5]" />
                        <span>{salidaAsignada}</span>
                      </div>
                    )}
                  </div>
                ) : salidaAsignada ? (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Clock className="w-6 h-6 text-[#02D7E5] shrink-0" />
                      <h2 className="text-3xl font-black tracking-tight text-[#02D7E5]">
                        {salidaAsignada}
                      </h2>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-amber-400" />
                    <h2 className="text-xl font-bold tracking-tight text-amber-400">
                      Pendiente de publicación
                    </h2>
                  </div>
                )}
              </div>

              <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-[#02D7E5] shrink-0">
                <Zap className="w-6 h-6" />
              </div>
            </div>

            <p className="text-[11px] text-zinc-400 leading-relaxed">
              {heatAsignado
                ? 'Tu tanda y horario de salida han sido asignados de acuerdo al cronograma oficial. Preséntate con anticipación para el calentamiento y briefing de tu tanda.'
                : 'La asignación de heats y horarios de salida se encuentra en proceso de balanceo técnico oficial.'}
            </p>
          </div>
        </div>
      </section>

      {/* 4. Tarjeta de Detalles del Evento (Bento Card) */}
      <section className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400 px-1">
          Detalles del Evento
        </h2>

        <div className="rounded-3xl bg-zinc-950/70 border border-zinc-800/80 p-5 space-y-4">
          <div className="flex items-start justify-between gap-2 border-b border-zinc-900 pb-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#02D7E5]">
                Edición Oficial
              </span>
              <h3 className="text-lg font-bold text-white tracking-tight mt-0.5">
                {simulacion?.nombre || 'Competición Hyrox Factory'}
              </h3>
            </div>
            <span className="px-2.5 py-1 rounded-xl bg-zinc-900 border border-zinc-800 text-[11px] font-semibold text-zinc-300">
              {simulacion?.estado || 'Confirmada'}
            </span>
          </div>

          {/* Placeholders estructurados: Fecha, Hora, Lugar */}
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-zinc-900/60 border border-zinc-800/60">
              <div className="w-9 h-9 rounded-xl bg-zinc-800 flex items-center justify-center text-[#02D7E5] shrink-0">
                <Calendar className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase text-zinc-500">Fecha del Evento</span>
                <span className="text-xs font-bold text-zinc-200">
                  Sábado, 24 de Octubre
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-2xl bg-zinc-900/60 border border-zinc-800/60">
              <div className="w-9 h-9 rounded-xl bg-zinc-800 flex items-center justify-center text-[#02D7E5] shrink-0">
                <Clock className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase text-zinc-500">Hora de Inicio</span>
                <span className="text-xs font-bold text-zinc-200">
                  2:00 PM - Apertura y Briefing Oficial
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-2xl bg-zinc-900/60 border border-zinc-800/60">
              <div className="w-9 h-9 rounded-xl bg-zinc-800 flex items-center justify-center text-[#02D7E5] shrink-0">
                <MapPin className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase text-zinc-500">Ubicación</span>
                <span className="text-xs font-bold text-zinc-200">
                  Fitness Factory sede Los Palos Grandes
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Estado de la Tabla de Posiciones si aún NO está liberada */}
      {!tablaLiberada && (
        <section className="p-4 rounded-3xl bg-zinc-950/40 border border-zinc-900 flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-zinc-900 flex items-center justify-center text-zinc-500 shrink-0">
            <Clock className="w-4 h-4" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-bold text-zinc-300">
              Resultados en Proceso
            </span>
            <span className="text-[11px] text-zinc-500">
              La tabla de posiciones se habilitará aquí una vez que los jueces validen los tiempos.
            </span>
          </div>
        </section>
      )}
    </main>
  )
}
