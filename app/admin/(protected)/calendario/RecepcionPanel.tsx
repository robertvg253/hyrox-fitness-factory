'use client'

import { useState, useEffect, startTransition, useRef } from 'react'
import { CheckCircle2, Circle, Search, UserPlus, Phone, User, X, Loader2, AlertCircle, XCircle } from 'lucide-react'
import { createClient } from '@/src/utils/supabase/client'
import toast from 'react-hot-toast'
import { marcarAsistencia, registrarWalkIn, registrarLeadYWalkIn, buscarAtletasParaWalkIn } from './actions'
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
    if (!clase?.reservas) {
      setParticipantesLocales([])
      return
    }

    setParticipantesLocales(prev => {
      // Mapeo no destructivo que preserva datos enriquecidos si incoming viene incompleto
      const updated = clase.reservas.map((incoming: any) => {
        const existing = prev.find((p: any) => 
          p.id === incoming.id || 
          (incoming.usuario_id && p.usuario_id === incoming.usuario_id)
        )

        const rawIncomingUser = incoming.atleta || incoming.usuario || incoming.usuarios
        const incomingUser = Array.isArray(rawIncomingUser) ? rawIncomingUser[0] : rawIncomingUser
        const incomingName = incomingUser?.nombre_completo || incomingUser?.nombre || incoming?.nombre_completo || incoming?.nombre

        if (!incomingName && existing) {
          const rawExistingUser = existing.atleta || existing.usuario || existing.usuarios
          const existingUser = Array.isArray(rawExistingUser) ? rawExistingUser[0] : rawExistingUser
          const fallbackName = existing.nombre_completo || existingUser?.nombre_completo || existingUser?.nombre

          return {
            ...incoming,
            nombre_completo: fallbackName,
            atleta: existingUser || incoming.atleta,
            usuario: existingUser || incoming.usuario,
            usuarios: existingUser || incoming.usuarios
          }
        }

        return {
          ...incoming,
          nombre_completo: incomingName || incoming.nombre_completo,
          atleta: incomingUser || incoming.atleta,
          usuario: incomingUser || incoming.usuario,
          usuarios: incomingUser || incoming.usuarios
        }
      })

      // Conservar cualquier reserva temporal optimista que aún no haya llegado en la respuesta
      const pendingOptimistic = prev.filter((p: any) => 
        p.id && String(p.id).startsWith('temp-') && !updated.some((u: any) => (p.usuario_id && u.usuario_id === p.usuario_id) || u.id === p.id)
      )

      return [...updated, ...pendingOptimistic]
    })
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

  const handleMarcarAsistencia = async (reservaId: string, nuevoEstado: 'ASISTIDA' | 'AUSENTE') => {
    setLoadingAction(`asistencia-${reservaId}`)
    try {
      const res = await marcarAsistencia(reservaId, nuevoEstado)
      if (res.success) {
        setParticipantesLocales(prev => prev.map(r => r.id === reservaId ? { 
          ...r, 
          asistio_fisicamente: nuevoEstado === 'ASISTIDA',
          estado_reserva: nuevoEstado 
        } : r))
      } else {
        toast.error(res.error || 'Error al cambiar asistencia')
      }
    } catch (err) {
      toast.error('Error de red')
    } finally {
      setLoadingAction(null)
    }
  }

  // Búsqueda con debounce (300ms) y cancelación de respuestas tardías para no saturar el servidor ni congelar la UI
  useEffect(() => {
    const trimmed = searchQuery.trim()
    if (trimmed.length < 2) {
      setSearchResults([])
      setIsSearching(false)
      return
    }

    setIsSearching(true)
    let isCancelled = false

    const timer = setTimeout(async () => {
      try {
        const res = await buscarAtletasParaWalkIn(trimmed)
        if (!isCancelled) {
          if (res.success && res.data) {
            setSearchResults(res.data)
          } else {
            setSearchResults([])
          }
        }
      } catch {
        if (!isCancelled) setSearchResults([])
      } finally {
        if (!isCancelled) setIsSearching(false)
      }
    }, 300)

    return () => {
      isCancelled = true
      clearTimeout(timer)
    }
  }, [searchQuery])

  const handleRegistrarWalkIn = async (usuarioId: string) => {
    const userToBook = searchResults.find(u => u.id === usuarioId)
    const isActivo = Array.isArray(userToBook?.suscripciones)
      ? userToBook.suscripciones.some((s: any) => s.estado === 'ACTIVO')
      : false

    if (!isActivo) {
      toast.error('El atleta está inactivo.')
      return
    }

    setLoadingAction(`walkin-${usuarioId}`)
    try {
      const res = await registrarWalkIn(clase.id, usuarioId)
      if (res.success) {
        toast.success('Atleta agregado a la clase')
        setActiveTab('A')

        const addedUser = searchResults.find(u => u.id === usuarioId)
        if (addedUser) {
          const nuevaReservaId = res.reserva_id || res.reservaId || `temp-walkin-${Date.now()}`
          setParticipantesLocales(prev => [...prev, {
            id: nuevaReservaId,
            asistio_fisicamente: true,
            estado_reserva: 'CONFIRMADA',
            es_clase_prueba: false,
            atleta: addedUser
          }])
        }

        setSearchQuery('')
        setSearchResults([])
        onUpdate?.()
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

          const resAny = res as any
          const nuevaReservaId = resAny.reserva_id || resAny.reservaId || resAny.reserva?.id || `temp-lead-${Date.now()}`
          const atletaData = resAny.usuarioGenerado || resAny.atleta || resAny.usuario || resAny.usuarios || resAny.reserva?.atleta || {
            id: nuevaReservaId,
            nombre_completo: fullNombre,
            nombre: fullNombre,
            telefono: fullTelefono,
            cedula_rif: fullCedula,
            suscripciones: [{ estado: 'ACTIVO', sesiones_restantes: 0, planes: { tipo: 'SESIONES', nombre: 'Clase de Prueba' } }]
          }
          const leadUserId = atletaData?.id || resAny.reserva?.usuario_id || resAny.usuarioGenerado?.id

          const nuevaReserva = resAny.reserva ? {
            ...resAny.reserva,
            id: nuevaReservaId,
            usuario_id: leadUserId,
            nombre_completo: fullNombre,
            atleta: atletaData,
            usuario: atletaData,
            usuarios: atletaData
          } : {
            id: nuevaReservaId,
            usuario_id: leadUserId,
            clase_id: clase.id,
            estado_reserva: 'ASISTIDA',
            asistio_fisicamente: true,
            es_clase_prueba: true,
            nombre_completo: fullNombre,
            atleta: atletaData,
            usuario: atletaData,
            usuarios: atletaData
          }

          setParticipantesLocales(prev => [...prev, nuevaReserva])

          setProspectoStep(1)
          setOtp(['', '', '', '', '', ''])
          setLeadNombre('')
          setLeadApellido('')
          setLeadCedulaNum('')
          setLeadTelefonoNum('')
          setLeadFechaNacimiento('')
          onUpdate?.()
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
          Clase de Prueba
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
                const isAsistio = res.estado_reserva === 'ASISTIDA'
                const isFalto = res.estado_reserva === 'AUSENTE'
                const rawUser = res.atleta || res.usuario || res.usuarios || (res.nombre_completo ? res : null)
                const user = Array.isArray(rawUser) ? rawUser[0] : rawUser
                const nombreAtleta = user?.nombre_completo || user?.nombre || res?.nombre_completo || res?.nombre || 'Desconocido'
                const isWalkIn = false // Columna origen_reserva eliminada del esquema
                const isPrueba = res.es_clase_prueba === true
                const rawSubs = user?.suscripciones ?? res?.suscripciones
                const subs = Array.isArray(rawSubs) ? rawSubs[0] : rawSubs
                const isSesiones = subs?.planes?.tipo === 'SESIONES' || subs?.plan?.tipo === 'SESIONES'

                return (
                  <div key={res.id} className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${isAsistio ? 'bg-emerald-500/10 border-emerald-500/30' : isFalto ? 'bg-red-500/10 border-red-500/30' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}>
                    <div className="flex items-center gap-3">
                      <div className="flex flex-row items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => handleMarcarAsistencia(res.id, 'ASISTIDA')}
                          disabled={loadingAction === `asistencia-${res.id}`}
                          title="Marcar Asistencia"
                          className={`transition-colors flex items-center justify-center p-1 rounded-full border ${
                            isAsistio 
                              ? 'bg-emerald-500 border-emerald-500 text-black' 
                              : 'border-white/20 text-gray-400 hover:border-white/40 hover:text-white hover:bg-white/10'
                          }`}
                        >
                          {loadingAction === `asistencia-${res.id}` && isAsistio ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                          ) : (
                            <CheckCircle2 className="w-5 h-5" />
                          )}
                        </button>

                        <button
                          onClick={() => handleMarcarAsistencia(res.id, 'AUSENTE')}
                          disabled={loadingAction === `asistencia-${res.id}`}
                          title="Marcar Ausencia"
                          className={`transition-colors flex items-center justify-center p-1 rounded-full border ${
                            isFalto 
                              ? 'bg-red-500 border-red-500 text-black' 
                              : 'border-white/20 text-gray-400 hover:border-white/40 hover:text-white hover:bg-white/10'
                          }`}
                        >
                          {loadingAction === `asistencia-${res.id}` && isFalto ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                          ) : (
                            <XCircle className="w-5 h-5" />
                          )}
                        </button>
                      </div>

                      <div>
                        <p className={`font-bold text-sm flex items-center gap-2 ${isAsistio ? 'text-emerald-50' : isFalto ? 'text-red-50' : 'text-white'}`}>
                          {nombreAtleta}
                          {isWalkIn && <span className="text-[9px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded uppercase font-black">Walk-in</span>}
                          {isPrueba && <span className="text-[9px] bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded uppercase font-black">Prueba</span>}
                        </p>
                        {isSesiones && (
                          <p className={`text-xs mt-0.5 font-medium ${isAsistio ? 'text-emerald-400/80' : isFalto ? 'text-red-400/80' : 'text-gray-400'}`}>
                            {subs?.sesiones_restantes ?? 0} Sesiones restantes
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
                    placeholder="Buscar atleta por nombre o cédula..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 text-white text-sm rounded-lg pl-9 pr-4 py-2.5 focus:outline-none focus:border-[#02D7E5] transition-colors"
                  />
                  {isSearching && <Loader2 className="w-4 h-4 absolute right-3 top-3 text-[#02D7E5] animate-spin" />}
                </div>

                <div className="space-y-2">
                  {searchResults.map(user => {
                    const isAlreadyBooked = participantesLocales.some((r: any) => r.atleta?.id === user.id)
                    const isActivo = Array.isArray(user.suscripciones)
                      ? user.suscripciones.some((s: any) => s.estado === 'ACTIVO')
                      : false

                    return (
                      <div 
                        key={user.id} 
                        className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                          !isActivo 
                            ? 'border-white/5 bg-white/[0.01] opacity-60' 
                            : 'border-white/10 bg-white/[0.02] hover:border-white/20'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <p className={`font-bold text-sm truncate ${isActivo ? 'text-white' : 'text-gray-400'}`}>
                            {user.nombre_completo}
                          </p>
                          {isActivo ? (
                            <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/20 shrink-0">
                              ACTIVO
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-bold text-gray-400 border border-white/10 shrink-0">
                              INACTIVO
                            </span>
                          )}
                        </div>

                        <button
                          onClick={() => isActivo && !isAlreadyBooked && handleRegistrarWalkIn(user.id)}
                          disabled={!isActivo || isAlreadyBooked || loadingAction === `walkin-${user.id}`}
                          className={`font-bold text-xs px-3.5 py-1.5 rounded-lg border transition-colors shrink-0 ${
                            !isActivo
                              ? 'border-white/10 text-gray-500 bg-white/[0.02] cursor-not-allowed'
                              : isAlreadyBooked
                              ? 'border-white/10 text-gray-500 bg-transparent cursor-not-allowed'
                              : 'border-white/20 text-white hover:bg-white/10 hover:border-white/40'
                          }`}
                        >
                          {loadingAction === `walkin-${user.id}` ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : isAlreadyBooked ? (
                            'Registrado'
                          ) : !isActivo ? (
                            'Inactivo'
                          ) : (
                            'Agregar'
                          )}
                        </button>
                      </div>
                    )
                  })}
                  {searchQuery.length >= 2 && searchResults.length === 0 && !isSearching && (
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
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${prospectoStep === step ? 'bg-[#02D7E5] text-black' : prospectoStep > step ? 'bg-[#02D7E5]/30 text-[#02D7E5]' : 'bg-black/50 text-gray-500 border border-white/10'
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

      <style dangerouslySetInnerHTML={{
        __html: `
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
