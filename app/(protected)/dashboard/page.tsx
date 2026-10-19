import { createClient } from '@/src/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Bell, CalendarPlus, Dumbbell, CreditCard, TrendingUp, ArrowRight, User } from 'lucide-react'

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
    .select('nombre_completo, rol, etiqueta_lead, cedula_rif, acepto_terminos, fecha_nacimiento, sede_id')
    .eq('id', user.id)
    .single()

  // Query 2: Suscripción activa más reciente
  const { data: suscripcionData } = await supabase
    .from('suscripciones')
    .select('id, estado, fecha_corte, sesiones_restantes, planes(tipo, nombre)')
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
  } else if (estado === 'ACTIVO' || estado === 'CLASE DE PRUEBA') {
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

  const esClasePrueba = planesObj?.nombre === 'Clase de Prueba'
  const tienePlanPago = (estado === 'ACTIVO' || estado === 'CLASE DE PRUEBA') && !esClasePrueba;
  
  // FIXED SECURITY LOGIC:
  const puedeAgendar = Boolean(
    suscripcionActiva && 
    (estado === 'ACTIVO' || estado === 'CLASE DE PRUEBA') && 
    (isIlimitado || (suscripcionActiva.sesiones_restantes !== null && suscripcionActiva.sesiones_restantes > 0)) &&
    !estaVencido
  );

  // Flujo Onboarding pendiente — validación de datos maestros, no de métricas de lead
  if (!userData?.acepto_terminos || !userData?.fecha_nacimiento || !userData?.sede_id) {
    const OnboardingWizard = (await import('@/components/dashboard/OnboardingWizard')).default
    return <OnboardingWizard cedula={userData?.cedula_rif || ''} />
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
    <main className="pb-6 space-y-8">
      {/* Hero Section con Header Inmersivo */}
      <section className="relative h-[320px] overflow-hidden flex flex-col justify-between p-6 animate-in fade-in slide-in-from-top-4 duration-700">
        <div className="absolute inset-0 z-0">
          <img 
            src="https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=1470&auto=format&fit=crop" 
            alt="Entrenamiento"
            className="w-full h-full object-cover object-center"
          />
          {/* Gradientes oscuros para contraste (Arriba para Header, Abajo para Textos) */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/90 via-black/40 to-transparent z-10" />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-transparent z-10" />
        </div>
        
        {/* Header (Superpuesto) */}
        <header className="relative z-20 flex items-center justify-start w-full">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full overflow-hidden bg-zinc-900 border border-zinc-700 flex items-center justify-center shrink-0">
              <User className="w-5 h-5 text-zinc-400" />
            </div>
            <div className="flex flex-col">
              <p className="text-[10px] font-bold text-zinc-300 shadow-black drop-shadow-md uppercase tracking-wider">Bienvenido,</p>
              <h1 className="text-lg font-bold text-white tracking-tight capitalize shadow-black drop-shadow-md">{firstName}</h1>
            </div>
          </div>
        </header>
        
        {/* Banner Content */}
        <div className="relative z-20 flex flex-col items-start w-full max-w-sm mt-auto">
          {(() => {
            const estadoNormalizado = (suscripcionActiva?.estado || 'INACTIVO').toUpperCase();
            const sesionesRestantes = suscripcionActiva?.sesiones_restantes ?? 0;
            const tieneSesionesDisponibles = isIlimitado || (suscripcionActiva?.sesiones_restantes !== null && sesionesRestantes > 0);
            const esPlanActivoOPrueba = estadoNormalizado === 'ACTIVO' || estadoNormalizado === 'CLASE DE PRUEBA';

            // 1. Condición para Banner de Renovación:
            // Se muestra si el estado es 'INACTIVO' (o vencido) O si sesiones_restantes <= 0 (incluso en 'ACTIVO' o 'CLASE DE PRUEBA')
            const debeMostrarRenovacion = !suscripcionActiva || 
                                          estadoNormalizado === 'INACTIVO' || 
                                          estadoNormalizado === 'VENCIDO' || 
                                          estaVencido || 
                                          (!isIlimitado && sesionesRestantes <= 0);

            // Si el usuario ya no tiene sesiones disponibles, forzar el banner de renovación
            if (debeMostrarRenovacion && !userBookedProximaClase) {
              return (
                <>
                  <h3 className="font-bold text-white text-3xl tracking-tight leading-tight mb-2">
                    ¡Afíliate ahora!
                  </h3>
                  <p className="text-zinc-300 text-sm font-medium mb-5">
                    Mantén tu ritmo. Renueva tu plan para seguir entrenando.
                  </p>
                  <Link 
                    href="/dashboard/suscripcion/nueva"
                    className="px-6 py-3 w-full bg-[#02D7E5] hover:bg-[#02D7E5]/90 text-black font-extrabold rounded-xl transition-all shadow-[0_4px_20px_rgba(2,215,229,0.3)] flex items-center justify-center gap-2"
                  >
                    Renovar Plan <ArrowRight className="w-5 h-5" />
                  </Link>
                </>
              );
            }

            if (userData?.etiqueta_lead === 'PRUEBA_PENDIENTE' && tieneSesionesDisponibles) {
              return (
                <>
                  <h3 className="font-bold text-white text-3xl tracking-tight leading-tight mb-2">
                    ¡Bienvenido a la comunidad!
                  </h3>
                  <p className="text-zinc-300 text-sm font-medium mb-5">
                    Reserva tu clase de prueba y conoce nuestro sistema.
                  </p>
                  <Link 
                    href="/dashboard/reservas"
                    className="px-6 py-3 w-full bg-[#02D7E5] hover:bg-[#02D7E5]/90 text-black font-extrabold rounded-xl transition-all shadow-[0_4px_20px_rgba(2,215,229,0.3)] flex items-center justify-center gap-2"
                  >
                    Agendar mi prueba <ArrowRight className="w-5 h-5" />
                  </Link>
                </>
              );
            }

            if (userData?.etiqueta_lead === 'PRUEBA_RESERVADA') {
              return (
                <>
                  <h3 className="font-bold text-white text-3xl tracking-tight leading-tight mb-2">
                    ¡Estás a un paso!
                  </h3>
                  <p className="text-zinc-300 text-sm font-medium mb-5">
                    Tu clase de prueba está agendada. Prepárate para darlo todo.
                  </p>
                  <Link 
                    href="/dashboard/reservas"
                    className="px-6 py-3 w-full bg-[#02D7E5] hover:bg-[#02D7E5]/90 text-black font-extrabold rounded-xl transition-all shadow-[0_4px_20px_rgba(2,215,229,0.3)] flex items-center justify-center gap-2"
                  >
                    Ver mis reservas <ArrowRight className="w-5 h-5" />
                  </Link>
                </>
              );
            }

            if (userData?.etiqueta_lead === 'PRUEBA_ASISTIDA' && !tienePlanPago) {
              return (
                <>
                  <h3 className="font-bold text-white text-3xl tracking-tight leading-tight mb-2">
                    ¿Qué tal tu primer entrenamiento?
                  </h3>
                  <p className="text-zinc-300 text-sm font-medium mb-5">
                    No pierdas el ritmo. Adquiere tu plan y desata tu potencial.
                  </p>
                  <Link 
                    href="/dashboard/suscripcion/nueva"
                    className="px-6 py-3 w-full bg-[#02D7E5] hover:bg-[#02D7E5]/90 text-black font-extrabold rounded-xl transition-all shadow-[0_4px_20px_rgba(2,215,229,0.3)] flex items-center justify-center gap-2"
                  >
                    Suscribirme ahora <ArrowRight className="w-5 h-5" />
                  </Link>
                </>
              );
            }

            // 2. Condición estricta para "Listo para entrenar":
            // SOLO debe mostrarse si el usuario tiene un plan activo/prueba AND sesiones_restantes > 0
            if (esPlanActivoOPrueba && tieneSesionesDisponibles && !estaVencido) {
              return (
                <>
                  <h3 className="font-bold text-white text-3xl tracking-tight leading-tight mb-2">
                    ¡Listo para entrenar!
                  </h3>
                  <p className="text-zinc-300 text-sm font-medium mb-5">
                    Asegura tu cupo en tu disciplina favorita.
                  </p>
                  <Link 
                    href="/dashboard/reservas"
                    className="px-6 py-3 w-full bg-[#02D7E5] hover:bg-[#02D7E5]/90 text-black font-extrabold rounded-xl transition-all shadow-[0_4px_20px_rgba(2,215,229,0.3)] flex items-center justify-center gap-2"
                  >
                    Agendar Clase <ArrowRight className="w-5 h-5" />
                  </Link>
                </>
              );
            }

            // Banner de Renovación por defecto si no cumple condiciones de agendar
            return (
              <>
                <h3 className="font-bold text-white text-3xl tracking-tight leading-tight mb-2">
                  ¡Afíliate ahora!
                </h3>
                <p className="text-zinc-300 text-sm font-medium mb-5">
                  Mantén tu ritmo. Renueva tu plan para seguir entrenando.
                </p>
                <Link 
                  href="/dashboard/suscripcion/nueva"
                  className="px-6 py-3 w-full bg-[#02D7E5] hover:bg-[#02D7E5]/90 text-black font-extrabold rounded-xl transition-all shadow-[0_4px_20px_rgba(2,215,229,0.3)] flex items-center justify-center gap-2"
                >
                  Renovar Plan <ArrowRight className="w-5 h-5" />
                </Link>
              </>
            );
          })()}
        </div>
      </section>

      {/* Hero Card */}
      <section className="px-6">
        <div className="bg-gradient-to-br from-zinc-900 to-black border border-zinc-800 rounded-3xl p-6 relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 left-0 w-1 h-full bg-brand-primary"></div>
          <div className="absolute -right-10 -top-10 opacity-5">
            <Dumbbell className="w-48 h-48" />
          </div>
          <div className="relative z-10 flex flex-col items-start">
            <h2 className="text-xs font-bold tracking-widest text-zinc-400 uppercase mb-2">
              TUS PRÓXIMAS RESERVAS
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
            ) : (
              <>
                <p className="text-xl font-bold text-white tracking-tight text-zinc-300">No tienes clases agendadas</p>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Quick Access */}
      <section className="px-6">
        <div className="flex justify-between items-center px-2">
          <Link href={!puedeAgendar ? "/dashboard/suscripcion/nueva" : "/dashboard/reservas"} className={`flex flex-col items-center gap-2 group ${!puedeAgendar ? 'opacity-50 grayscale' : ''}`}>
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
      <section className="px-6">
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
