'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { Loader2, ArrowRight, ShieldCheck, ArrowLeft, AlertCircle, Check } from 'lucide-react'
import { createClient } from '@/src/utils/supabase/client'
import { enviarOtp, validarOtp, obtenerSedesPublicas, completarRegistroUsuario, evaluarCedulaRegistro } from '@/app/auth/actions'
import toast from 'react-hot-toast'

export default function RegistroPage() {
  const router = useRouter()
  const supabase = createClient()
  
  // Steps: 1: Cédula, 2: Teléfono, 3: OTP, 4: Smart Onboarding Stepper
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [loading, setLoading] = useState(false)

  // Smart Onboarding State
  const [onboardingState, setOnboardingState] = useState<'NUEVO' | 'ESCALONADO' | 'COMPLETO' | null>(null)
  const [onboardingStep, setOnboardingStep] = useState<1 | 2 | 3 | 4>(1)
  const [preUserData, setPreUserData] = useState<any>(null)

  // Form Data - Identificación
  const [tipoDocumento, setTipoDocumento] = useState('V')
  const [numeroDocumento, setNumeroDocumento] = useState('')
  const [cedula, setCedula] = useState('')
  const [countryCode, setCountryCode] = useState('+58')
  const [phoneRaw, setPhoneRaw] = useState('')
  const [phoneFormatted, setPhoneFormatted] = useState('')
  const [telefono, setTelefono] = useState('')
  const [telefonoUltimos4, setTelefonoUltimos4] = useState('')

  // Datos para Registro Nuevo / Escalonado
  const [nombre, setNombre] = useState('')
  const [apellido, setApellido] = useState('')
  const [sedeId, setSedeId] = useState('')
  const [fechaNacimiento, setFechaNacimiento] = useState('')
  const [genero, setGenero] = useState<'M' | 'F' | 'OTRO' | ''>('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [aceptoTerminos, setAceptoTerminos] = useState(false)

  // Validación de requisitos de contraseña en tiempo real
  const hasMinLength = password.length >= 8
  const hasUppercase = /[A-Z]/.test(password)
  const hasNumber = /[0-9]/.test(password)
  const hasSpecialChar = /[^A-Za-z0-9]/.test(password)
  const isPasswordValid = hasMinLength && hasUppercase && hasNumber && hasSpecialChar
  
  const [sedes, setSedes] = useState<any[]>([])
  const [isLoadingSedes, setIsLoadingSedes] = useState(true)
  const [errorSedes, setErrorSedes] = useState(false)

  const [errorVisual, setErrorVisual] = useState('')

  // OTP Data
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [timer, setTimer] = useState(60)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    let interval: NodeJS.Timeout
    if (step === 3 && timer > 0) {
      interval = setInterval(() => setTimer(t => t - 1), 1000)
    }
    return () => clearInterval(interval)
  }, [step, timer])

  useEffect(() => {
    const fetchSedes = async () => {
      try {
        setIsLoadingSedes(true)
        setErrorSedes(false)
        const res = await obtenerSedesPublicas()
          
        if (!res.success) throw new Error(res.error)
        
        if (res.data) {
          setSedes(res.data)
          if (res.data.length === 1) setSedeId(res.data[0].id)
        }
      } catch (err) {
        console.error('Error fetching sedes:', err)
        setErrorSedes(true)
        toast.error('Error cargando sedes')
      } finally {
        setIsLoadingSedes(false)
      }
    }
    fetchSedes()
  }, [])

  // Handlers - Fase Inicial
  const handleStep1 = async (e: React.FormEvent) => {
    e.preventDefault()
    if (numeroDocumento.length < 7) return toast.error('Ingresa un número válido de al menos 7 dígitos')
    
    const fullCedula = `${tipoDocumento}${numeroDocumento}`
    setCedula(fullCedula)

    setLoading(true)
    try {
      const res = await evaluarCedulaRegistro(fullCedula)
      if (!res.success) {
        toast.error(res.error || 'Error verificando la cédula.')
        return
      }

      if (res.estado === 'COMPLETO') {
        setOnboardingState('COMPLETO')
        setPreUserData(res.usuario)
        setStep(4)
        return
      }

      if (res.estado === 'ESCALONADO') {
        setOnboardingState('ESCALONADO')
        setPreUserData(res.usuario)
        setTelefono(res.telefono || '')
        setTelefonoUltimos4(res.ultimosCuatroDigitos || '')
        setTimer(60)
        setStep(3)
        toast.success(res.message || 'Código de seguridad enviado a tu WhatsApp')
        return
      }

      // Flujo 1: NUEVO (pasa al input de teléfono manual)
      setOnboardingState('NUEVO')
      setStep(2)
    } catch {
      toast.error('Error de conexión al verificar cédula.')
    } finally {
      setLoading(false)
    }
  }

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 10)
    setPhoneRaw(raw)
    
    let formatted = raw
    if (raw.length > 3 && raw.length <= 6) {
      formatted = `${raw.slice(0,3)} ${raw.slice(3)}`
    } else if (raw.length > 6) {
      formatted = `${raw.slice(0,3)} ${raw.slice(3,6)} ${raw.slice(6)}`
    }
    setPhoneFormatted(formatted)
  }

  const handleStep2Telefono = async (e: React.FormEvent) => {
    e.preventDefault()
    if (phoneRaw.length < 10) {
       return toast.error('Ingresa un teléfono válido de 10 dígitos')
    }

    const fullPhone = `${countryCode}${phoneRaw}`
    setTelefono(fullPhone)

    setLoading(true)
    try {
      const otpRes = await enviarOtp(fullPhone)
      if (otpRes.success) {
        toast.success(otpRes.message as any || 'Código OTP enviado')
        setStep(3)
        setTimer(60)
      } else {
        toast.error(otpRes.error || 'Error al enviar el código.')
      }
    } catch {
      toast.error('Error de conexión.')
    } finally {
      setLoading(false)
    }
  }

  // OTP Handlers
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

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorVisual('')
    const codigo = otp.join('')
    if (codigo.length < 6) return toast.error('Ingresa el código completo')

    setLoading(true)
    try {
      const res = await validarOtp(telefono, codigo, { isRegister: true, cedula })
      
      if (res.success && res.estado) {
        setOnboardingState(res.estado)
        if (res.usuario) {
          setPreUserData(res.usuario)
        }
        // Salto inteligente: ESCALONADO va directo al paso 4
        if (res.estado === 'ESCALONADO') {
          setOnboardingStep(4)
        } else if (res.estado === 'NUEVO') {
          setOnboardingStep(1)
        }
        setStep(4)
      } else {
        toast.error(res.error || 'Código incorrecto.')
        setErrorVisual(res.error || 'Código incorrecto.')
      }
    } catch {
      toast.error('Error de conexión.')
      setErrorVisual('Error de conexión.')
    } finally {
      setLoading(false)
    }
  }

  const handleResendOtp = async () => {
    setLoading(true)
    await enviarOtp(telefono)
    setTimer(60)
    setLoading(false)
    toast.success('Código reenviado')
  }

  // Handlers - Stepper Onboarding (NUEVO)
  const handleNextStep1 = (e: React.FormEvent) => {
    e.preventDefault()
    if (!nombre.trim() || !apellido.trim()) {
      return toast.error('Completa tu nombre y apellido')
    }
    setOnboardingStep(2)
  }

  const handleNextStep2 = (e: React.FormEvent) => {
    e.preventDefault()
    if (!sedeId) {
      return toast.error('Selecciona tu sede principal')
    }
    setOnboardingStep(3)
  }

  const handleNextStep3 = (e: React.FormEvent) => {
    e.preventDefault()
    if (!fechaNacimiento) {
      return toast.error('Ingresa tu fecha de nacimiento')
    }
    if (!genero) {
      return toast.error('Selecciona tu género')
    }
    setOnboardingStep(4)
  }

  // Submit Final (Paso 4)
  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorVisual('')

    if (!isPasswordValid) {
      return toast.error('La contraseña debe cumplir con todos los requisitos de seguridad')
    }
    if (password !== confirmPassword) {
      return toast.error('Las contraseñas no coinciden')
    }
    if (!aceptoTerminos) {
      return toast.error('Debes aceptar los Términos y Condiciones')
    }

    if (onboardingState === 'NUEVO') {
      if (!nombre.trim() || !apellido.trim()) {
        setOnboardingStep(1)
        return toast.error('Completa tu nombre y apellido')
      }
      if (!sedeId) {
        setOnboardingStep(2)
        return toast.error('Selecciona tu sede principal')
      }
      if (!fechaNacimiento || !genero) {
        setOnboardingStep(3)
        return toast.error('Completa tu fecha de nacimiento y género')
      }
    }

    if (onboardingState !== 'NUEVO' && onboardingState !== 'ESCALONADO') {
      return
    }

    setLoading(true)
    try {
      const res = await completarRegistroUsuario({
        estado: onboardingState,
        cedula,
        telefono,
        password,
        nombre: nombre.trim(),
        apellido: apellido.trim(),
        sedeId,
        usuarioId: preUserData?.id,
        fechaNacimiento: fechaNacimiento || undefined,
        genero: genero || undefined
      })

      if (res.success && res.email && res.password) {
        const { error: loginErr } = await supabase.auth.signInWithPassword({
          email: res.email,
          password: res.password
        })

        if (loginErr) {
          toast.success('Cuenta activada con éxito. Por favor inicia sesión.')
          router.push('/login')
          return
        }

        toast.success('¡Registro exitoso! Bienvenido.')
        router.push('/dashboard')
      } else {
        toast.error(res.error || 'Error al completar el registro.')
        setErrorVisual(res.error || 'Error al completar el registro.')
      }
    } catch {
      toast.error('Error inesperado durante el registro.')
      setErrorVisual('Error inesperado durante el registro.')
    } finally {
      setLoading(false)
    }
  }

  // Determinación de visibilidad y acción del botón Volver
  const canGoBack = (step > 1 && step < 4) || (step === 4 && onboardingState === 'NUEVO' && onboardingStep > 1)
  
  const handleBack = () => {
    if (step > 1 && step < 4) {
      if (step === 3 && onboardingState === 'ESCALONADO') {
        setStep(1)
      } else {
        setStep((step - 1) as any)
      }
    } else if (step === 4 && onboardingState === 'NUEVO' && onboardingStep > 1) {
      setOnboardingStep((onboardingStep - 1) as any)
    }
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-start pt-6 sm:pt-12 pb-12 px-5">
      <div className="w-full max-w-md flex flex-col items-start">
        
        {/* Nav Back */}
        {canGoBack ? (
          <button 
            type="button"
            onClick={handleBack} 
            disabled={loading}
            className="mb-6 flex items-center text-sm font-medium text-zinc-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-1" /> Volver
          </button>
        ) : (
          <div className="mb-6 h-[20px]" />
        )}

        {/* Encabezado Principal */}
        <div className="w-full flex flex-col items-start mb-6">
          <Image
            src="/images/LOGO TEXTURA01.png"
            alt="Logo Fitness Factory"
            width={120}
            height={40}
            className="h-auto w-[120px] object-contain mb-4"
            priority
          />
          <h1 className="text-2xl font-bold tracking-tight text-white mb-1">
            {step === 4 && onboardingState === 'ESCALONADO' 
              ? 'Activa tu Cuenta' 
              : step === 4 && onboardingState === 'COMPLETO'
              ? 'Verificación'
              : step === 4 && onboardingState === 'NUEVO'
              ? (onboardingStep === 1 
                  ? 'Tus Datos' 
                  : onboardingStep === 2 
                  ? 'Elige tu Sede' 
                  : onboardingStep === 3 
                  ? 'Tu Perfil' 
                  : 'Crea tu Contraseña')
              : 'Crea tu Cuenta'}
          </h1>
          <p className="text-sm text-zinc-400">
            {step === 4 && onboardingState === 'NUEVO'
              ? `Paso ${onboardingStep} de 4`
              : step === 4 && onboardingState === 'ESCALONADO'
              ? 'Paso final: Define tu contraseña'
              : step === 4 && onboardingState === 'COMPLETO'
              ? 'Usuario existente'
              : step === 3 && onboardingState === 'ESCALONADO'
              ? 'Validación de Seguridad'
              : `Paso ${step} de 3`}
          </p>

          {/* Stepper Progress Bar para usuario NUEVO en Step 4 */}
          {step === 4 && onboardingState === 'NUEVO' && (
            <div className="flex items-center gap-1.5 w-full mt-3">
              {[1, 2, 3, 4].map((s) => (
                <div
                  key={s}
                  className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                    s <= onboardingStep ? 'bg-[#02D7E5]' : 'bg-zinc-800'
                  }`}
                />
              ))}
            </div>
          )}
        </div>

        <div className="w-full relative min-h-[300px]">
          {/* Step 1: Cédula */}
          {step === 1 && (
            <form onSubmit={handleStep1} className="space-y-6 w-full animate-in slide-in-from-right-4 fade-in duration-300">
              <div className="space-y-3">
                <label className="block text-sm font-bold text-zinc-300">
                  Cédula de Identidad
                </label>
                <div className="flex flex-row gap-2">
                  <select
                    value={tipoDocumento}
                    onChange={e => setTipoDocumento(e.target.value)}
                    disabled={loading}
                    className="w-[80px] p-4 bg-zinc-900 border border-zinc-800 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-[#02D7E5] focus:border-[#02D7E5] transition-all text-lg font-medium appearance-none text-center cursor-pointer disabled:opacity-50"
                  >
                    <option value="V">V</option>
                    <option value="E">E</option>
                    <option value="J">J</option>
                    <option value="G">G</option>
                    <option value="P">P</option>
                  </select>
                  <input
                    required
                    type="text"
                    value={numeroDocumento}
                    onChange={e => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 9)
                      setNumeroDocumento(val)
                    }}
                    disabled={loading}
                    className="flex-1 p-4 bg-zinc-900 border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-[#02D7E5] focus:border-[#02D7E5] transition-all disabled:opacity-50 text-lg font-medium"
                    placeholder="Ej. 12345678"
                    autoFocus
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || numeroDocumento.length < 7}
                className="w-full flex items-center justify-center gap-2 py-4 font-bold text-black bg-[#02D7E5] hover:bg-[#02D7E5]/90 rounded-xl transition-all disabled:opacity-50 mt-4 shadow-[0_0_20px_rgba(2,215,229,0.2)]"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                  <>Continuar <ArrowRight className="w-5 h-5" /></>
                )}
              </button>

              <div className="pt-6 mt-6 border-t border-zinc-900">
                <Link href="/login" className="text-sm font-medium text-zinc-400 hover:text-white transition-colors flex items-center">
                  ¿Ya tienes cuenta? <span className="text-[#02D7E5] ml-1">Inicia sesión</span>
                </Link>
              </div>
            </form>
          )}

          {/* Step 2: Teléfono */}
          {step === 2 && (
            <form onSubmit={handleStep2Telefono} className="space-y-6 w-full animate-in slide-in-from-right-4 fade-in duration-300">
              <div className="space-y-3">
                <label className="block text-sm font-bold text-zinc-300">
                  Teléfono (WhatsApp)
                </label>
                <div className="flex flex-row gap-2">
                  <select
                    value={countryCode}
                    onChange={e => setCountryCode(e.target.value)}
                    disabled={loading}
                    className="w-[100px] p-4 bg-zinc-900 border border-zinc-800 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-[#02D7E5] focus:border-[#02D7E5] transition-all text-lg font-medium appearance-none text-center cursor-pointer disabled:opacity-50"
                  >
                    <option value="+58">+58 VE</option>
                    <option value="+1">+1 US</option>
                    <option value="+34">+34 ES</option>
                    <option value="+57">+57 CO</option>
                    <option value="+54">+54 AR</option>
                    <option value="+56">+56 CL</option>
                    <option value="+51">+51 PE</option>
                  </select>
                  <input
                    required
                    type="tel"
                    value={phoneFormatted}
                    onChange={handlePhoneChange}
                    disabled={loading}
                    className="flex-1 p-4 bg-zinc-900 border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-[#02D7E5] focus:border-[#02D7E5] transition-all disabled:opacity-50 text-lg font-medium tracking-wide"
                    placeholder="Ej. 414 123 4567"
                    autoFocus
                  />
                </div>
                <p className="text-xs text-zinc-500 mt-2">
                  Enviaremos un código de seguridad por WhatsApp para validar tu cuenta.
                </p>
              </div>

              <button
                type="submit"
                disabled={loading || phoneRaw.length < 10}
                className="w-full flex items-center justify-center gap-2 py-4 font-bold text-black bg-[#02D7E5] hover:bg-[#02D7E5]/90 rounded-xl transition-all disabled:opacity-50 mt-4 shadow-[0_0_20px_rgba(2,215,229,0.2)]"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Enviar Código OTP'}
              </button>
            </form>
          )}

          {/* Step 3: OTP */}
          {step === 3 && (
            <form onSubmit={handleVerifyOtp} className="space-y-8 w-full animate-in slide-in-from-right-4 fade-in duration-300">
              <div className="space-y-2">
                <div className="flex items-center gap-3 mb-4">
                  <ShieldCheck className="w-8 h-8 text-[#02D7E5] shrink-0" />
                  {onboardingState === 'ESCALONADO' ? (
                    <p className="text-sm text-zinc-300 leading-relaxed">
                      Hemos enviado un código de seguridad al número que registraste en recepción{' '}
                      <span className="font-bold text-white tracking-wide">
                        (termina en {telefonoUltimos4 || telefono.slice(-4)})
                      </span>.
                    </p>
                  ) : (
                    <p className="text-sm text-zinc-300 leading-relaxed">
                      Hemos enviado un código a <br/>
                      <span className="font-bold text-white tracking-wide">{telefono}</span>
                    </p>
                  )}
                </div>
                
                <div className="flex justify-between gap-2 mt-6">
                  {otp.map((digit, index) => (
                    <input
                      key={index}
                      ref={el => { inputRefs.current[index] = el }}
                      type="text"
                      maxLength={1}
                      value={digit}
                      onChange={e => handleOtpChange(index, e.target.value)}
                      onKeyDown={e => handleOtpKeyDown(index, e)}
                      disabled={loading}
                      className="w-12 h-14 sm:w-14 sm:h-16 text-center text-2xl font-bold bg-zinc-900 border border-zinc-800 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-[#02D7E5] focus:border-transparent transition-all disabled:opacity-50"
                      autoFocus={index === 0}
                    />
                  ))}
                </div>
                {errorVisual && (
                  <p className="text-red-400 text-sm font-medium mt-3 text-center">{errorVisual}</p>
                )}
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading || otp.join('').length < 6}
                  className="w-full flex items-center justify-center gap-2 py-4 font-bold text-black bg-[#02D7E5] hover:bg-[#02D7E5]/90 rounded-xl transition-all disabled:opacity-50 shadow-[0_0_20px_rgba(2,215,229,0.2)]"
                >
                  {loading ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /> Validando...</>
                  ) : 'Verificar Código'}
                </button>
              </div>

              <div className="text-center pt-2">
                {timer > 0 ? (
                  <p className="text-sm text-zinc-500 font-medium">Reenviar código en {timer}s</p>
                ) : (
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={loading}
                    className="text-sm font-bold text-[#02D7E5] hover:text-white transition-colors"
                  >
                    Reenviar código ahora
                  </button>
                )}
              </div>
            </form>
          )}

          {/* Step 4: Smart Onboarding Stepper */}
          {step === 4 && (
            <div className="w-full animate-in slide-in-from-right-4 fade-in duration-300">
              
              {/* Caso COMPLETO: Bloqueo con alerta */}
              {onboardingState === 'COMPLETO' && (
                <div className="p-6 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-center space-y-5">
                  <div className="w-14 h-14 mx-auto rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400">
                    <AlertCircle className="w-8 h-8" />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-xl font-bold text-white">Cuenta Ya Registrada</h2>
                    <p className="text-sm text-zinc-300 leading-relaxed">
                      Esta cédula ya está registrada y activa. Por favor, inicia sesión con tu contraseña.
                    </p>
                  </div>
                  <Link
                    href="/login"
                    className="inline-flex w-full items-center justify-center gap-2 py-3.5 font-bold text-black bg-[#02D7E5] hover:bg-[#02D7E5]/90 rounded-xl transition-all shadow-[0_0_20px_rgba(2,215,229,0.2)]"
                  >
                    Ir a Iniciar Sesión <ArrowRight className="w-5 h-5" />
                  </Link>
                </div>
              )}

              {/* Caso NUEVO: Wizard / Stepper de 4 Pasos */}
              {onboardingState === 'NUEVO' && (
                <div className="w-full">
                  
                  {/* NUEVO - Paso 1: Nombres y Apellidos */}
                  {onboardingStep === 1 && (
                    <form onSubmit={handleNextStep1} className="space-y-5 w-full animate-in slide-in-from-right-4 fade-in duration-300">
                      <div className="space-y-2">
                        <label className="block text-sm font-bold text-zinc-300">Nombre</label>
                        <input
                          required
                          type="text"
                          value={nombre}
                          onChange={e => setNombre(e.target.value)}
                          disabled={loading}
                          className="w-full p-4 bg-zinc-900 border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-[#02D7E5] focus:border-[#02D7E5] transition-all text-base font-medium"
                          placeholder="Ej. Juan"
                          autoFocus
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="block text-sm font-bold text-zinc-300">Apellido</label>
                        <input
                          required
                          type="text"
                          value={apellido}
                          onChange={e => setApellido(e.target.value)}
                          disabled={loading}
                          className="w-full p-4 bg-zinc-900 border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-[#02D7E5] focus:border-[#02D7E5] transition-all text-base font-medium"
                          placeholder="Ej. Pérez"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={loading || !nombre.trim() || !apellido.trim()}
                        className="w-full flex items-center justify-center gap-2 py-4 font-bold text-black bg-[#02D7E5] hover:bg-[#02D7E5]/90 rounded-xl transition-all disabled:opacity-50 mt-6 shadow-[0_0_20px_rgba(2,215,229,0.2)]"
                      >
                        Continuar <ArrowRight className="w-5 h-5" />
                      </button>
                    </form>
                  )}

                  {/* NUEVO - Paso 2: Sede Principal */}
                  {onboardingStep === 2 && (
                    <form onSubmit={handleNextStep2} className="space-y-5 w-full animate-in slide-in-from-right-4 fade-in duration-300">
                      <div className="space-y-3">
                        <label className="block text-sm font-bold text-zinc-300">Selecciona tu Sede Principal</label>
                        {isLoadingSedes ? (
                          <div className="flex items-center justify-center p-8">
                            <Loader2 className="w-6 h-6 text-[#02D7E5] animate-spin" />
                          </div>
                        ) : errorSedes ? (
                          <div className="text-red-400 text-sm p-4 bg-red-950/30 border border-red-900/50 rounded-xl">
                            Error cargando las sedes disponibles.
                          </div>
                        ) : (
                          <div className="space-y-2.5">
                            {sedes.map(sede => (
                              <button
                                type="button"
                                key={sede.id}
                                onClick={() => setSedeId(sede.id)}
                                className={`w-full p-4 rounded-xl border text-left transition-all flex items-center justify-between ${
                                  sedeId === sede.id 
                                    ? 'bg-[#02D7E5]/10 border-[#02D7E5] text-[#02D7E5]' 
                                    : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                                }`}
                              >
                                <div>
                                  <p className="font-bold text-base">{sede.nombre}</p>
                                  {sede.ciudad && (
                                    <p className="text-xs text-zinc-500 mt-0.5">{sede.ciudad}</p>
                                  )}
                                </div>
                                <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                                  sedeId === sede.id ? 'border-[#02D7E5] bg-[#02D7E5]' : 'border-zinc-700'
                                }`}>
                                  {sedeId === sede.id && <div className="w-2 h-2 rounded-full bg-black" />}
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      <button
                        type="submit"
                        disabled={loading || !sedeId}
                        className="w-full flex items-center justify-center gap-2 py-4 font-bold text-black bg-[#02D7E5] hover:bg-[#02D7E5]/90 rounded-xl transition-all disabled:opacity-50 mt-6 shadow-[0_0_20px_rgba(2,215,229,0.2)]"
                      >
                        Continuar <ArrowRight className="w-5 h-5" />
                      </button>
                    </form>
                  )}

                  {/* NUEVO - Paso 3: Fecha de Nacimiento y Género */}
                  {onboardingStep === 3 && (
                    <form onSubmit={handleNextStep3} className="space-y-5 w-full animate-in slide-in-from-right-4 fade-in duration-300">
                      <div className="space-y-2">
                        <label className="block text-sm font-bold text-zinc-300">Fecha de Nacimiento</label>
                        <input
                          required
                          type="date"
                          value={fechaNacimiento}
                          onChange={e => setFechaNacimiento(e.target.value)}
                          max={new Date().toISOString().split('T')[0]}
                          disabled={loading}
                          className="w-full p-4 bg-zinc-900 border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-[#02D7E5] focus:border-[#02D7E5] transition-all text-base font-medium disabled:opacity-50"
                          style={{ colorScheme: 'dark' }}
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="block text-sm font-bold text-zinc-300">Género</label>
                        <div className="grid grid-cols-3 gap-2.5">
                          {[
                            { id: 'M', label: 'Masculino' },
                            { id: 'F', label: 'Femenino' },
                            { id: 'OTRO', label: 'Otro' }
                          ].map(item => (
                            <button
                              type="button"
                              key={item.id}
                              onClick={() => setGenero(item.id as any)}
                              className={`py-3.5 px-3 rounded-xl border text-center font-bold text-sm transition-all ${
                                genero === item.id
                                  ? 'bg-[#02D7E5]/10 border-[#02D7E5] text-[#02D7E5]'
                                  : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                              }`}
                            >
                              {item.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={loading || !fechaNacimiento || !genero}
                        className="w-full flex items-center justify-center gap-2 py-4 font-bold text-black bg-[#02D7E5] hover:bg-[#02D7E5]/90 rounded-xl transition-all disabled:opacity-50 mt-6 shadow-[0_0_20px_rgba(2,215,229,0.2)]"
                      >
                        Continuar <ArrowRight className="w-5 h-5" />
                      </button>
                    </form>
                  )}

                  {/* NUEVO - Paso 4: Contraseña y Términos */}
                  {onboardingStep === 4 && (
                    <form onSubmit={handleFinalSubmit} className="space-y-5 w-full animate-in slide-in-from-right-4 fade-in duration-300">
                      <div className="space-y-2">
                        <label className="block text-sm font-bold text-zinc-300">Crea tu Contraseña</label>
                        <input
                          required
                          type="password"
                          value={password}
                          onChange={e => setPassword(e.target.value)}
                          disabled={loading}
                          placeholder="Mínimo 8 caracteres"
                          className="w-full p-4 bg-zinc-900 border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-[#02D7E5] focus:border-[#02D7E5] transition-all text-base font-medium disabled:opacity-50"
                          autoFocus
                        />

                        {/* Validador visual de requisitos en tiempo real */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 text-xs">
                          <div className={`flex items-center gap-2 transition-colors duration-200 ${hasMinLength ? 'text-[#02D7E5] font-semibold' : 'text-zinc-500'}`}>
                            <div className={`w-4 h-4 rounded-full flex items-center justify-center transition-all duration-200 ${hasMinLength ? 'bg-[#02D7E5]/20 text-[#02D7E5]' : 'border border-zinc-700 text-transparent'}`}>
                              <Check className="w-2.5 h-2.5 stroke-[3]" />
                            </div>
                            <span>Mínimo 8 caracteres</span>
                          </div>

                          <div className={`flex items-center gap-2 transition-colors duration-200 ${hasUppercase ? 'text-[#02D7E5] font-semibold' : 'text-zinc-500'}`}>
                            <div className={`w-4 h-4 rounded-full flex items-center justify-center transition-all duration-200 ${hasUppercase ? 'bg-[#02D7E5]/20 text-[#02D7E5]' : 'border border-zinc-700 text-transparent'}`}>
                              <Check className="w-2.5 h-2.5 stroke-[3]" />
                            </div>
                            <span>Al menos una mayúscula</span>
                          </div>

                          <div className={`flex items-center gap-2 transition-colors duration-200 ${hasNumber ? 'text-[#02D7E5] font-semibold' : 'text-zinc-500'}`}>
                            <div className={`w-4 h-4 rounded-full flex items-center justify-center transition-all duration-200 ${hasNumber ? 'bg-[#02D7E5]/20 text-[#02D7E5]' : 'border border-zinc-700 text-transparent'}`}>
                              <Check className="w-2.5 h-2.5 stroke-[3]" />
                            </div>
                            <span>Al menos un número</span>
                          </div>

                          <div className={`flex items-center gap-2 transition-colors duration-200 ${hasSpecialChar ? 'text-[#02D7E5] font-semibold' : 'text-zinc-500'}`}>
                            <div className={`w-4 h-4 rounded-full flex items-center justify-center transition-all duration-200 ${hasSpecialChar ? 'bg-[#02D7E5]/20 text-[#02D7E5]' : 'border border-zinc-700 text-transparent'}`}>
                              <Check className="w-2.5 h-2.5 stroke-[3]" />
                            </div>
                            <span>Un símbolo o especial</span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="block text-sm font-bold text-zinc-300">Confirmar Contraseña</label>
                        <input
                          required
                          type="password"
                          value={confirmPassword}
                          onChange={e => setConfirmPassword(e.target.value)}
                          disabled={loading}
                          placeholder="Repite tu contraseña"
                          className="w-full p-4 bg-zinc-900 border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-[#02D7E5] focus:border-[#02D7E5] transition-all text-base font-medium disabled:opacity-50"
                        />
                        {confirmPassword.length > 0 && (
                          <div className="pt-1 text-xs">
                            {password === confirmPassword ? (
                              <p className="text-[#02D7E5] font-semibold flex items-center gap-1.5">
                                <Check className="w-3.5 h-3.5 stroke-[3]" /> Las contraseñas coinciden
                              </p>
                            ) : (
                              <p className="text-red-400 font-medium">
                                Las contraseñas no coinciden
                              </p>
                            )}
                          </div>
                        )}
                      </div>

                      <label className="flex items-start gap-3 cursor-pointer pt-2">
                        <input
                          required
                          type="checkbox"
                          checked={aceptoTerminos}
                          onChange={e => setAceptoTerminos(e.target.checked)}
                          disabled={loading}
                          className="mt-1 w-4 h-4 rounded border-zinc-800 bg-zinc-900 text-[#02D7E5] focus:ring-[#02D7E5]"
                        />
                        <span className="text-xs text-zinc-400 leading-normal">
                          Acepto los <span className="text-[#02D7E5] font-semibold">Términos y Condiciones</span> y la <span className="text-[#02D7E5] font-semibold">Política de Privacidad</span> de Fitness Factory.
                        </span>
                      </label>

                      {errorVisual && (
                        <p className="text-red-400 text-sm font-medium text-center">{errorVisual}</p>
                      )}

                      <button
                        type="submit"
                        disabled={loading || !isPasswordValid || password !== confirmPassword || !aceptoTerminos}
                        className="w-full flex items-center justify-center gap-2 py-4 font-bold text-black bg-[#02D7E5] hover:bg-[#02D7E5]/90 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(2,215,229,0.2)] mt-4"
                      >
                        {loading ? (
                          <><Loader2 className="w-5 h-5 animate-spin" /> Creando Cuenta...</>
                        ) : 'Crear Cuenta y Entrar'}
                      </button>
                    </form>
                  )}

                </div>
              )}

              {/* Caso ESCALONADO: Salto Directo a Paso 4 con Banner de Recepción */}
              {onboardingState === 'ESCALONADO' && (
                <form onSubmit={handleFinalSubmit} className="space-y-5 w-full animate-in slide-in-from-right-4 fade-in duration-300">
                  <div className="p-4 rounded-xl bg-[#02D7E5]/10 border border-[#02D7E5]/30">
                    <p className="text-sm font-medium text-[#02D7E5] leading-relaxed">
                      ¡Hola{preUserData?.nombre_completo ? ` ${preUserData.nombre_completo.split(' ')[0]}` : ''}! Vemos que ya te pre-registraste en recepción.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-bold text-zinc-300">Nueva Contraseña</label>
                    <input
                      required
                      type="password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      disabled={loading}
                      placeholder="Mínimo 8 caracteres"
                      className="w-full p-4 bg-zinc-900 border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-[#02D7E5] focus:border-[#02D7E5] transition-all text-base font-medium disabled:opacity-50"
                      autoFocus
                    />

                    {/* Validador visual de requisitos en tiempo real */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 text-xs">
                      <div className={`flex items-center gap-2 transition-colors duration-200 ${hasMinLength ? 'text-[#02D7E5] font-semibold' : 'text-zinc-500'}`}>
                        <div className={`w-4 h-4 rounded-full flex items-center justify-center transition-all duration-200 ${hasMinLength ? 'bg-[#02D7E5]/20 text-[#02D7E5]' : 'border border-zinc-700 text-transparent'}`}>
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                        </div>
                        <span>Mínimo 8 caracteres</span>
                      </div>

                      <div className={`flex items-center gap-2 transition-colors duration-200 ${hasUppercase ? 'text-[#02D7E5] font-semibold' : 'text-zinc-500'}`}>
                        <div className={`w-4 h-4 rounded-full flex items-center justify-center transition-all duration-200 ${hasUppercase ? 'bg-[#02D7E5]/20 text-[#02D7E5]' : 'border border-zinc-700 text-transparent'}`}>
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                        </div>
                        <span>Al menos una mayúscula</span>
                      </div>

                      <div className={`flex items-center gap-2 transition-colors duration-200 ${hasNumber ? 'text-[#02D7E5] font-semibold' : 'text-zinc-500'}`}>
                        <div className={`w-4 h-4 rounded-full flex items-center justify-center transition-all duration-200 ${hasNumber ? 'bg-[#02D7E5]/20 text-[#02D7E5]' : 'border border-zinc-700 text-transparent'}`}>
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                        </div>
                        <span>Al menos un número</span>
                      </div>

                      <div className={`flex items-center gap-2 transition-colors duration-200 ${hasSpecialChar ? 'text-[#02D7E5] font-semibold' : 'text-zinc-500'}`}>
                        <div className={`w-4 h-4 rounded-full flex items-center justify-center transition-all duration-200 ${hasSpecialChar ? 'bg-[#02D7E5]/20 text-[#02D7E5]' : 'border border-zinc-700 text-transparent'}`}>
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                        </div>
                        <span>Un símbolo o especial</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-bold text-zinc-300">Confirmar Contraseña</label>
                    <input
                      required
                      type="password"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      disabled={loading}
                      placeholder="Repite tu contraseña"
                      className="w-full p-4 bg-zinc-900 border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-[#02D7E5] focus:border-[#02D7E5] transition-all text-base font-medium disabled:opacity-50"
                    />
                    {confirmPassword.length > 0 && (
                      <div className="pt-1 text-xs">
                        {password === confirmPassword ? (
                          <p className="text-[#02D7E5] font-semibold flex items-center gap-1.5">
                            <Check className="w-3.5 h-3.5 stroke-[3]" /> Las contraseñas coinciden
                          </p>
                        ) : (
                          <p className="text-red-400 font-medium">
                            Las contraseñas no coinciden
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  <label className="flex items-start gap-3 cursor-pointer pt-2">
                    <input
                      required
                      type="checkbox"
                      checked={aceptoTerminos}
                      onChange={e => setAceptoTerminos(e.target.checked)}
                      disabled={loading}
                      className="mt-1 w-4 h-4 rounded border-zinc-800 bg-zinc-900 text-[#02D7E5] focus:ring-[#02D7E5]"
                    />
                    <span className="text-xs text-zinc-400 leading-normal">
                      Acepto los <span className="text-[#02D7E5] font-semibold">Términos y Condiciones</span> y la <span className="text-[#02D7E5] font-semibold">Política de Privacidad</span> de Fitness Factory.
                    </span>
                  </label>

                  {errorVisual && (
                    <p className="text-red-400 text-sm font-medium text-center">{errorVisual}</p>
                  )}

                  <button
                    type="submit"
                    disabled={loading || !isPasswordValid || password !== confirmPassword || !aceptoTerminos}
                    className="w-full flex items-center justify-center gap-2 py-4 font-bold text-black bg-[#02D7E5] hover:bg-[#02D7E5]/90 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(2,215,229,0.2)] mt-4"
                  >
                    {loading ? (
                      <><Loader2 className="w-5 h-5 animate-spin" /> Activando Cuenta...</>
                    ) : 'Activar Cuenta y Entrar'}
                  </button>
                </form>
              )}

            </div>
          )}

        </div>
      </div>
    </div>
  )
}
