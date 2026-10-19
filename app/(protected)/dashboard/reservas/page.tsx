'use client'

import { useState, useEffect, useMemo } from 'react'
import { Calendar as CalendarIcon, Clock, Users, ArrowRight, User, AlertTriangle, Loader2, CheckCircle2, Lock } from 'lucide-react'
import { createClient } from '@/src/utils/supabase/client'
import { reservarClase, obtenerClasesSede } from '@/app/(protected)/dashboard/actions'
import Link from 'next/link'
import toast from 'react-hot-toast'

export default function ReservasPage() {
  const [activeDay, setActiveDay] = useState<'HOY' | 'MANANA'>('HOY')
  
  const [user, setUser] = useState<any>(null)
  const [puedeAgendar, setPuedeAgendar] = useState<boolean>(true)
  const [clases, setClases] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [isAfter9PM, setIsAfter9PM] = useState(false)
  const [sedesPermitidas, setSedesPermitidas] = useState<{id: string, nombre: string}[]>([])
  const [sedeSeleccionada, setSedeSeleccionada] = useState<string | null>(null)
  const [etiquetaLead, setEtiquetaLead] = useState<string | null>(null)

  const supabase = createClient()

  // Helper para re-fetch de clases
  const refetchClases = async (userId: string, after9: boolean, targetSedeId: string | null = sedeSeleccionada) => {
    const now = new Date()
    const todayEnd = new Date(now)
    todayEnd.setHours(23, 59, 59, 999)
    const tomorrowEnd = new Date(now)
    tomorrowEnd.setDate(now.getDate() + 1)
    tomorrowEnd.setHours(23, 59, 59, 999)
    const queryStart = now.toISOString()
    const queryEnd = after9 ? tomorrowEnd.toISOString() : todayEnd.toISOString()

    if (targetSedeId) {
      const res = await obtenerClasesSede(targetSedeId, queryStart, queryEnd)
      if (res.success && res.data) {
        setClases(res.data)
      } else {
        setClases([])
      }
    }
  }

  useEffect(() => {
    async function loadData() {
      setIsLoading(true)

      // Guard Clause estricta: validar sesión antes de cualquier query
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()

      if (authError || !authUser?.id) {
        toast.error('Sesión no válida. Por favor inicia sesión nuevamente.')
        setIsLoading(false)
        return
      }

      setUser(authUser)



      const now = new Date()
      const after9 = now.getHours() >= 21
      setIsAfter9PM(after9)

      const { data: subActiva } = await supabase
        .from('suscripciones')
        .select('estado, sesiones_restantes, planes(sedes, tipo)')
        .eq('usuario_id', authUser.id)
        .in('estado', ['ACTIVO', 'INACTIVO'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      const { data: userData } = await supabase
        .from('usuarios')
        .select('sede_id, etiqueta_lead')
        .eq('id', authUser.id)
        .single()
        
      if (userData) {
        setEtiquetaLead(userData.etiqueta_lead)
      }

      let currentSede = null
      let apto = false;

      if (subActiva) {
        const estaActivo = subActiva.estado === 'ACTIVO';
        const planesObj = Array.isArray(subActiva.planes) ? subActiva.planes[0] : subActiva.planes;
        const isIlimitado = (planesObj as any)?.tipo === 'TIEMPO';
        const tieneSesiones = isIlimitado || subActiva.sesiones_restantes === null || subActiva.sesiones_restantes > 0;
        
        if (estaActivo && tieneSesiones) {
            apto = true;
        }

        const sedesIds = (planesObj as any)?.sedes || [];
        if (sedesIds.length > 0) {
          const { data: sedesData } = await supabase
            .from('sedes')
            .select('id, nombre')
            .in('id', sedesIds);
          
          if (sedesData && sedesData.length > 0) {
            setSedesPermitidas(sedesData);
            setSedeSeleccionada(sedesData[0].id);
            currentSede = sedesData[0].id;
          }
        }
      }

      // Fallback: Si no tiene suscripción activa o no tiene sedes en su plan, 
      // usar la sede principal de su perfil.
      if (!currentSede && userData?.sede_id) {
        const { data: sedesData } = await supabase
          .from('sedes')
          .select('id, nombre')
          .eq('id', userData.sede_id);
          
        if (sedesData && sedesData.length > 0) {
          setSedesPermitidas(sedesData);
          setSedeSeleccionada(sedesData[0].id);
          currentSede = sedesData[0].id;
        }
      }

      setPuedeAgendar(apto);

      if (currentSede) {
        await refetchClases(authUser.id, after9, currentSede);
      }
      setIsLoading(false)
    }

    loadData()
  }, [])

  // Supabase Realtime: suscripción a cambios en reservas para actualizar cupos en vivo
  useEffect(() => {
    let after9 = false
    const now = new Date()
    after9 = now.getHours() >= 21

    const channel = supabase
      .channel('reservas_tracker')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reservas' },
        () => {
          // Re-fetch silencioso al detectar cualquier cambio en reservas
          if (user) refetchClases(user.id, after9, sedeSeleccionada)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, sedeSeleccionada]) // Include sedeSeleccionada in dependencies

  useEffect(() => {
    if (user && sedeSeleccionada) {
       refetchClases(user.id, isAfter9PM, sedeSeleccionada)
    }
  }, [sedeSeleccionada])




  const handleReservar = async (claseId: string) => {
    // Guard Clause: no ejecutar si no hay usuario válido
    if (!user?.id) {
      toast.error('Sesión no válida. Recarga la página.')
      return
    }
    setActionLoading(claseId)

    try {
      const res = await reservarClase(claseId, user.id)

      if (!res.success) {
        toast.error(res.error || 'Error al procesar la reserva.')
      } else {
        toast.success('¡Clase reservada con éxito! 🎉')
        const now = new Date()
        await refetchClases(user.id, now.getHours() >= 21, sedeSeleccionada)
      }
    } catch (err: any) {
      toast.error('Error de comunicación con el servidor. Intenta de nuevo.')
    } finally {
      setActionLoading(null)
    }
  }

  // Filter classes by active day
  const filteredClases = useMemo(() => {
    const today = new Date()
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    
    return clases.filter(c => {
      const startValue = c?.startTime || c?.fecha_hora_inicio
      if (!startValue) return false
      
      const classDate = new Date(startValue)
      if (activeDay === 'HOY') {
        return classDate.toDateString() === today.toDateString()
      } else {
        return classDate.toDateString() === tomorrow.toDateString()
      }
    })
  }, [clases, activeDay])

  // Group by hour block
  const clasesPorHora = useMemo(() => {
    return filteredClases.reduce((acc, clase) => {
      const startValue = clase?.startTime || clase?.fecha_hora_inicio
      if (!startValue) return acc
      
      const d = new Date(startValue)
      const hora = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) // e.g. "06:00 AM"
      if (!acc[hora]) acc[hora] = []
      acc[hora].push(clase)
      return acc
    }, {} as Record<string, any[]>)
  }, [filteredClases])

  // Removed the early return to show a FOMO view

  return (
    <main className="p-6 space-y-8 bg-black min-h-screen relative">
      

      {/* Removed custom toast — now using global ToastProvider */}

      {/* Header y Selector de Día */}
      <header className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-brand-primary/10 flex items-center justify-center border border-brand-primary/20">
            <CalendarIcon className="w-5 h-5 text-brand-primary" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Reserva tu Clase</h1>
        </div>

        {!isLoading && !puedeAgendar && (
          <div className="bg-zinc-900/80 border border-white/10 rounded-3xl p-5 flex flex-col items-start gap-5 backdrop-blur-md shadow-xl">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-yellow-500/10 flex items-center justify-center shrink-0 border border-yellow-500/20">
                <Lock className="w-5 h-5 text-yellow-400 animate-pulse" />
              </div>
              <div className="flex flex-col text-left">
                <h3 className="text-white font-bold text-lg mb-1 tracking-tight">Reactiva tu plan para agendar</h3>
                <p className="text-zinc-400 text-sm font-medium">No te quedes por fuera. Renueva tu suscripción para asegurar tu cupo.</p>
              </div>
            </div>
            <Link 
              href="/dashboard/suscripcion/nueva"
              className="w-full px-6 py-3.5 bg-[#02D7E5] hover:bg-[#02D7E5]/90 text-black font-extrabold rounded-xl transition-all flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(2,215,229,0.15)]"
            >
              {['PRUEBA_ASISTIDA', 'PRUEBA_RESERVADA'].includes(etiquetaLead || '') ? 'Inscríbete ahora para agendar' : 'Renovar Plan'} <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        )}

        {/* Multisede Selector */}
        {sedesPermitidas.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {sedesPermitidas.map((sede) => (
              <button
                key={sede.id}
                onClick={() => setSedeSeleccionada(sede.id)}
                className={`px-4 py-2 rounded-full text-sm font-bold transition-all whitespace-nowrap ${
                  sedeSeleccionada === sede.id
                    ? 'bg-brand-primary text-black shadow-[0_0_10px_rgba(2,215,229,0.3)]'
                    : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                {sede.nombre}
              </button>
            ))}
          </div>
        )}

        {/* Date Selector */}
        <div className="flex gap-6 border-b border-zinc-800 pb-3">
          <button 
            onClick={() => setActiveDay('HOY')}
            className={`text-lg font-bold transition-all relative ${activeDay === 'HOY' ? 'text-white' : 'text-zinc-500'}`}
          >
            Hoy
            {activeDay === 'HOY' && (
              <span className="absolute -bottom-[13px] left-0 w-full h-[2px] bg-brand-primary shadow-[0_0_8px_rgba(2,215,229,0.8)]"></span>
            )}
          </button>
          
          <div className="relative flex flex-col items-center">
            <button 
              onClick={() => setActiveDay('MANANA')}
              disabled={!isAfter9PM}
              className={`text-lg font-bold transition-all relative ${activeDay === 'MANANA' ? 'text-white' : 'text-zinc-500'} ${!isAfter9PM ? 'opacity-30 cursor-not-allowed' : 'hover:text-white'}`}
            >
              Mañana
              {activeDay === 'MANANA' && (
                <span className="absolute -bottom-[13px] left-0 w-full h-[2px] bg-brand-primary shadow-[0_0_8px_rgba(2,215,229,0.8)]"></span>
              )}
            </button>
            {!isAfter9PM && (
              <span className="absolute -bottom-6 text-[9px] font-bold text-brand-primary uppercase tracking-widest whitespace-nowrap">
                Abre a las 9:00 PM
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Grid de Horarios (Time Blocks) */}
      <div className="space-y-8">
        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-10 h-10 text-brand-primary animate-spin" />
          </div>
        ) : Object.keys(clasesPorHora).length === 0 ? (
          <div className="py-20 text-center text-zinc-500 font-medium">
            No hay clases disponibles para {activeDay === 'HOY' ? 'el día de hoy' : 'mañana'}.
          </div>
        ) : (
          (Object.entries(clasesPorHora) as [string, any[]][]).map(([hora, clasesEnHora]) => (
            <div key={hora} className="flex gap-4">
              
              {/* Eje de Tiempo (Izquierda) */}
              <div className="w-14 flex-shrink-0 pt-3 text-right pr-2" suppressHydrationWarning>
                <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block" suppressHydrationWarning>{hora.split(' ')[0]}</span>
                <span className="text-[9px] text-zinc-600 font-bold" suppressHydrationWarning>{hora.split(' ')[1]}</span>
              </div>

              {/* Contenedor Flex de Tarjetas */}
              <div className="flex-1 flex gap-4 overflow-x-auto snap-x snap-mandatory pb-4 hide-scrollbar">
                {clasesEnHora.map((clase: any) => {
                  const reservasActivas = clase.reservas?.filter((r: any) => r.estado_reserva !== 'CANCELADA') || []
                  const reservasCount = reservasActivas.length
                  const isFull = reservasCount >= clase.aforo_maximo
                  const userAlreadyBooked = reservasActivas.some((r: any) => r.usuario_id === user?.id)
                  
                  const nombreDisplay = clase.disciplina_id ? clase.disciplinas?.nombre : clase.nombre_clase
                  const colorHex = clase.disciplinas?.color_hex || '#f59e0b' // Default ambar si es especial

                  return (
                    <div 
                      key={clase.id}
                      className="snap-center flex-shrink-0 w-64 bg-zinc-950/80 rounded-3xl p-5 flex flex-col justify-between shadow-xl relative overflow-hidden"
                      style={{ 
                        borderColor: colorHex,
                        borderWidth: '1.5px',
                        borderStyle: 'solid',
                        borderLeftWidth: '0px',
                        borderRightWidth: '0px',
                        borderBottomWidth: '0px',
                        borderTopColor: colorHex
                      }}
                    >
                      {/* Indicador de Color (Línea lateral gruesa) */}
                      <div 
                        className="absolute left-0 top-0 bottom-0 w-[4px]"
                        style={{ backgroundColor: colorHex }}
                      ></div>

                      {/* Resplandor superior sutil */}
                      <div 
                        className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-6 blur-[30px] rounded-full pointer-events-none"
                        style={{ backgroundColor: colorHex }}
                      ></div>

                      {/* Contenido de la Tarjeta */}
                      <div className="space-y-4 relative z-10 pl-2">
                        <div>
                          <span 
                            className="text-[10px] uppercase tracking-widest font-black px-2 py-1 rounded-md mb-3 inline-block"
                            style={{ 
                              backgroundColor: `${colorHex}20`,
                              color: colorHex 
                            }}
                          >
                            {clase.disciplina_id ? 'REGULAR' : 'ESPECIAL'}
                          </span>
                          <h3 className="text-xl font-bold text-white tracking-tight">{nombreDisplay}</h3>
                          <p className="text-sm text-zinc-400 mt-1 flex items-center gap-1.5 font-medium">
                            <User className="w-3.5 h-3.5" />
                            {clase.instructores?.nombre || 'Sin asignar'}
                          </p>
                        </div>

                        {/* Detalles: Hora y Cupos */}
                        <div className="flex items-center justify-between text-xs font-medium pt-2">
                          <div className="flex items-center gap-1.5 text-zinc-400" suppressHydrationWarning>
                            <Clock className="w-3.5 h-3.5" />
                            {hora}
                          </div>
                          <div className={`flex items-center gap-1.5 font-bold ${isFull ? 'text-red-400' : 'text-zinc-300'}`}>
                            <Users className="w-3.5 h-3.5" />
                            {reservasCount}/{clase.aforo_maximo} cupos
                          </div>
                        </div>
                      </div>

                      {/* Botón de Acción */}
                      <div className="mt-5 relative z-10 pl-2">
                         {userAlreadyBooked ? (
                           <button 
                             disabled
                             className="w-full py-3.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 bg-brand-primary/20 text-brand-primary border border-brand-primary/50 cursor-default"
                           >
                             <CheckCircle2 className="w-4 h-4" />
                             Clase Reservada
                           </button>
                         ) : !puedeAgendar ? (
                           <div className="w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 bg-zinc-900/80 text-zinc-600 border border-zinc-800 cursor-not-allowed select-none">
                             <Lock className="w-4 h-4" />
                             Sin Sesiones
                           </div>
                         ) : isFull ? (
                           <div className="w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 bg-zinc-900/80 text-zinc-600 border border-zinc-800 cursor-not-allowed select-none">
                             <Users className="w-4 h-4" />
                             Sin cupos
                           </div>
                         ) : (
                           <button 
                             onClick={() => handleReservar(clase.id)}
                             disabled={actionLoading === clase.id}
                             className="w-full py-3.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 bg-white text-zinc-950 hover:bg-zinc-200 shadow-[0_0_20px_rgba(255,255,255,0.1)] active:scale-[0.98]"
                           >
                             {actionLoading === clase.id ? (
                               <>
                                 <Loader2 className="w-4 h-4 animate-spin" />
                                 Procesando...
                               </>
                             ) : (
                               <>
                                 Reservar Clase
                                 <ArrowRight className="w-4 h-4" />
                               </>
                             )}
                           </button>
                         )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))
        )}
      </div>
      
      {/* Inyección de Estilos Globales para ocultar la barra de scroll en WebKit */}
      <style dangerouslySetInnerHTML={{__html: `
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}} />
    </main>
  )
}
