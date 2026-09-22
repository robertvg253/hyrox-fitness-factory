'use client'

import { useState, useRef, useEffect } from 'react'
import { X, UserPlus, Loader2, CheckCircle, XCircle } from 'lucide-react'
import { crearAtleta, verificarDisponibilidad } from '@/app/admin/(protected)/usuarios/actions'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

interface ModalNuevoAtletaProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: (usuario: any) => void
}

export default function ModalNuevoAtleta({ isOpen, onClose, onSuccess }: ModalNuevoAtletaProps) {
  const [step, setStep] = useState<1 | 2>(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // Step 1: Form Data
  const [nombre, setNombre] = useState('')
  const [apellido, setApellido] = useState('')
  const [cedulaPrefix, setCedulaPrefix] = useState('V-')
  const [cedulaNumber, setCedulaNumber] = useState('')
  const [cedulaStatus, setCedulaStatus] = useState<'idle' | 'checking' | 'available' | 'exists'>('idle')
  const [countryCode, setCountryCode] = useState('+58')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [phoneStatus, setPhoneStatus] = useState<'idle' | 'checking' | 'available' | 'exists'>('idle')
  
  // Step 2: OTP
  const [otpCode, setOtpCode] = useState('')
  const [countdown, setCountdown] = useState(0)
  const [otpError, setOtpError] = useState('')
  
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const router = useRouter()

  useEffect(() => {
    if (!isOpen) {
      // Reset state when closed
      setStep(1)
      setNombre('')
      setApellido('')
      setCedulaNumber('')
      setPhoneNumber('')
      setOtpCode('')
      setCountdown(0)
      setOtpError('')
      setCedulaStatus('idle')
      setPhoneStatus('idle')
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [isOpen])

  useEffect(() => {
    if (cedulaNumber.length < 7) {
      setCedulaStatus('idle')
      return
    }

    const timer = setTimeout(async () => {
      setCedulaStatus('checking')
      const fullCedula = `${cedulaPrefix.replace('-', '')}${cedulaNumber.trim()}`
      const res = await verificarDisponibilidad(fullCedula)
      if (res.cedulaExiste) {
        setCedulaStatus('exists')
      } else {
        setCedulaStatus('available')
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [cedulaNumber, cedulaPrefix])

  useEffect(() => {
    const cleanPhone = phoneNumber.replace(/\D/g, '')
    if (cleanPhone.length < 10) {
      setPhoneStatus('idle')
      return
    }

    const timer = setTimeout(async () => {
      setPhoneStatus('checking')
      const fullPhone = `${countryCode}${cleanPhone}`
      const res = await verificarDisponibilidad(undefined, fullPhone)
      if (res.telefonoExiste) {
        setPhoneStatus('exists')
      } else {
        setPhoneStatus('available')
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [phoneNumber, countryCode])

  if (!isOpen) return null

  const startCountdown = () => {
    setCountdown(60)
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    
    if (cedulaStatus === 'exists' || cedulaStatus === 'checking' || phoneStatus === 'exists' || phoneStatus === 'checking') {
      return
    }

    setOtpError('')
    setIsSubmitting(true)
    
    try {
      const fullPhone = `${countryCode}${phoneNumber.replace(/\s+/g, '')}`
      
      const check = await verificarDisponibilidad(undefined, fullPhone)
      if (check.telefonoExiste) {
        setPhoneStatus('exists')
        toast.error('Este teléfono ya está registrado por otro atleta')
        setIsSubmitting(false)
        return
      }

      const response = await fetch('/api/auth/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telefono: fullPhone })
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        toast.error(data.error || 'Error enviando OTP')
      } else {
        toast.success(step === 1 ? 'Código enviado por WhatsApp' : 'Código reenviado')
        setStep(2)
        startCountdown()
      }
    } catch (error) {
      console.error(error)
      toast.error('Ocurrió un error inesperado')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleVerifyAndRegister = async () => {
    if (otpCode.length !== 6) {
      toast.error('El código debe tener 6 dígitos')
      return
    }
    
    setIsSubmitting(true)
    
    try {
      const fullPhone = `${countryCode}${phoneNumber.replace(/\s+/g, '')}`
      
      // 1. Verify OTP
      const verifyRes = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telefono: fullPhone, codigo: otpCode })
      })
      
      if (!verifyRes.ok) {
        setOtpError('Código incorrecto')
        toast.error('Código incorrecto')
        setIsSubmitting(false) // Early return
        return
      }
      
      // 2. Create User
      const formData = new FormData()
      formData.set('nombre', nombre)
      formData.set('apellido', apellido)
      formData.set('cedula', `${cedulaPrefix.replace('-', '')}${cedulaNumber.trim()}`)
      formData.set('telefono', fullPhone)

      const res = await crearAtleta(formData)
      
      if (!res.success) {
        toast.error(res.error || 'Error al crear el atleta')
      } else {
        toast.success('Usuario creado exitosamente')
        if (onSuccess) {
          onSuccess(res.data)
        } else {
          onClose()
          router.refresh()
        }
      }
    } catch (error) {
      console.error(error)
      toast.error('Ocurrió un error inesperado')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '')
    // Remover ceros a la izquierda
    val = val.replace(/^0+/, '')
    
    // Máscara visual: ### ### ####
    let formatted = ''
    if (val.length > 0) formatted += val.substring(0, 3)
    if (val.length > 3) formatted += ' ' + val.substring(3, 6)
    if (val.length > 6) formatted += ' ' + val.substring(6, 10)
    setPhoneNumber(formatted)
  }

  const handleCedulaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '')
    setCedulaNumber(val)
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 w-full max-w-md bg-zinc-950 border-l border-white/10 z-50 shadow-2xl flex flex-col transform transition-transform duration-300 translate-x-0">
        
        <div className="flex flex-col h-full">
          <div className="p-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-[#02D7E5]" />
              Nuevo Atleta {step === 2 && '(Verificación)'}
            </h2>
            <button onClick={onClose} className="p-2 text-zinc-400 hover:text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {step === 1 ? (
              <form id="form-nuevo-atleta" onSubmit={handleSendOtp} className="p-6 space-y-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Nombre</label>
                    <input
                      type="text"
                      required
                      value={nombre}
                      onChange={(e) => setNombre(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 text-white rounded-lg focus:ring-[#02D7E5] focus:border-[#02D7E5] block p-3 transition-colors"
                      placeholder="Ej. Juan"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Apellido</label>
                    <input
                      type="text"
                      required
                      value={apellido}
                      onChange={(e) => setApellido(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 text-white rounded-lg focus:ring-[#02D7E5] focus:border-[#02D7E5] block p-3 transition-colors"
                      placeholder="Ej. Pérez"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Cédula</label>
                    <div className="flex bg-black/40 border border-white/10 rounded-lg overflow-hidden focus-within:ring-1 focus-within:ring-[#02D7E5] focus-within:border-[#02D7E5] transition-colors">
                      <select 
                        value={cedulaPrefix}
                        onChange={(e) => setCedulaPrefix(e.target.value)}
                        className="bg-transparent text-white p-3 border-r border-white/10 outline-none cursor-pointer hover:bg-white/5 font-mono text-sm"
                      >
                        <option value="V-">V-</option>
                        <option value="E-">E-</option>
                      </select>
                      <input
                        type="text"
                        required
                        value={cedulaNumber}
                        onChange={handleCedulaChange}
                        className="w-full bg-transparent text-white block p-3 outline-none font-mono text-sm"
                        placeholder="12345678"
                      />
                      <div className="flex items-center px-3 border-l border-white/10">
                        {cedulaStatus === 'checking' && <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />}
                        {cedulaStatus === 'available' && <CheckCircle className="w-4 h-4 text-green-500" />}
                        {cedulaStatus === 'exists' && <XCircle className="w-4 h-4 text-red-500" />}
                      </div>
                    </div>
                    {cedulaStatus === 'exists' && (
                      <p className="text-red-500 text-xs mt-1 font-medium animate-in slide-in-from-top-1">Cédula ya registrada</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Teléfono (WhatsApp)</label>
                    <div className="flex bg-black/40 border border-white/10 rounded-lg overflow-hidden focus-within:ring-1 focus-within:ring-[#02D7E5] focus-within:border-[#02D7E5] transition-colors">
                      <select 
                        value={countryCode}
                        onChange={(e) => setCountryCode(e.target.value)}
                        className="bg-transparent text-white p-3 border-r border-white/10 outline-none cursor-pointer hover:bg-white/5 font-mono text-sm"
                      >
                        <option value="+58">+58 (VE)</option>
                        <option value="+1">+1 (US)</option>
                        <option value="+57">+57 (CO)</option>
                        <option value="+54">+54 (AR)</option>
                        <option value="+34">+34 (ES)</option>
                        <option value="+51">+51 (PE)</option>
                      </select>
                      <input
                        type="text"
                        required
                        value={phoneNumber}
                        onChange={handlePhoneChange}
                        className="w-full bg-transparent text-white block p-3 outline-none font-mono text-sm"
                        placeholder="414 123 4567"
                      />
                      <div className="flex items-center px-3 border-l border-white/10">
                        {phoneStatus === 'checking' && <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />}
                        {phoneStatus === 'available' && <CheckCircle className="w-4 h-4 text-green-500" />}
                        {phoneStatus === 'exists' && <XCircle className="w-4 h-4 text-red-500" />}
                      </div>
                    </div>
                    {phoneStatus === 'exists' && (
                      <p className="text-red-500 text-xs mt-1 font-medium animate-in slide-in-from-top-1">Teléfono ya registrado</p>
                    )}
                  </div>
                </div>
              </form>
            ) : (
              <div className="p-6 space-y-8 flex flex-col items-center justify-center h-full">
                <div className="text-center space-y-2">
                  <h3 className="text-lg font-bold text-white">Verificación de WhatsApp</h3>
                  <p className="text-sm text-zinc-400">
                    Ingresa el código de 6 dígitos que enviamos al <span className="text-white font-medium">{countryCode} {phoneNumber}</span>
                  </p>
                </div>
                
                <div className="flex flex-col items-center gap-2">
                  <input
                    type="text"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => {
                      setOtpCode(e.target.value.replace(/\D/g, ''))
                      setOtpError('')
                    }}
                    className={`w-48 bg-black/40 border-2 ${otpError ? 'border-red-500/50 focus:ring-red-500 focus:border-red-500' : 'border-white/10 focus:ring-[#02D7E5] focus:border-[#02D7E5]'} text-white rounded-xl block p-4 text-center text-3xl tracking-widest font-mono transition-all outline-none placeholder-zinc-700`}
                    placeholder="000000"
                  />
                  {otpError && (
                    <p className="text-red-400 text-sm font-medium animate-in slide-in-from-top-1 opacity-0 fill-mode-forwards duration-300">
                      {otpError}
                    </p>
                  )}
                </div>
                
                <div className="text-center">
                  {countdown > 0 ? (
                    <p className="text-xs text-zinc-500 font-medium">
                      Podrás reenviar el código en <span className="text-[#02D7E5]">{countdown}s</span>
                    </p>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleSendOtp()}
                      disabled={isSubmitting}
                      className="text-sm text-[#02D7E5] hover:text-white transition-colors font-semibold"
                    >
                      Reenviar Código
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="p-6 border-t border-white/10 bg-zinc-900">
             {step === 1 ? (
               <button 
                  type="submit" 
                  form="form-nuevo-atleta"
                  disabled={isSubmitting || cedulaStatus === 'exists' || cedulaStatus === 'checking' || phoneStatus === 'exists' || phoneStatus === 'checking'}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-[#02D7E5]/10 hover:bg-[#02D7E5]/20 text-[#02D7E5] border border-[#02D7E5]/20 font-bold rounded-lg transition-colors disabled:opacity-50"
               >
                 {isSubmitting ? (
                   <>
                     <Loader2 className="w-5 h-5 animate-spin" />
                     Enviando OTP...
                   </>
                 ) : (
                   'Continuar'
                 )}
               </button>
             ) : (
               <div className="flex gap-3">
                 <button 
                    type="button"
                    onClick={() => setStep(1)}
                    disabled={isSubmitting}
                    className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-bold rounded-lg transition-colors disabled:opacity-50"
                 >
                   Volver
                 </button>
                 <button 
                    type="button"
                    onClick={handleVerifyAndRegister}
                    disabled={isSubmitting || otpCode.length !== 6}
                    className="flex-[2] flex items-center justify-center gap-2 py-3 bg-[#02D7E5] hover:bg-[#02D7E5]/90 text-black font-bold rounded-lg transition-colors disabled:opacity-50"
                 >
                   {isSubmitting ? (
                     <>
                       <Loader2 className="w-5 h-5 animate-spin" />
                       Verificando...
                     </>
                   ) : (
                     'Verificar y Registrar'
                   )}
                 </button>
               </div>
             )}
          </div>
        </div>
      </div>
    </>
  )
}
