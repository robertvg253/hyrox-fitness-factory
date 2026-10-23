import { createClient } from '@/src/utils/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  Flame,
  Timer,
  User,
  ArrowRight,
  Activity,
  Trophy,
  ChevronRight,
  Zap,
  Clock
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

export default async function DashboardPage() {
  const supabase = await createClient()

  // 1. Obtener usuario autenticado
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // 2. Fetch perfil en public.usuarios (sin joins innecesarios)
  const { data: usuario } = await supabase
    .from('usuarios')
    .select('id, nombres, cedula, rol')
    .eq('id', user.id)
    .maybeSingle()

  // 3. Fetch tiempos históricos del atleta en public.tiempos_historicos (dinámico para N tests)
  let { data: tiempos } = await supabase
    .from('tiempos_historicos')
    .select('*')
    .eq('usuario_id', user.id)
    .order('numero_test', { ascending: true })

  // Fallback con supabaseAdmin en caso de que las políticas RLS aún no hayan sido ejecutadas en Supabase
  if (!tiempos || tiempos.length === 0) {
    try {
      const supabaseAdmin = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )
      const { data: tiemposAdmin } = await supabaseAdmin
        .from('tiempos_historicos')
        .select('*')
        .eq('usuario_id', user.id)
        .order('numero_test', { ascending: true })
      if (tiemposAdmin && tiemposAdmin.length > 0) {
        tiempos = tiemposAdmin
      }
    } catch (err) {
      console.warn('[DashboardPage] Fallback admin error:', err)
    }
  }

  const testsList = tiempos || []

  // Tiempos válidos estrictamente en base a los registros existentes (> 0)
  const tiemposValidos = testsList
    .map((t) => t.tiempo_segundos)
    .filter((s): s is number => typeof s === 'number' && s > 0)

  const sumaSegundos = tiemposValidos.reduce((acc, s) => acc + s, 0)
  const promedioSegundos = tiemposValidos.length > 0 ? Math.round(sumaSegundos / tiemposValidos.length) : 0
  const promedioFormateado = tiemposValidos.length > 0 ? formatSegundosAMM_SS(promedioSegundos) : '--:--'

  // Cálculo de Mejor Marca (PR): el menor tiempo en segundos > 0 entre los tests existentes
  const prSegundos = tiemposValidos.length > 0 ? Math.min(...tiemposValidos) : 0
  const prFormateado = tiemposValidos.length > 0 ? formatSegundosAMM_SS(prSegundos) : '--:--'

  // 4. Obtener simulación activa para conocer Heat Asignado y estado de la tabla
  const { data: simulacionReciente } = await supabase
    .from('simulaciones')
    .select('id, nombre, estado, tabla_liberada, heats_liberados, fecha_creacion')
    .order('fecha_creacion', { ascending: false })
    .limit(1)
    .maybeSingle()

  let heatAsignado: string | null = null
  let salidaAsignada: string | null = null
  if (simulacionReciente?.id) {
    const { data: participacion } = await supabase
      .from('participantes_simulacion')
      .select('heat_asignado, salida_asignada')
      .eq('simulacion_id', simulacionReciente.id)
      .eq('usuario_id', user.id)
      .maybeSingle()
    heatAsignado = participacion?.heat_asignado || null
    salidaAsignada = participacion?.salida_asignada || null
  }

  // Atributos del atleta
  const primerNombre = usuario?.nombres ? usuario.nombres.trim().split(' ')[0] : 'Atleta'
  const tablaLiberada = Boolean(simulacionReciente?.tabla_liberada)
  const heatsLiberados = Boolean(simulacionReciente?.heats_liberados)

  return (
    <main className="pb-12 px-4 pt-4 space-y-6 max-w-md mx-auto">
      {/* 1. Header con Saludo */}
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#02D7E5]/30 to-zinc-900 border border-[#02D7E5]/40 flex items-center justify-center shadow-lg shadow-[#02D7E5]/10 shrink-0">
            <User className="w-6 h-6 text-[#02D7E5]" />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-bold tracking-widest text-[#02D7E5] uppercase">
              Panel de Atleta
            </span>
            <h1 className="text-xl font-bold text-white tracking-tight">
              ¡Hola, {primerNombre}! 👋
            </h1>
          </div>
        </div>

        <Link
          href="/dashboard/perfil"
          className="p-2.5 rounded-2xl bg-zinc-900/80 border border-zinc-800 text-zinc-400 hover:text-white transition-colors"
          title="Ver perfil"
        >
          <ChevronRight className="w-5 h-5" />
        </Link>
      </header>

      {/* 2. CTA Dinámico de Ranking Global (ÚLTIMA HORA con efecto Titilante/Glow) */}
      {tablaLiberada && simulacionReciente && (
        <section className="animate-in fade-in slide-in-from-top-3 duration-500">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-cyan-950/80 via-zinc-950 to-amber-950/60 border border-[#02D7E5]/70 p-5 shadow-[0_0_30px_rgba(2,215,229,0.25)]">
            {/* Resplandor titilante / glow */}
            <div className="absolute inset-0 bg-[#02D7E5]/5 animate-pulse pointer-events-none" />
            <div className="absolute -top-12 -right-12 w-36 h-36 bg-[#02D7E5]/20 rounded-full blur-2xl pointer-events-none" />

            <div className="relative z-10 space-y-3">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold bg-[#02D7E5]/20 text-[#02D7E5] border border-[#02D7E5]/40">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#02D7E5] opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-[#02D7E5]"></span>
                  </span>
                  ¡ÚLTIMA HORA! • RESULTADOS
                </span>
                <Trophy className="w-5 h-5 text-[#02D7E5]" />
              </div>

              <div>
                <h2 className="text-lg font-bold text-white tracking-tight">
                  ¡Tabla de Posiciones Oficial Disponible!
                </h2>
                <p className="text-xs text-zinc-300 leading-relaxed font-medium mt-1">
                  La clasificación final y tiempos oficiales de &quot;{simulacionReciente.nombre}&quot; ya están liberados. Consulta tu posición y los resultados por heat.
                </p>
              </div>

              {/* Botón llamativo hacia /dashboard/competicion */}
              <Link
                href="/dashboard/competicion"
                className="w-full py-3 px-4 bg-[#02D7E5] hover:bg-[#02D7E5]/90 text-black font-extrabold text-sm rounded-2xl transition-all shadow-[0_4px_20px_rgba(2,215,229,0.4)] flex items-center justify-center gap-2 active:scale-[0.98]"
              >
                <Trophy className="w-4 h-4 text-black" />
                <span>Ver Clasificación en Competición</span>
                <ArrowRight className="w-4 h-4 text-black" />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* 3. Tarjeta Exclusiva de Rendimiento Histórico (Hero Bento: Promedio + PR) */}
      <section className="space-y-4 animate-in fade-in duration-500">
        <div className="relative overflow-hidden rounded-3xl bg-zinc-950/80 backdrop-blur-xl border border-white/10 p-6 shadow-2xl">
          {/* Acento estético superior y resplandor */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#02D7E5] to-transparent opacity-80" />
          <div className="absolute -bottom-16 -right-16 w-48 h-48 bg-[#02D7E5]/10 rounded-full blur-3xl pointer-events-none" />

          <div className="space-y-5">
            {/* Header de la tarjeta con Heat Indicator */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Timer className="w-4 h-4 text-[#02D7E5]" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                  Rendimiento Histórico
                </span>
              </div>

              {heatAsignado ? (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-[#02D7E5]/20 to-cyan-500/10 border border-[#02D7E5]/40 text-[#02D7E5] font-bold text-xs shadow-sm">
                  <Flame className="w-3.5 h-3.5 text-[#02D7E5]" />
                  <span>{heatAsignado}</span>
                  {salidaAsignada && (
                    <span className="text-zinc-300 font-semibold">• {salidaAsignada}</span>
                  )}
                </div>
              ) : salidaAsignada ? (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-[#02D7E5]/20 to-cyan-500/10 border border-[#02D7E5]/40 text-[#02D7E5] font-bold text-xs shadow-sm">
                  <Clock className="w-3.5 h-3.5 text-[#02D7E5]" />
                  <span>{salidaAsignada}</span>
                </div>
              ) : (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 font-semibold text-[11px]">
                  <Clock className="w-3 h-3 text-amber-400" />
                  <span>Pendiente de publicación</span>
                </div>
              )}
            </div>

            {/* Grid de Métricas Principales: Promedio Dinámico & Mejor Marca (PR) */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              {/* Métrica 1: Promedio Dinámico */}
              <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 space-y-1">
                <div className="flex items-center gap-1.5 text-zinc-400">
                  <Timer className="w-3.5 h-3.5 text-zinc-400" />
                  <span className="text-[10px] font-bold uppercase tracking-wider truncate">
                    {tiemposValidos.length > 0
                      ? `Promedio (${tiemposValidos.length} ${tiemposValidos.length === 1 ? 'Test' : 'Tests'})`
                      : 'Promedio Histórico'}
                  </span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-bold tracking-tight text-white">
                    {promedioFormateado}
                  </span>
                  <span className="text-[10px] font-bold text-zinc-500">MM:SS</span>
                </div>
                <span className="text-[10px] text-zinc-500 block">
                  {tiemposValidos.length > 0 ? 'Base de clasificación' : 'Sin registros'}
                </span>
              </div>

              {/* Métrica 2: Mejor Marca (PR) Destacada */}
              <div className="relative overflow-hidden p-4 rounded-2xl bg-gradient-to-br from-amber-500/15 via-zinc-900/80 to-black border border-amber-500/50 space-y-1 shadow-lg shadow-amber-500/5">
                <div className="flex items-center justify-between text-amber-400">
                  <div className="flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">
                      Mejor Marca (PR)
                    </span>
                  </div>
                  {tiemposValidos.length > 0 && (
                    <span className="px-1.5 py-0.5 rounded-md bg-amber-500/25 text-amber-300 font-extrabold text-[9px] border border-amber-500/40">
                      PR
                    </span>
                  )}
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-bold tracking-tight text-amber-300 drop-shadow-sm">
                    {prFormateado}
                  </span>
                  <span className="text-[10px] font-bold text-amber-400/80">MM:SS</span>
                </div>
                <span className="text-[10px] text-zinc-400 block">
                  {tiemposValidos.length > 0 ? 'Tu récord personal' : 'Sin marcas'}
                </span>
              </div>
            </div>

            {/* Desglose Dinámico de Tests (N Tests) con Empty State */}
            <div className="pt-2">
              <div className="flex items-center justify-between mb-2.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Desglose de Tests Registrados
                </h3>
                {testsList.length > 0 && (
                  <span className="text-[10px] font-bold text-[#02D7E5] uppercase">
                    {testsList.length} {testsList.length === 1 ? 'Test' : 'Tests'}
                  </span>
                )}
              </div>

              {testsList.length === 0 ? (
                /* Empty State Minimalista y Elegante */
                <div className="p-6 rounded-2xl bg-zinc-900/40 border border-white/5 text-center space-y-1.5">
                  <Activity className="w-6 h-6 text-zinc-600 mx-auto" />
                  <p className="text-xs text-zinc-300 font-bold">
                    Aún no tienes tests oficiales registrados.
                  </p>
                  <p className="text-[11px] text-zinc-500 leading-relaxed">
                    Tus marcas registradas por los jueces aparecerán aquí automáticamente.
                  </p>
                </div>
              ) : (
                /* Grid Dinámico de Tests */
                <div className="grid grid-cols-2 gap-2.5">
                  {testsList.map((test, index) => {
                    const sec = test.tiempo_segundos
                    const tieneTiempo = typeof sec === 'number' && sec > 0
                    const esPR = tieneTiempo && sec === prSegundos && prSegundos > 0
                    const numeroTest = test.numero_test ?? index + 1

                    return (
                      <div
                        key={test.id || index}
                        className={`p-3 rounded-2xl border flex items-center justify-between transition-all ${
                          esPR
                            ? 'bg-amber-500/10 border-amber-500/50 shadow-sm shadow-amber-500/10'
                            : 'bg-zinc-900/60 border-zinc-800/80'
                        }`}
                      >
                        <div className="flex flex-col">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-bold text-zinc-400 uppercase">
                              Test {numeroTest}
                            </span>
                            {esPR && (
                              <span className="px-1.5 py-0.2 rounded bg-amber-500/25 text-amber-300 text-[9px] font-extrabold border border-amber-500/40">
                                PR
                              </span>
                            )}
                          </div>
                          <span
                            className={`text-sm font-bold tracking-tight ${
                              esPR
                                ? 'text-amber-300'
                                : tieneTiempo
                                ? 'text-zinc-100'
                                : 'text-zinc-600'
                            }`}
                          >
                            {formatSegundosAMM_SS(sec)}
                          </span>
                        </div>
                        <div
                          className={`w-7 h-7 rounded-xl flex items-center justify-center ${
                            esPR
                              ? 'bg-amber-500/20 text-amber-400'
                              : tieneTiempo
                              ? 'bg-[#02D7E5]/10 text-[#02D7E5]'
                              : 'bg-zinc-800/50 text-zinc-600'
                          }`}
                        >
                          {esPR ? (
                            <Zap className="w-3.5 h-3.5" />
                          ) : (
                            <Activity className="w-3.5 h-3.5" />
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 4. Hero Banner Grande de la Competición */}
      <section className="relative overflow-hidden rounded-3xl border border-white/15 shadow-2xl transition-all">
        {/* Background con imagen y capa oscura bg-black/60 para legibilidad */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url('/images/LOGO TEXTURA01.png')` }}
        />
        <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px]" />
        
        {/* Resplandor sutil cyan */}
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-[#02D7E5]/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 p-6 md:p-8 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <span className="px-3 py-1 rounded-full bg-[#02D7E5]/20 border border-[#02D7E5]/40 text-[#02D7E5] font-bold text-[10px] uppercase tracking-widest flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-[#02D7E5]" />
              Competición Oficial
            </span>

            <span className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider">
              {simulacionReciente?.estado || 'Confirmada'}
            </span>
          </div>

          <div className="space-y-1.5 max-w-sm">
            <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight">
              {simulacionReciente?.nombre || 'Simulación Hyrox Factory'}
            </h2>

            {heatAsignado ? (
              <div className="space-y-1">
                <p className="text-sm text-zinc-100 font-semibold flex items-center gap-2">
                  <span>Asignado al</span>
                  <span className="px-2.5 py-0.5 rounded-lg bg-[#02D7E5]/20 text-[#02D7E5] border border-[#02D7E5]/40 font-bold text-sm">
                    {heatAsignado}
                  </span>
                </p>
                {salidaAsignada && (
                  <p className="text-xs text-zinc-300 font-semibold flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-[#02D7E5]" />
                    <span>{salidaAsignada}</span>
                  </p>
                )}
              </div>
            ) : salidaAsignada ? (
              <p className="text-sm text-zinc-100 font-semibold flex items-center gap-2">
                <span>Horario de Salida:</span>
                <span className="px-2.5 py-0.5 rounded-lg bg-[#02D7E5]/20 text-[#02D7E5] border border-[#02D7E5]/40 font-bold text-sm">
                  {salidaAsignada}
                </span>
              </p>
            ) : (
              <p className="text-xs text-zinc-300 leading-relaxed font-medium">
                Conoce el cronograma oficial de la jornada, la pista y la información del evento.
              </p>
            )}
          </div>

          <div className="pt-2">
            <Link
              href="/dashboard/competicion"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl font-extrabold text-sm shadow-xl active:scale-[0.98] transition-all bg-[#02D7E5] hover:bg-[#02D7E5]/90 text-black shadow-[#02D7E5]/30"
            >
              <span>{heatAsignado ? 'Ver detalles de mi tanda' : 'Ver más detalles'}</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
