import { createClient } from '@/src/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Bell, CalendarPlus, Dumbbell, CreditCard, TrendingUp, ArrowRight } from 'lucide-react'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Query 1: Datos básicos del usuario — query separado para evitar fallos por joins
  const { data: userData } = await supabase
    .from('usuarios')
    .select('nombre_completo, rol, etiqueta_lead, cedula_rif')
    .eq('id', user.id)
    .single()

  // Query 2: Suscripción activa más reciente
  const { data: suscripcionData } = await supabase
    .from('suscripciones')
    .select('id, estado, fecha_corte, sesiones_restantes, planes(tipo)')
    .eq('usuario_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const suscripcionActiva = suscripcionData || null

  // Query 3: Reservas CONFIRMADAS del usuario con datos de la clase
  const now = new Date().toISOString()
  const { data: reservasData, error: errRes } = await supabase
    .from('reservas')
    .select(`
      id, 
      clase_id, 
      clases_programadas!inner(
        fecha_hora_inicio, 
        nombre_clase, 
        disciplinas(nombre)
      )
    `)
    .eq('usuario_id', user.id)
    .eq('estado_reserva', 'CONFIRMADA')
    .gte('clases_programadas.fecha_hora_inicio', now)
    .order('fecha_hora_inicio', { foreignTable: 'clases_programadas', ascending: true })
    .limit(1)

  const proximaReserva = reservasData?.[0] || null
  // Si Supabase devuelve un array para la relación a uno-a-muchos forzada, tomamos el primero
  const rawClaseData = proximaReserva?.clases_programadas
  const claseData = Array.isArray(rawClaseData) ? rawClaseData[0] : rawClaseData

  // Formateo SEGURO de fecha — evitando hydration mismatch forzando timezone
  const formattedDate = claseData?.fecha_hora_inicio
    ? new Intl.DateTimeFormat('es-VE', {
        weekday: 'long',
        hour: 'numeric',
        minute: 'numeric',
        hour12: true,
        timeZone: 'America/Caracas'
      }).format(new Date(claseData.fecha_hora_inicio))
    : ''

  // Estado de suscripción
  const estado = (suscripcionActiva?.estado || '').toUpperCase()
  const fechaVencimientoBD = suscripcionActiva?.fecha_corte
  let estaVencido = false
  if (!estado || estado === 'VENCIDO') {
    estaVencido = true
  } else if (estado === 'ACTIVO') {
    if (!fechaVencimientoBD || new Date(fechaVencimientoBD) < new Date()) {
      estaVencido = true
    }
  }

  // Sesiones disponibles y control de acceso (Planes de Tiempo son ilimitados)
  const planesObj = Array.isArray(suscripcionActiva?.planes) ? suscripcionActiva.planes[0] : suscripcionActiva?.planes
  const isIlimitado = (planesObj as any)?.tipo === 'TIEMPO'
  const sesionesDisponibles = suscripcionActiva?.sesiones_restantes ?? 0
  const sinSesiones = !isIlimitado && sesionesDisponibles <= 0
  const userBookedProximaClase = !!proximaReserva

  // Flujo Onboarding pendiente — solo para usuarios recién registrados con etiqueta PRUEBA_PENDIENTE
  // Una vez completado, etiqueta_lead = null y ya no entra aquí
  if (userData?.etiqueta_lead === 'PRUEBA_PENDIENTE') {
    const OnboardingWizard = (await import('@/components/dashboard/OnboardingWizard')).default
    return <OnboardingWizard cedula={userData.cedula_rif || ''} />
  }

  // Nombre: query separado garantiza que nunca mostremos la cédula
  const firstName = userData?.nombre_completo
    ? userData.nombre_completo.split(' ')[0]
    : (user.user_metadata?.first_name || 'Atleta')

  const disciplinaNombre = (() => {
    if (!claseData) return 'Clase'
    const disc = Array.isArray(claseData.disciplinas) ? claseData.disciplinas[0] : claseData.disciplinas
    return disc?.nombre || claseData.nombre_clase || 'Clase'
  })()

  return (
    <main className="p-6 space-y-8">
      {/* Header */}
      <header className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full overflow-hidden bg-zinc-800 border-2 border-zinc-700">
            <img
              src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=150&auto=format&fit=crop"
              alt="Avatar"
              className="object-cover w-full h-full"
            />
          </div>
          <div>
            <p className="text-sm font-medium text-zinc-400">Buenos días,</p>
            <h1 className="text-2xl font-bold text-white tracking-tight capitalize">{firstName}</h1>
          </div>
        </div>
        <button className="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-white hover:bg-zinc-800 transition-colors">
          <Bell className="w-5 h-5" />
        </button>
      </header>

      {/* Hero Card */}
      <section>
        <div className="bg-gradient-to-br from-zinc-900 to-black border border-zinc-800 rounded-3xl p-6 relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 left-0 w-1 h-full bg-brand-primary"></div>
          <div className="absolute -right-10 -top-10 opacity-5">
            <Dumbbell className="w-48 h-48" />
          </div>
          <div className="relative z-10 flex flex-col items-start">
            <h2 className="text-xs font-bold tracking-widest text-zinc-400 uppercase mb-2">
              {userBookedProximaClase ? 'TU CLASE AGENDADA' : sinSesiones ? 'SUSCRIPCIÓN INACTIVA' : 'RESERVA TU PRÓXIMA CLASE'}
            </h2>

            {userBookedProximaClase ? (
              <>
                <p className="text-3xl font-black text-white mb-1 tracking-tight">
                  {disciplinaNombre}
                </p>
                {formattedDate && (
                  <p className="text-brand-primary font-medium mb-4">{formattedDate}</p>
                )}
                <button
                  disabled
                  className="px-5 py-2 bg-brand-primary/20 text-brand-primary font-bold text-sm rounded-full cursor-default border border-brand-primary/50"
                >
                  Ya Reservada
                </button>
              </>
            ) : sinSesiones ? (
              <>
                <p className="text-xl font-bold text-white mb-4 tracking-tight">No tienes reservas activas</p>
                <div className="flex flex-col items-start gap-1">
                  <button
                    disabled
                    className="px-5 py-2 bg-zinc-800 text-zinc-500 font-bold text-sm rounded-full cursor-not-allowed"
                  >
                    Sin Sesiones
                  </button>
                  <p className="text-[10px] text-red-400 font-medium">
                    Has agotado tus sesiones. Renueva tu plan para agendar más clases.
                  </p>
                </div>
              </>
            ) : (
              <>
                <p className="text-xl font-bold text-white mb-4 tracking-tight">No tienes reservas activas</p>
                <Link
                  href="/dashboard/reservas"
                  className="px-5 py-2 bg-brand-primary text-black font-bold text-sm rounded-full hover:opacity-90 transition-opacity"
                >
                  Agendar
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Quick Access */}
      <section>
        <div className="flex justify-between items-center px-2">
          <Link href="/dashboard/reservas" className="flex flex-col items-center gap-2 group">
            <div className="w-14 h-14 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-white group-hover:border-brand-primary group-hover:text-brand-primary transition-all shadow-lg">
              <CalendarPlus className="w-6 h-6" />
            </div>
            <span className="text-xs font-medium text-zinc-400 group-hover:text-white transition-colors">Agendar</span>
          </Link>

          <button className="flex flex-col items-center gap-2 group">
            <div className="w-14 h-14 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-white group-hover:border-brand-primary group-hover:text-brand-primary transition-all shadow-lg">
              <Dumbbell className="w-6 h-6" />
            </div>
            <span className="text-xs font-medium text-zinc-400 group-hover:text-white transition-colors">Rutina</span>
          </button>

          <button className="flex flex-col items-center gap-2 group">
            <div className="w-14 h-14 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-white group-hover:border-brand-primary group-hover:text-brand-primary transition-all shadow-lg">
              <CreditCard className="w-6 h-6" />
            </div>
            <span className="text-xs font-medium text-zinc-400 group-hover:text-white transition-colors">Pagos</span>
          </button>

          <button className="flex flex-col items-center gap-2 group">
            <div className="w-14 h-14 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-white group-hover:border-brand-primary group-hover:text-brand-primary transition-all shadow-lg">
              <TrendingUp className="w-6 h-6" />
            </div>
            <span className="text-xs font-medium text-zinc-400 group-hover:text-white transition-colors">Progreso</span>
          </button>
        </div>
      </section>

      {/* Disciplinas */}
      <section>
        <h3 className="text-lg font-bold text-white mb-4 tracking-tight">Explora nuestras disciplinas</h3>

        <div className="space-y-4">
          <div className="relative h-48 rounded-3xl overflow-hidden group cursor-pointer border border-zinc-800 shadow-xl">
            <img
              src="https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=1000&auto=format&fit=crop"
              alt="Factory System 60"
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent"></div>
            <div className="absolute bottom-0 left-0 w-full p-5 flex justify-between items-end">
              <div className="w-full pr-10">
                <h4 className="text-xl font-bold text-white mb-1">Factory System 60</h4>
                <p className="text-xs text-zinc-300 font-medium leading-tight">Método de 60 días. Alta intensidad, funcional y fuerza para resultados visibles.</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-brand-primary flex items-center justify-center text-zinc-950 shadow-lg shrink-0">
                <ArrowRight className="w-5 h-5" />
              </div>
            </div>
          </div>

          <div className="relative h-48 rounded-3xl overflow-hidden group cursor-pointer border border-zinc-800 shadow-xl">
            <img
              src="https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?q=80&w=1000&auto=format&fit=crop"
              alt="Fábrica de Nalgas"
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent"></div>
            <div className="absolute bottom-0 left-0 w-full p-5 flex justify-between items-end">
              <div className="w-full pr-10">
                <h4 className="text-xl font-bold text-white mb-1">Fábrica de Nalgas</h4>
                <p className="text-xs text-zinc-300 font-medium leading-tight">Enfoque en glúteos y piernas. Ejercicios aislados/compuestos y aumento progresivo de peso.</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-brand-primary flex items-center justify-center text-zinc-950 shadow-lg shrink-0">
                <ArrowRight className="w-5 h-5" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="relative h-48 rounded-3xl overflow-hidden group cursor-pointer border border-zinc-800 shadow-xl">
              <img
                src="https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=500&auto=format&fit=crop"
                alt="Fitness Bodybuilding 2.0"
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent"></div>
              <div className="absolute bottom-4 left-4 pr-2">
                <h4 className="text-lg font-bold text-white leading-tight mb-1">Bodybuilding 2.0</h4>
                <p className="text-[9px] text-zinc-300">Masa muscular e hipertrofia.</p>
              </div>
            </div>

            <div className="relative h-48 rounded-3xl overflow-hidden group cursor-pointer border border-zinc-800 shadow-xl">
              <img
                src="https://images.unsplash.com/photo-1517836357463-d25dfeac3438?q=80&w=500&auto=format&fit=crop"
                alt="Hyrox Factory"
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent"></div>
              <div className="absolute bottom-4 left-4 pr-2">
                <h4 className="text-lg font-bold text-white leading-tight mb-1">Hyrox Factory</h4>
                <p className="text-[9px] text-zinc-300">Entrenamiento híbrido definitivo.</p>
              </div>
            </div>
          </div>

          <div className="bg-zinc-900/50 rounded-2xl p-4 mt-2 border border-zinc-800/50">
            <p className="text-xs text-zinc-400 font-medium leading-relaxed">
              <span className="text-brand-primary font-bold">Duración:</span> 60 min. Sesiones guiadas por instructores certificados. Pregunta por nuestras clases especiales: Boxeo, Running, Pilates y Bailoterapia.
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}
