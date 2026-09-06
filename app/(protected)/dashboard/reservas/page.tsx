'use client'

import { useState, useEffect, useMemo } from 'react'
import { Calendar as CalendarIcon, Clock, Users, ArrowRight, User, AlertTriangle, Loader2, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/src/utils/supabase/client'

export default function ReservasPage() {
  const [activeDay, setActiveDay] = useState<'HOY' | 'MANANA'>('HOY')
  
  const [user, setUser] = useState<any>(null)
  const [userStatus, setUserStatus] = useState<string>('ACTIVO')
  const [clases, setClases] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [toast, setToast] = useState<{type: 'success'|'error', msg: string} | null>(null)
  const [isAfter9PM, setIsAfter9PM] = useState(false)

  const supabase = createClient()

  // Helper para re-fetch de clases
  const refetchClases = async (userId: string, after9: boolean) => {
    const now = new Date()
    const todayEnd = new Date(now)
    todayEnd.setHours(23, 59, 59, 999)
    const tomorrowEnd = new Date(now)
    tomorrowEnd.setDate(now.getDate() + 1)
    tomorrowEnd.setHours(23, 59, 59, 999)
    const queryStart = now.toISOString()
    const queryEnd = after9 ? tomorrowEnd.toISOString() : todayEnd.toISOString()

    const { data, error } = await supabase
      .from('clases_programadas')
      .select('*, disciplinas(nombre, color_hex), instructores(nombre), reservas(id, usuario_id)')
      .gte('fecha_hora_inicio', queryStart)
      .lte('fecha_hora_inicio', queryEnd)
      .order('fecha_hora_inicio', { ascending: true })

    if (!error) setClases(data || [])
  }

  useEffect(() => {
    async function loadData() {
      setIsLoading(true)

      // Guard Clause estricta: validar sesión antes de cualquier query
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()

      if (authError || !authUser?.id) {
        setToast({ type: 'error', msg: 'Sesión no válida. Por favor inicia sesión nuevamente.' })
        setIsLoading(false)
        return
      }

      setUser(authUser)

      const { data: userData } = await supabase
        .from('usuarios')
        .select('estado')
        .eq('id', authUser.id)
        .single()

      if (userData?.estado) {
        setUserStatus(userData.estado)
      }

      const now = new Date()
      const after9 = now.getHours() >= 21
      setIsAfter9PM(after9)

      await refetchClases(authUser.id, after9)
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
          if (user) refetchClases(user.id, after9)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user])

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000)
      return () => clearTimeout(timer)
    }
  }, [toast])

  const handleReservar = async (claseId: string) => {
    // Guard Clause: no ejecutar si no hay usuario válido
    if (!user?.id) {
      setToast({ type: 'error', msg: 'Sesión no válida. Recarga la página.' })
      return
    }
    setActionLoading(claseId)

    try {
      const { error } = await supabase.rpc('agendar_clase_segura', {
        p_clase_id: claseId,
        p_usuario_id: user.id
      })

      if (error) {
        const msg = error.message || ''
        // Prioridad 1: Mensajes semánticos exactos lanzados por el SQL (RAISE EXCEPTION)
        if (msg.toLowerCase().includes('ya tienes') || msg.toLowerCase().includes('already') || error.code === '23505') {
          setToast({ type: 'error', msg: 'Ya tienes una reserva para esta clase.' })
        } else if (msg.toLowerCase().includes('aforo') || msg.toLowerCase().includes('cupo') || msg.toLowerCase().includes('full')) {
          setToast({ type: 'error', msg: 'Lo sentimos, esta clase ya no tiene cupos disponibles.' })
        } else if (error.code === '400' || error.code?.startsWith('PG') || msg.toLowerCase().includes('invalid') || msg.toLowerCase().includes('bad request')) {
          // Error de infraestructura / payload inválido, no enseñar mensaje crudo
          setToast({ type: 'error', msg: 'Error de comunicación con el servidor. Intenta de nuevo.' })
        } else {
          // Cualquier otro error SQL: mostrar el mensaje tal cual (puede ser útil)
          setToast({ type: 'error', msg: msg || 'Error al procesar la reserva.' })
        }
      } else {
        setToast({ type: 'success', msg: '¡Clase reservada con éxito! 🎉' })
        const now = new Date()
        await refetchClases(user.id, now.getHours() >= 21)
      }
    } catch (err: any) {
      // Error de red o excepción de JS pura
      setToast({ type: 'error', msg: 'Error de comunicación con el servidor. Intenta de nuevo.' })
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
      const classDate = new Date(c.fecha_hora_inicio)
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
      const d = new Date(clase.fecha_hora_inicio)
      const hora = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) // e.g. "06:00 AM"
      if (!acc[hora]) acc[hora] = []
      acc[hora].push(clase)
      return acc
    }, {} as Record<string, any[]>)
  }, [filteredClases])

  const isBlocked = userStatus === 'VENCIDO' || userStatus === 'MOROSO'

  return (
    <main className="p-6 space-y-8 bg-black min-h-screen relative">
      
      {/* Toast Notification — Diseño mejorado con padding, icono, sombra */}
      {toast && (
        <div
          className={`fixed top-6 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-3rem)] max-w-sm rounded-xl shadow-lg border backdrop-blur-xl transition-all ${
            toast.type === 'success'
              ? 'bg-emerald-950/90 border-emerald-500/30 text-emerald-300'
              : 'bg-red-950/90 border-red-500/30 text-red-300'
          }`}
        >
          <div className="flex items-start gap-3 p-4">
            <div className={`shrink-0 mt-0.5 p-1.5 rounded-lg ${
              toast.type === 'success' ? 'bg-emerald-500/20' : 'bg-red-500/20'
            }`}>
              {toast.type === 'success'
                ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                : <AlertTriangle className="w-4 h-4 text-red-400" />
              }
            </div>
            <p className="text-sm font-medium leading-relaxed">{toast.msg}</p>
          </div>
        </div>
      )}

      {/* Header y Selector de Día */}
      <header className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-brand-primary/10 flex items-center justify-center border border-brand-primary/20">
            <CalendarIcon className="w-5 h-5 text-brand-primary" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Reserva tu Clase</h1>
        </div>

        {/* Banner de Estado (Bloqueo) */}
        {isBlocked && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-5 flex items-start gap-4 backdrop-blur-sm">
            <AlertTriangle className="w-6 h-6 text-red-500 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-red-500 font-bold text-lg mb-1">Membresía {userStatus.toLowerCase()}</h3>
              <p className="text-red-400/80 text-sm font-medium">Por favor procesa tu pago para habilitar la reserva de clases. Dirígete a recepción o paga en línea.</p>
            </div>
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
          Object.entries(clasesPorHora).map(([hora, clasesEnHora]) => (
            <div key={hora} className="flex gap-4">
              
              {/* Eje de Tiempo (Izquierda) */}
              <div className="w-14 flex-shrink-0 pt-3 text-right pr-2">
                <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">{hora.split(' ')[0]}</span>
                <span className="text-[9px] text-zinc-600 font-bold">{hora.split(' ')[1]}</span>
              </div>

              {/* Contenedor Flex de Tarjetas */}
              <div className="flex-1 flex gap-4 overflow-x-auto snap-x snap-mandatory pb-4 hide-scrollbar">
                {clasesEnHora.map((clase) => {
                  const reservasCount = clase.reservas?.length || 0
                  const isFull = reservasCount >= clase.aforo_maximo
                  const userAlreadyBooked = clase.reservas?.some((r: any) => r.usuario_id === user?.id)
                  
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
                          <div className="flex items-center gap-1.5 text-zinc-400">
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
                             Reservada
                           </button>
                         ) : isFull ? (
                           <div className="w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 bg-zinc-900/80 text-zinc-600 border border-zinc-800 cursor-not-allowed select-none">
                             <Users className="w-4 h-4" />
                             Sin cupos
                           </div>
                         ) : (
                           <button 
                             onClick={() => handleReservar(clase.id)}
                             disabled={isBlocked || actionLoading === clase.id}
                             className={`w-full py-3.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2
                               ${isBlocked
                                 ? 'bg-zinc-900 text-zinc-700 cursor-not-allowed'
                                 : 'bg-white text-zinc-950 hover:bg-zinc-200 shadow-[0_0_20px_rgba(255,255,255,0.1)] active:scale-[0.98]'
                               }
                             `}
                           >
                             {actionLoading === clase.id ? (
                               <>
                                 <Loader2 className="w-4 h-4 animate-spin" />
                                 Procesando...
                               </>
                             ) : isBlocked ? (
                               'Bloqueado'
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
