'use client'

import { useState, useEffect, startTransition, useRef } from 'react'
import { CheckCircle2, Circle, Search, UserPlus, Phone, User, X, Loader2, AlertCircle } from 'lucide-react'
import { createClient } from '@/src/utils/supabase/client'
import toast from 'react-hot-toast'
import { toggleAsistencia, registrarWalkIn, registrarLeadYWalkIn } from './actions'
import { enviarOtp, validarOtp } from '@/app/auth/actions'
import { useRouter } from 'next/navigation'
import { Calendar } from 'lucide-react'

interface Props {
  clase: any
  activeSede: any
  onUpdate: () => void
  onClose?: () => void
}

export default function RecepcionPanel({ clase, activeSede, onUpdate, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<'A' | 'B' | 'C'>('A')
  const [loadingAction, setLoadingAction] = useState<string | null>(null)
  
  const [participantesLocales, setParticipantesLocales] = useState<any[]>(clase.reservas || [])

  useEffect(() => {
    setParticipantesLocales(clase.reservas || [])
  }, [clase.reservas])

  // B: Walk-in search
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const supabase = createClient()

  // C: Lead form
  const [prospectoStep, setProspectoStep] = useState(1)
  const [leadNombre, setLeadNombre] = useState('')
  const [leadApellido, setLeadApellido] = useState('')
  const [leadCedulaTipo, setLeadCedulaTipo] = useState('V')
  const [leadCedulaNum, setLeadCedulaNum] = useState('')
  const [leadTelefonoCodigo, setLeadTelefonoCodigo] = useState('+58')
  const [leadTelefonoNum, setLeadTelefonoNum] = useState('')
  const [leadFechaNacimiento, setLeadFechaNacimiento] = useState('')

  // OTP State
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])
  const [errorVisual, setErrorVisual] = useState('')

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return
    
    const newOtp = [...otp]
    newOtp[index] = value
    setOtp(newOtp)

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handleToggleAsistencia = async (reservaId: string, currentAsistio: boolean) => {
    setLoadingAction(`asistencia-${reservaId}`)
    try {
      const res = await toggleAsistencia(reservaId, !currentAsistio)
      if (res.success) {
        toast.success(!currentAsistio ? 'Asistencia registrada' : 'Asistencia removida')
        setParticipantesLocales(prev => prev.map(r => r.id === reservaId ? { ...r, asistio_fisicamente: !currentAsistio } : r))
      } else {
        toast.error(res.error || 'Error al cambiar asistencia')
      }
    } catch (err) {
      toast.error('Error de red')
    } finally {
      setLoadingAction(null)
    }
  }

  const handleSearchAtleta = async (q: string) => {
    setSearchQuery(q)
    if (q.length < 3) {
      setSearchResults([])
      return
    }
    setIsSearching(true)
    const { data } = await supabase
      .from('usuarios')
      .select('id, nombre_completo, cedula_rif, email, telefono, suscripciones(id, estado, sesiones_restantes, planes(tipo, nombre))')
      .eq('sede_id', activeSede?.id)
      .eq('rol', 'ATLETA')
      .or(`nombre_completo.ilike.%${q}%,cedula_rif.ilike.%${q}%`)
      .limit(5)
    
    setSearchResults(data || [])
    setIsSearching(false)
  }

  const handleRegistrarWalkIn = async (usuarioId: string) => {
    setLoadingAction(`walkin-${usuarioId}`)
    try {
      const res = await registrarWalkIn(clase.id, usuarioId)
      if (res.success) {
        toast.success('Atleta agregado a la clase')
        setActiveTab('A')
        
        const addedUser = searchResults.find(u => u.id === usuarioId)
        if (addedUser) {
          setParticipantesLocales(prev => [...prev, {
            id: `temp-walkin-${Date.now()}`,
            asistio_fisicamente: true,
            es_clase_prueba: false,
            usuarios: addedUser
          }])
        }

        setSearchQuery('')
        setSearchResults([])
      } else {
        toast.error(res.error || 'Error al agregar atleta')
      }
    } catch (err) {
      toast.error('Error inesperado')
    } finally {
      setLoadingAction(null)
    }
  }

  const handleRegistrarLead = async (e: React.FormEvent) => {
    e.preventDefault()

    if (prospectoStep === 1) {
      if (!leadNombre || !leadApellido || !leadCedulaNum) return toast.error('Completa los campos básicos')
      setProspectoStep(2)
      return
    }
    
    if (prospectoStep === 2) {
      if (!leadTelefonoNum) return toast.error('Ingresa el teléfono')
      
      setLoadingAction('lead')
      try {
        const fullTelefono = `${leadTelefonoCodigo}${leadTelefonoNum}`
        const otpRes = await enviarOtp(fullTelefono)
        if (otpRes.success) {
          toast.success(otpRes.message || 'OTP enviado')
          setProspectoStep(3)
        } else {
          toast.error(otpRes.message || 'Error enviando OTP')
        }
      } catch (err) {
        toast.error('Error de conexión enviando OTP')
      } finally {
        setLoadingAction(null)
      }
      return
    }

    if (prospectoStep === 3) {
      const codigo = otp.join('')
      if (codigo.length < 6) return toast.error('Ingresa el código completo')

      setLoadingAction('lead')
      setErrorVisual('')
      try {
        const fullNombre = `${leadNombre} ${leadApellido}`.trim()
        const fullCedula = `${leadCedulaTipo}-${leadCedulaNum}`
        const fullTelefono = `${leadTelefonoCodigo}${leadTelefonoNum}`
        
        // 1. Validar OTP
        const valRes = await validarOtp(fullTelefono, codigo, { isLead: true })
        if (!valRes.success) {
          setErrorVisual(valRes.error || 'Código incorrecto')
          toast.error(valRes.error || 'Código incorrecto')
          return
        }

        // 2. Ejecutar Action
        const res = await registrarLeadYWalkIn(clase.id, fullNombre, fullTelefono, fullCedula, leadFechaNacimiento)
        if (res.success) {
          toast.success('Clase de prueba registrada con éxito')
          setActiveTab('A')
          
          setParticipantesLocales(prev => [...prev, {
            id: `temp-lead-${Date.now()}`,
            asistio_fisicamente: true,
            es_clase_prueba: true,
            usuarios: res.usuarioGenerado
          }])

          setActiveTab('A')
          setProspectoStep(1)
          setOtp(['', '', '', '', '', ''])
          setLeadNombre('')
          setLeadApellido('')
          setLeadCedulaNum('')
          setLeadTelefonoNum('')
          setLeadFechaNacimiento('')
        } else {
          toast.error(res.error || 'Error al registrar clase de prueba')
        }
      } catch (err) {
        toast.error('Error inesperado')
      } finally {
        setLoadingAction(null)
      }
    }
  }

  const reservasCount = participantesLocales.length
  const isFull = reservasCount >= clase.aforo_maximo

  return (
    <div className="flex-1 flex flex-col h-full bg-black/30 border border-white/5 rounded-xl overflow-hidden mt-4">
      {/* Tabs */}
      <div className="flex border-b border-white/10 bg-black/40 text-xs font-bold text-gray-400">
        <button 
          onClick={() => setActiveTab('A')}
          className={`flex-1 p-3 text-center transition-colors border-b-2 ${activeTab === 'A' ? 'text-white border-[#02D7E5] bg-[#02D7E5]/5' : 'border-transparent hover:text-white'}`}
        >
          Participantes ({reservasCount})
        </button>
        <button 
          onClick={() => setActiveTab('B')}
          className={`flex-1 p-3 text-center transition-colors border-b-2 ${activeTab === 'B' ? 'text-white border-[#02D7E5] bg-[#02D7E5]/5' : 'border-transparent hover:text-white'}`}
        >
          + Atleta
        </button>
        <button 
          onClick={() => setActiveTab('C')}
          className={`flex-1 p-3 text-center transition-colors border-b-2 ${activeTab === 'C' ? 'text-white border-[#02D7E5] bg-[#02D7E5]/5' : 'border-transparent hover:text-white'}`}
        >
          + Prospecto
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 hide-scrollbar">
        {/* Tab A: Lista de Reservas */}
        {activeTab === 'A' && (
          <div className="space-y-3">
            {reservasCount === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">
                Nadie ha reservado esta clase aún.
              </div>
            ) : (
              participantesLocales.map((res: any) => {
                const isAsistio = res.asistio_fisicamente === true
                const user = res.usuarios
                const isWalkIn = false // Columna origen_reserva eliminada del esquema
                const isPrueba = res.es_clase_prueba === true
                const subs = Array.isArray(user?.suscripciones) ? user.suscripciones[0] : null
                const isSesiones = subs?.planes?.tipo === 'SESIONES'
                
                return (
                  <div key={res.id} className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${isAsistio ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}>
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={() => handleToggleAsistencia(res.id, isAsistio)}
                        disabled={loadingAction === `asistencia-${res.id}`}
                        className="text-gray-400 hover:text-emerald-400 transition-colors shrink-0"
                      >
                        {loadingAction === `asistencia-${res.id}` ? (
                          <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
                        ) : isAsistio ? (
                          <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                        ) : (
                          <Circle className="w-6 h-6" />
                        )}
                      </button>
                      <div>
                        <p className={`font-bold text-sm flex items-center gap-2 ${isAsistio ? 'text-emerald-50' : 'text-white'}`}>
                          {user?.nombre_completo || 'Desconocido'}
                          {isWalkIn && <span className="text-[9px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded uppercase font-black">Walk-in</span>}
                          {isPrueba && <span className="text-[9px] bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded uppercase font-black">Prueba</span>}
                        </p>
                        {isSesiones && (
                          <p className={`text-xs mt-0.5 font-medium ${isAsistio ? 'text-emerald-400/80' : 'text-gray-400'}`}>
                            {subs.sesiones_restantes} Sesiones restantes
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}

        {/* Tab B: Buscar Walk-in */}
        {activeTab === 'B' && (
          <div className="space-y-4">
            {isFull ? (
               <div className="p-4 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg text-sm flex items-center gap-3">
                 <AlertCircle className="w-5 h-5 shrink-0" />
                 <p>La clase ha alcanzado su aforo máximo ({clase.aforo_maximo}). No puedes agregar más walk-ins.</p>
               </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-gray-500" />
                  <input
                    type="text"
                    placeholder="Buscar atleta por nombre..."
                    value={searchQuery}
                    onChange={(e) => handleSearchAtleta(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 text-white text-sm rounded-lg pl-9 pr-4 py-2.5 focus:outline-none focus:border-[#02D7E5] transition-colors"
                  />
                  {isSearching && <Loader2 className="w-4 h-4 absolute right-3 top-3 text-[#02D7E5] animate-spin" />}
                </div>

                <div className="space-y-2">
                  {searchResults.map(user => {
                     const isAlreadyBooked = participantesLocales.some((r: any) => r.usuarios?.id === user.id)
                     const subs = Array.isArray(user.suscripciones) ? user.suscripciones[0] : null
                     const activeOrInactive = subs?.estado === 'ACTIVO' || subs?.estado === 'INACTIVO'

                     return (
                       <div key={user.id} className="flex items-center justify-between p-3 rounded-lg border border-white/5 bg-black/20">
                         <div>
                           <p className="font-bold text-sm text-white">{user.nombre_completo}</p>
                           {activeOrInactive && subs?.planes?.nombre ? (
                              <p className="text-xs text-emerald-400 mt-0.5">{subs.planes.nombre} • {subs.sesiones_restantes || 0} disp.</p>
                           ) : (
                              <p className="text-xs text-gray-500 mt-0.5">Sin plan activo</p>
                           )}
                         </div>
                         <button
                           onClick={() => handleRegistrarWalkIn(user.id)}
                           disabled={isAlreadyBooked || loadingAction === `walkin-${user.id}`}
                           className="bg-[#02D7E5]/10 text-[#02D7E5] hover:bg-[#02D7E5] hover:text-black font-bold text-xs px-3 py-1.5 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                         >
                           {loadingAction === `walkin-${user.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : (isAlreadyBooked ? 'Registrado' : 'Agregar')}
                         </button>
                       </div>
                     )
                  })}
                  {searchQuery.length >= 3 && searchResults.length === 0 && !isSearching && (
                    <p className="text-xs text-gray-500 text-center py-4">No se encontraron atletas.</p>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* Tab C: Prospecto (Clase Prueba) */}
        {activeTab === 'C' && (
          <div>
            {isFull ? (
               <div className="p-4 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg text-sm flex items-center gap-3">
                 <AlertCircle className="w-5 h-5 shrink-0" />
                 <p>La clase ha alcanzado su aforo máximo. No hay cupo para pruebas.</p>
               </div>
            ) : (
              <form onSubmit={handleRegistrarLead} className="space-y-4">
                {/* Progress Indicators */}
                <div className="flex justify-between items-center mb-6">
                  {[1, 2, 3].map((step) => (
                    <div key={step} className="flex flex-col items-center w-1/3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                        prospectoStep === step ? 'bg-[#02D7E5] text-black' : prospectoStep > step ? 'bg-[#02D7E5]/30 text-[#02D7E5]' : 'bg-black/50 text-gray-500 border border-white/10'
                      }`}>
                        {step}
                      </div>
                      <span className={`text-[10px] mt-1 font-medium ${prospectoStep === step ? 'text-[#02D7E5]' : 'text-gray-500'}`}>
                        {step === 1 ? 'Datos' : step === 2 ? 'Contacto' : 'Validación'}
                      </span>
                    </div>
                  ))}
                </div>

                {prospectoStep === 1 && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">Nombre</label>
                        <input
                          required
                          type="text"
                          placeholder="Ej. Juan"
                          value={leadNombre}
                          onChange={e => setLeadNombre(e.target.value)}
                          className="w-full bg-black/40 border border-white/10 text-white text-sm rounded-lg px-4 py-2.5 focus:outline-none focus:border-[#02D7E5] transition-colors"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">Apellido</label>
                        <input
                          required
                          type="text"
                          placeholder="Ej. Pérez"
                          value={leadApellido}
                          onChange={e => setLeadApellido(e.target.value)}
                          className="w-full bg-black/40 border border-white/10 text-white text-sm rounded-lg px-4 py-2.5 focus:outline-none focus:border-[#02D7E5] transition-colors"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">Cédula o RIF</label>
                      <div className="flex gap-2">
                        <select
                          value={leadCedulaTipo}
                          onChange={(e) => setLeadCedulaTipo(e.target.value)}
                          className="w-[80px] bg-black/40 border border-white/10 text-white text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#02D7E5] transition-colors appearance-none"
                        >
                          <option value="V">V</option>
                          <option value="E">E</option>
                          <option value="J">J</option>
                        </select>
                        <input
                          required
                          type="text"
                          placeholder="12345678"
                          value={leadCedulaNum}
                          onChange={e => setLeadCedulaNum(e.target.value.replace(/\D/g, ''))}
                          className="flex-1 bg-black/40 border border-white/10 text-white text-sm rounded-lg px-4 py-2.5 focus:outline-none focus:border-[#02D7E5] transition-colors"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">Fecha de Nacimiento (Opcional)</label>
                      <input
                        type="date"
                        value={leadFechaNacimiento}
                        onChange={e => setLeadFechaNacimiento(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 text-white text-sm rounded-lg px-4 py-2.5 focus:outline-none focus:border-[#02D7E5] transition-colors"
                        style={{ colorScheme: 'dark' }}
                      />
                    </div>
                  </div>
                )}

                {prospectoStep === 2 && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">Teléfono (WhatsApp)</label>
                      <div className="flex gap-2">
                        <select
                          value={leadTelefonoCodigo}
                          onChange={(e) => setLeadTelefonoCodigo(e.target.value)}
                          className="w-[100px] bg-black/40 border border-white/10 text-white text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#02D7E5] transition-colors appearance-none"
                        >
                          <option value="+58">+58 (VE)</option>
                          <option value="+1">+1 (US)</option>
                          <option value="+34">+34 (ES)</option>
                        </select>
                        <input
                          required
                          type="tel"
                          placeholder="4141234567"
                          value={leadTelefonoNum}
                          onChange={e => setLeadTelefonoNum(e.target.value.replace(/\D/g, ''))}
                          className="flex-1 bg-black/40 border border-white/10 text-white text-sm rounded-lg px-4 py-2.5 focus:outline-none focus:border-[#02D7E5] transition-colors"
                        />
                      </div>
                      <p className="text-[10px] text-gray-500 mt-2">Te enviaremos un código para validar este número en el siguiente paso.</p>
                    </div>
                  </div>
                )}

                {prospectoStep === 3 && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300 text-center">
                    <div className="w-16 h-16 bg-[#02D7E5]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Phone className="w-8 h-8 text-[#02D7E5]" />
                    </div>
                    <h3 className="text-white font-bold text-lg">Validar Número</h3>
                    <p className="text-sm text-gray-400">
                      Se ha enviado un código OTP a <span className="text-white font-bold">{leadTelefonoCodigo} {leadTelefonoNum}</span>.
                    </p>
                    <div className="flex justify-center gap-2 my-6">
                       {otp.map((digit, index) => (
                         <input
                           key={index}
                           ref={el => { inputRefs.current[index] = el }}
                           type="text"
                           maxLength={1}
                           value={digit}
                           onChange={e => handleOtpChange(index, e.target.value)}
                           onKeyDown={e => handleOtpKeyDown(index, e)}
                           disabled={loadingAction === 'lead'}
                           className="w-10 h-12 bg-black/40 border border-white/10 rounded flex items-center justify-center text-white text-lg font-bold text-center focus:outline-none focus:border-[#02D7E5] focus:ring-1 focus:ring-[#02D7E5]"
                           autoFocus={index === 0}
                         />
                       ))}
                    </div>
                    {errorVisual && (
                      <p className="text-red-400 text-sm font-medium mt-3">{errorVisual}</p>
                    )}
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  {prospectoStep > 1 && (
                    <button
                      type="button"
                      onClick={() => setProspectoStep(p => p - 1)}
                      className="flex-1 bg-white/5 hover:bg-white/10 text-white font-bold text-sm py-3 rounded-lg transition-colors"
                    >
                      Atrás
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={loadingAction === 'lead' || (prospectoStep === 3 && otp.join('').length < 6)}
                    className="flex-[2] bg-[#02D7E5] hover:bg-[#02D7E5]/90 text-black font-bold text-sm py-3 rounded-lg transition-colors flex items-center justify-center disabled:opacity-50"
                  >
                    {loadingAction === 'lead' ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : prospectoStep === 3 ? (
                      'Validar y Registrar'
                    ) : (
                      'Continuar'
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}} />
    </div>
  )
}
