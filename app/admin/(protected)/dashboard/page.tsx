import { createClient } from '@/src/utils/supabase/server'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { 
  Users, 
  CalendarDays, 
  UserCheck, 
  ArrowRight, 
  MapPin, 
  Clock, 
  Sparkles, 
  Layers, 
  Calendar,
  CheckCircle2,
  AlertCircle
} from 'lucide-react'
import { getCaracasMidnightUTC } from '@/src/utils/timezone'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = await createClient()
  const cookieStore = await cookies()
  const activeSedeId = cookieStore.get('active_sede')?.value || null

  // Fechas en zona horaria Caracas (UTC-4)
  const startOfToday = getCaracasMidnightUTC(0)
  const endOfToday = getCaracasMidnightUTC(1)
  const startOfMonth = new Date(Date.UTC(startOfToday.getUTCFullYear(), startOfToday.getUTCMonth(), 1, 4, 0, 0))

  // Ejecución de consultas en paralelo para máximo rendimiento
  const [
    userSessionRes,
    atletasCountRes,
    leadsMesCountRes,
    sedeRes,
    clasesHoyRes,
    proximasClasesRes
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from('usuarios')
      .select('*', { count: 'exact', head: true })
      .eq('rol', 'ATLETA'),
    supabase
      .from('usuarios')
      .select('*', { count: 'exact', head: true })
      .eq('rol', 'ATLETA')
      .gte('created_at', startOfMonth.toISOString()),
    activeSedeId 
      ? supabase.from('sedes').select('id, nombre').eq('id', activeSedeId).single() 
      : Promise.resolve({ data: null }),
    supabase
      .from('clases_programadas')
      .select('id, nombre_clase, fecha_hora_inicio, aforo_maximo, sede_id, disciplinas(nombre), instructores(nombre), reservas(id, estado_reserva)')
      .gte('fecha_hora_inicio', startOfToday.toISOString())
      .lt('fecha_hora_inicio', endOfToday.toISOString())
      .match(activeSedeId ? { sede_id: activeSedeId } : {})
      .order('fecha_hora_inicio', { ascending: true }),
    supabase
      .from('clases_programadas')
      .select('id, nombre_clase, fecha_hora_inicio, aforo_maximo, sede_id, disciplinas(nombre), instructores(nombre), reservas(id, estado_reserva)')
      .gte('fecha_hora_inicio', new Date().toISOString())
      .match(activeSedeId ? { sede_id: activeSedeId } : {})
      .order('fecha_hora_inicio', { ascending: true })
      .limit(4)
  ])

  // 1. Saludo personalizado con nombre del usuario
  const user = userSessionRes.data?.user
  let userName = 'Equipo'
  if (user) {
    const { data: profile } = await supabase
      .from('usuarios')
      .select('nombre_completo')
      .eq('id', user.id)
      .single()

    if (profile?.nombre_completo) {
      userName = profile.nombre_completo.split(' ')[0]
    } else if (user.user_metadata?.name) {
      userName = user.user_metadata.name.split(' ')[0]
    }
  }

  // 2. Fecha formateada en español (Caracas)
  const fechaHoyStr = new Intl.DateTimeFormat('es-VE', {
    timeZone: 'America/Caracas',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(new Date())
  const fechaFormateada = fechaHoyStr.charAt(0).toUpperCase() + fechaHoyStr.slice(1)

  // 3. Sede activa
  const activeSedeNombre = sedeRes?.data?.nombre || 'Todas las Sedes'

  // 4. Métricas numéricas
  const atletasCount = atletasCountRes.count ?? 0
  const clasesHoyCount = clasesHoyRes.data?.length ?? 0
  const leadsMesCount = leadsMesCountRes.count ?? 0

  // 5. Próximas clases (Fallback inteligente si hoy no hay clases en DB de prueba)
  let displayClasses = (clasesHoyRes.data && clasesHoyRes.data.length > 0)
    ? clasesHoyRes.data.slice(0, 4)
    : (proximasClasesRes.data && proximasClasesRes.data.length > 0)
    ? proximasClasesRes.data
    : []

  if (displayClasses.length === 0) {
    const { data: fallbackClases } = await supabase
      .from('clases_programadas')
      .select('id, nombre_clase, fecha_hora_inicio, aforo_maximo, sede_id, disciplinas(nombre), instructores(nombre), reservas(id, estado_reserva)')
      .match(activeSedeId ? { sede_id: activeSedeId } : {})
      .order('fecha_hora_inicio', { ascending: false })
      .limit(4)

    if (fallbackClases && fallbackClases.length > 0) {
      displayClasses = [...fallbackClases].reverse()
    }
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300 font-sans text-white">
      
      {/* 1. Cabecera Personalizada */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-2">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#02D7E5]/10 text-[#02D7E5] border border-[#02D7E5]/20 shadow-[0_0_12px_rgba(2,215,229,0.15)]">
              <span className="w-2 h-2 rounded-full bg-[#02D7E5] animate-pulse" />
              Centro Operativo
            </span>
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-white/5 text-zinc-300 border border-white/10">
              <MapPin className="w-3 h-3 text-[#02D7E5]" /> {activeSedeNombre}
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white">
            Hola, {userName}
          </h1>
          <p className="text-sm text-zinc-400 font-light mt-1">
            {fechaFormateada}
          </p>
        </div>

        <Link
          href="/admin/calendario"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white border border-white/10 hover:border-[#02D7E5]/40 text-xs font-semibold transition-all group shrink-0"
        >
          <CalendarDays className="w-4 h-4 text-[#02D7E5] group-hover:scale-110 transition-transform" />
          Ver Calendario de Clases
          <ArrowRight className="w-3.5 h-3.5 text-zinc-400 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </header>

      {/* 2. Cuadrícula Principal (Bento Grid) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* Tarjeta 1: Atletas Activos (Métrica Principal) */}
        <div className="bg-white/[0.03] hover:bg-white/[0.05] border border-white/10 hover:border-white/20 rounded-2xl p-6 backdrop-blur-xl transition-all relative overflow-hidden flex flex-col justify-between group min-h-[160px]">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#02D7E5]/5 rounded-full blur-2xl pointer-events-none group-hover:bg-[#02D7E5]/10 transition-colors" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-light uppercase tracking-wider text-zinc-400">
              Atletas Activos
            </span>
            <div className="w-9 h-9 rounded-xl bg-[#02D7E5]/10 border border-[#02D7E5]/20 flex items-center justify-center text-[#02D7E5]">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <p className="text-4xl lg:text-5xl font-bold text-white tracking-tight">
              {atletasCount}
            </p>
            <p className="text-xs text-zinc-500 font-light mt-1 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Comunidad en el sistema
            </p>
          </div>
        </div>

        {/* Tarjeta 2: Clases de Hoy (Operación del Día) */}
        <div className="bg-white/[0.03] hover:bg-white/[0.05] border border-white/10 hover:border-white/20 rounded-2xl p-6 backdrop-blur-xl transition-all relative overflow-hidden flex flex-col justify-between group min-h-[160px]">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-emerald-500/10 transition-colors" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-light uppercase tracking-wider text-zinc-400">
              Clases de Hoy
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <p className="text-4xl lg:text-5xl font-bold text-white tracking-tight">
              {clasesHoyCount}
            </p>
            <p className="text-xs text-zinc-500 font-light mt-1 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#02D7E5]" />
              {activeSedeNombre}
            </p>
          </div>
        </div>

        {/* Tarjeta 3: Nuevos Leads (Tráfico del Mes) */}
        <div className="bg-white/[0.03] hover:bg-white/[0.05] border border-white/10 hover:border-white/20 rounded-2xl p-6 backdrop-blur-xl transition-all relative overflow-hidden flex flex-col justify-between group min-h-[160px]">
          <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-purple-500/10 transition-colors" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-light uppercase tracking-wider text-zinc-400">
              Nuevos Leads
            </span>
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <p className="text-4xl lg:text-5xl font-bold text-white tracking-tight">
              {leadsMesCount}
            </p>
            <p className="text-xs text-zinc-500 font-light mt-1 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
              Registrados este mes
            </p>
          </div>
        </div>

        {/* Tarjeta 4: Pulso Operativo / Estado del Torniquete */}
        <div className="bg-white/[0.03] hover:bg-white/[0.05] border border-white/10 hover:border-white/20 rounded-2xl p-6 backdrop-blur-xl transition-all relative overflow-hidden flex flex-col justify-between min-h-[160px]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-light uppercase tracking-wider text-zinc-400">
              Recepción & Check-in
            </span>
            <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-[#02D7E5]">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4 space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <p className="text-base font-bold text-white">
                Sistema Operativo
              </p>
            </div>
            <p className="text-xs text-zinc-400 font-light">
              Torniquete y aforo sincronizados
            </p>
          </div>
        </div>

        {/* Tarjeta 5 (Destacada col-span-2 o 3): Próximas Clases */}
        <div className="col-span-1 md:col-span-2 lg:col-span-3 bg-white/[0.03] border border-white/10 rounded-2xl p-6 backdrop-blur-xl flex flex-col justify-between space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#02D7E5]/10 border border-[#02D7E5]/20 flex items-center justify-center text-[#02D7E5]">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white tracking-tight">
                  Próximas Clases
                </h2>
                <p className="text-xs text-zinc-400 font-light">
                  Aforo y ocupación en tiempo real para {activeSedeNombre}
                </p>
              </div>
            </div>

            <Link
              href="/admin/calendario"
              className="text-xs font-semibold text-[#02D7E5] hover:text-white transition-colors flex items-center gap-1"
            >
              Gestionar en vivo <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {/* Lista de clases */}
          <div className="space-y-3">
            {displayClasses.length === 0 ? (
              <div className="py-10 text-center text-zinc-500 text-xs">
                No hay clases programadas actualmente.
              </div>
            ) : (
              displayClasses.map((clase: any) => {
                const classDate = new Date(clase.fecha_hora_inicio)
                const horaFormatted = new Intl.DateTimeFormat('es-VE', {
                  timeZone: 'America/Caracas',
                  hour: 'numeric',
                  minute: '2-digit',
                  hour12: true
                }).format(classDate).toUpperCase()

                const fechaCorto = new Intl.DateTimeFormat('es-VE', {
                  timeZone: 'America/Caracas',
                  day: 'numeric',
                  month: 'short'
                }).format(classDate)

                const isToday = classDate.toDateString() === new Date().toDateString()
                const badgeTiempo = isToday ? horaFormatted : `${fechaCorto} · ${horaFormatted}`

                const nombreClase = clase.nombre_clase || clase.disciplinas?.nombre || 'Clase de Entrenamiento'
                const nombreInstructor = clase.instructores?.nombre || 'Instructor por asignar'

                const cuposReservados = clase.reservas?.length || 0
                const aforoMax = clase.aforo_maximo || 20
                const porcentaje = Math.min(100, Math.round((cuposReservados / aforoMax) * 100))
                const estaLleno = cuposReservados >= aforoMax

                return (
                  <div
                    key={clase.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/15 hover:bg-white/[0.04] transition-all gap-3"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      {/* Badge de Horario */}
                      <div className="px-3 py-1.5 rounded-lg bg-black/40 border border-white/10 text-center shrink-0">
                        <span className="text-xs font-bold text-white tracking-wide block">
                          {badgeTiempo}
                        </span>
                      </div>

                      {/* Nombre y Disciplina */}
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-white truncate">
                          {nombreClase}
                        </p>
                        <p className="text-xs text-zinc-400 font-light truncate">
                          Prof. {nombreInstructor}
                        </p>
                      </div>
                    </div>

                    {/* Barra y Pill de Aforo */}
                    <div className="flex items-center gap-3 shrink-0 sm:w-56 justify-end">
                      <div className="flex-1 max-w-[120px] hidden sm:block">
                        <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-500 ${
                              estaLleno 
                                ? 'bg-red-400' 
                                : porcentaje >= 80 
                                ? 'bg-amber-400' 
                                : 'bg-[#02D7E5]'
                            }`}
                            style={{ width: `${porcentaje}%` }}
                          />
                        </div>
                      </div>

                      <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold shrink-0 border ${
                        estaLleno
                          ? 'bg-red-500/10 text-red-400 border-red-500/20'
                          : porcentaje >= 80
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          : 'bg-[#02D7E5]/10 text-[#02D7E5] border-[#02D7E5]/20'
                      }`}>
                        {cuposReservados}/{aforoMax} cupos
                      </span>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Tarjeta 6 (col-span-1): Atajos Rápidos Operativos */}
        <div className="col-span-1 md:col-span-2 lg:col-span-1 bg-white/[0.03] border border-white/10 rounded-2xl p-6 backdrop-blur-xl flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Layers className="w-4 h-4 text-[#02D7E5]" />
              <h2 className="text-base font-bold text-white tracking-tight">
                Acciones Rápidas
              </h2>
            </div>
            <p className="text-xs text-zinc-400 font-light">
              Flujos frecuentes de recepción
            </p>
          </div>

          <div className="space-y-2.5">
            <Link
              href="/admin/calendario"
              className="w-full p-3.5 rounded-xl bg-white/[0.02] border border-white/5 hover:border-[#02D7E5]/30 hover:bg-white/[0.05] transition-all flex items-center justify-between group"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-[#02D7E5]/10 flex items-center justify-center text-[#02D7E5]">
                  <CalendarDays className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs font-semibold text-zinc-200 group-hover:text-white transition-colors">
                  Check-in / Aforo
                </span>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-zinc-500 group-hover:text-[#02D7E5] group-hover:translate-x-0.5 transition-all" />
            </Link>

            <Link
              href="/admin/usuarios"
              className="w-full p-3.5 rounded-xl bg-white/[0.02] border border-white/5 hover:border-[#02D7E5]/30 hover:bg-white/[0.05] transition-all flex items-center justify-between group"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                  <UserCheck className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs font-semibold text-zinc-200 group-hover:text-white transition-colors">
                  Directorio de Atletas
                </span>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-zinc-500 group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all" />
            </Link>

            <Link
              href="/admin/catalogo/planes"
              className="w-full p-3.5 rounded-xl bg-white/[0.02] border border-white/5 hover:border-[#02D7E5]/30 hover:bg-white/[0.05] transition-all flex items-center justify-between group"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400">
                  <Layers className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs font-semibold text-zinc-200 group-hover:text-white transition-colors">
                  Planes & Sedes
                </span>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-zinc-500 group-hover:text-purple-400 group-hover:translate-x-0.5 transition-all" />
            </Link>
          </div>

          <div className="p-3 rounded-xl bg-black/40 border border-white/5 text-[11px] text-zinc-400 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#02D7E5]" />
            Hora oficial: Caracas UTC-4
          </div>
        </div>

      </div>

    </div>
  )
}
