'use client'

import React, { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Mail,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Lock,
  Phone,
  Calendar,
  Users,
  Sparkles,
  ShieldCheck,
  Check,
  Eye,
  EyeOff
} from 'lucide-react'
import toast from 'react-hot-toast'
import { createClient } from '@/src/utils/supabase/client'
import { verificarPreinscripcion, completarActivacion } from './actions'
import { enviarOtp, validarOtp } from '@/app/auth/actions'
import { Preinscripcion, Categoria, Simulacion } from '@/src/types'

const LOCAL_STORAGE_KEY = 'hyrox_activacion_cache_v2'

function ActivacionContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  // Steps: 1 = Email, 2 = Perfil & OTP, 3 = Contraseña
  const [step, setStep] = useState<1 | 2 | 3>(1)
  
  // Micropasos de Paso 2: 1 = Cédula & Talla, 2 = Teléfono & Fecha, 3 = OTP
  const [subStep2, setSubStep2] = useState<1 | 2 | 3>(1)

  // Micropasos de Paso 3: 1 = Nueva contraseña, 2 = Confirmar contraseña & checklist
  const [subStep3, setSubStep3] = useState<1 | 2>(1)

  const [loading, setLoading] = useState(false)
  const [globalError, setGlobalError] = useState<string | null>(null)

  // Step 1: Email
  const [email, setEmail] = useState('')
  const [preinscripcion, setPreinscripcion] = useState<Preinscripcion | null>(null)
  const [categoria, setCategoria] = useState<Categoria | null>(null)
  const [simulacion, setSimulacion] = useState<Simulacion | null>(null)

  // Step 2.1: Cédula & Talla
  const [tipoDoc, setTipoDoc] = useState('V')
  const [numeroDoc, setNumeroDoc] = useState('')
  const [tallaFranela, setTallaFranela] = useState<'S' | 'M' | 'L' | 'XL' | 'XXL' | ''>('')

  // Step 2.2: Teléfono & Fecha de Nacimiento
  const [countryCode, setCountryCode] = useState('+58')
  const [phoneRaw, setPhoneRaw] = useState('')
  const [fechaNacimiento, setFechaNacimiento] = useState('')

  // Step 2.3: OTP
  const [otpSent, setOtpSent] = useState(false)
  const [otpVerified, setOtpVerified] = useState(false)
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', ''])
  const [timer, setTimer] = useState(60)
  const [isSendingOtp, setIsSendingOtp] = useState(false)
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false)
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([])

  // Step 3: Password
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  // 1. Resiliencia: Hidratación desde localStorage al montar
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY)
      if (raw) {
        const cached = JSON.parse(raw)
        if (cached.step) setStep(cached.step)
        if (cached.subStep2) setSubStep2(cached.subStep2)
        if (cached.subStep3) setSubStep3(cached.subStep3)
        if (cached.email) setEmail(cached.email)
        if (cached.preinscripcion) setPreinscripcion(cached.preinscripcion)
        if (cached.categoria) setCategoria(cached.categoria)
        if (cached.simulacion) setSimulacion(cached.simulacion)
        if (cached.tipoDoc) setTipoDoc(cached.tipoDoc)
        if (cached.numeroDoc) setNumeroDoc(cached.numeroDoc)
        if (cached.tallaFranela) setTallaFranela(cached.tallaFranela)
        if (cached.countryCode) setCountryCode(cached.countryCode)
        if (cached.phoneRaw) setPhoneRaw(cached.phoneRaw)
        if (cached.fechaNacimiento) setFechaNacimiento(cached.fechaNacimiento)
        if (cached.otpSent) setOtpSent(cached.otpSent)
        if (cached.otpVerified) setOtpVerified(cached.otpVerified)
      }
    } catch (e) {
      console.warn('No se pudo hidratar el caché de activación:', e)
    }

    const queryEmail = searchParams.get('email')
    if (queryEmail && !email) {
      setEmail(queryEmail)
    }
  }, [searchParams])

  // 2. Resiliencia: Guardado automático en localStorage en cada cambio
  useEffect(() => {
    try {
      const payload = {
        step,
        subStep2,
        subStep3,
        email,
        preinscripcion,
        categoria,
        simulacion,
        tipoDoc,
        numeroDoc,
        tallaFranela,
        countryCode,
        phoneRaw,
        fechaNacimiento,
        otpSent,
        otpVerified
      }
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(payload))
    } catch (e) {
      // Ignorar quota exceeded
    }
  }, [
    step,
    subStep2,
    subStep3,
    email,
    preinscripcion,
    categoria,
    simulacion,
    tipoDoc,
    numeroDoc,
    tallaFranela,
    countryCode,
    phoneRaw,
    fechaNacimiento,
    otpSent,
    otpVerified
  ])

  // Countdown Timer para OTP
  useEffect(() => {
    let interval: NodeJS.Timeout
    if (otpSent && timer > 0) {
      interval = setInterval(() => setTimer(t => t - 1), 1000)
    }
    return () => clearInterval(interval)
  }, [otpSent, timer])

  // Validaciones de Contraseña
  const hasMinLength = password.length >= 8
  const hasUppercase = /[A-Z]/.test(password)
  const hasNumber = /[0-9]/.test(password)
  const hasSpecial = /[^A-Za-z0-9]/.test(password)
  const isPasswordValid = hasMinLength && hasUppercase && hasNumber && hasSpecial
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0
  const isPasswordReady = isPasswordValid && passwordsMatch

  // Handlers - Paso 1 (Email)
  const handleConsultarEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    setGlobalError(null)

    if (!email || !email.includes('@')) {
      return toast.error('Ingresa un correo electrónico válido')
    }

    setLoading(true)
    try {
      const res = await verificarPreinscripcion(email)
      if (res.success && res.preinscripcion) {
        setPreinscripcion(res.preinscripcion)
        setCategoria(res.categoria || null)
        setSimulacion(res.simulacion || null)
        setStep(2)
        setSubStep2(1)
        toast.success(`¡Hola ${res.preinscripcion.nombres}!`)
      } else {
        setGlobalError(res.error || 'Tu correo no figura en la lista de preinscritos o ya fue reclamado.')
        toast.error(res.error || 'Error al verificar preinscripción.')
      }
    } catch {
      setGlobalError('Error de red al consultar el servidor.')
      toast.error('Error de red.')
    } finally {
      setLoading(false)
    }
  }

  // Handlers - Micropaso 2.1 (Cédula & Talla)
  const handleAvanzar2_1 = (e: React.FormEvent) => {
    e.preventDefault()
    if (numeroDoc.trim().length < 6) {
      return toast.error('Ingresa un número de cédula válido')
    }
    if (!tallaFranela) {
      return toast.error('Selecciona tu talla de franela')
    }
    setSubStep2(2)
  }

  // Handlers - Micropaso 2.2 (Teléfono & Fecha)
  const handleAvanzar2_2 = (e: React.FormEvent) => {
    e.preventDefault()
    if (phoneRaw.replace(/\D/g, '').length < 7) {
      return toast.error('Ingresa un teléfono válido de al menos 7 dígitos')
    }
    if (!fechaNacimiento) {
      return toast.error('Ingresa tu fecha de nacimiento')
    }
    setSubStep2(3)
    // Si aún no se ha enviado el OTP, enviarlo de una vez al entrar a 2.3
    if (!otpSent && !otpVerified) {
      enviarCodigoWhatsApp()
    }
  }

  // Handlers - Micropaso 2.3 (OTP)
  const enviarCodigoWhatsApp = async () => {
    const fullPhone = `${countryCode}${phoneRaw.replace(/\D/g, '')}`
    setIsSendingOtp(true)
    setGlobalError(null)

    try {
      const res = await enviarOtp(fullPhone)
      if (res.success) {
        setOtpSent(true)
        setTimer(60)
        setOtpDigits(['', '', '', '', '', ''])
        toast.success('Código OTP enviado por WhatsApp.')
        setTimeout(() => otpInputRefs.current[0]?.focus(), 80)
      } else {
        toast.error(res.error || 'No se pudo enviar el código OTP.')
      }
    } catch {
      toast.error('Error enviando código de verificación.')
    } finally {
      setIsSendingOtp(false)
    }
  }

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const pastedData = e.clipboardData.getData('text').trim().replace(/\D/g, '')
    if (!pastedData) return

    const digits = pastedData.slice(0, 6).split('')
    const newOtp = [...otpDigits]

    digits.forEach((digit, idx) => {
      if (idx < 6) {
        newOtp[idx] = digit
      }
    })

    setOtpDigits(newOtp)

    // Enfocar el último input rellenado o el índice 5
    const targetIndex = Math.min(digits.length, 6) - 1
    if (targetIndex >= 0) {
      otpInputRefs.current[targetIndex]?.focus()
    }

    if (digits.length >= 6) {
      handleVerificarOtp(digits.slice(0, 6).join(''))
    }
  }

  const handleOtpChange = (index: number, val: string) => {
    const clean = val.replace(/\D/g, '')
    // Si el teclado del móvil o autocompletado inserta varios dígitos de golpe
    if (clean.length > 1) {
      const digits = clean.slice(0, 6).split('')
      const newOtp = [...otpDigits]
      digits.forEach((d, idx) => {
        if (idx < 6) newOtp[idx] = d
      })
      setOtpDigits(newOtp)
      const targetIndex = Math.min(digits.length, 6) - 1
      if (targetIndex >= 0) {
        otpInputRefs.current[targetIndex]?.focus()
      }
      if (digits.length >= 6) {
        handleVerificarOtp(digits.slice(0, 6).join(''))
      }
      return
    }

    const digit = clean.slice(-1)
    const newOtp = [...otpDigits]
    newOtp[index] = digit
    setOtpDigits(newOtp)

    if (digit && index < 5) {
      otpInputRefs.current[index + 1]?.focus()
    }

    if (digit && index === 5 && newOtp.every(d => d !== '')) {
      handleVerificarOtp(newOtp.join(''))
    }
  }

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus()
    }
  }

  const handleVerificarOtp = async (codigoCompleto?: string) => {
    const code = codigoCompleto || otpDigits.join('')
    if (code.length !== 6) {
      return toast.error('Ingresa los 6 dígitos del código')
    }

    const fullPhone = `${countryCode}${phoneRaw.replace(/\D/g, '')}`
    setIsVerifyingOtp(true)

    try {
      const res = await validarOtp(fullPhone, code)
      if (res.success) {
        setOtpVerified(true)
        toast.success('¡Teléfono verificado!')
        // Transición directa a Paso 3
        setTimeout(() => {
          setStep(3)
          setSubStep3(1)
        }, 300)
      } else {
        toast.error(res.error || 'Código OTP incorrecto o expirado.')
      }
    } catch {
      toast.error('Error validando el código OTP.')
    } finally {
      setIsVerifyingOtp(false)
    }
  }

  // Handlers - Micropaso 3.1 (Contraseña)
  const handleAvanzar3_1 = (e: React.FormEvent) => {
    e.preventDefault()
    if (!isPasswordValid) {
      return toast.error('La contraseña debe cumplir con los requisitos mínimos de seguridad')
    }
    setSubStep3(2)
  }

  // Handlers - Micropaso 3.2 (Finalizar)
  const handleFinalizarActivacion = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isPasswordReady) {
      return toast.error('Las contraseñas no coinciden o no cumplen con los requisitos.')
    }
    if (!preinscripcion) return

    setLoading(true)
    setGlobalError(null)

    const fullCedula = `${tipoDoc}${numeroDoc.trim()}`
    const fullPhone = `${countryCode}${phoneRaw.replace(/\D/g, '')}`

    try {
      const res = await completarActivacion({
        preinscripcionId: preinscripcion.id,
        email: preinscripcion.email,
        nombres: preinscripcion.nombres,
        cedula: fullCedula,
        telefono: fullPhone,
        fechaNacimiento,
        tallaFranela,
        password
      })

      if (res.success) {
        // Limpiar caché local
        localStorage.removeItem(LOCAL_STORAGE_KEY)
        toast.success('¡Activación exitosa! Entrando a tu panel...')

        const { error: loginErr } = await supabase.auth.signInWithPassword({
          email: preinscripcion.email,
          password
        })

        if (!loginErr) {
          router.push('/dashboard')
        } else {
          router.push('/login')
        }
      } else {
        setGlobalError(res.error || 'Error al completar la activación.')
        toast.error(res.error || 'Error en la activación.')
      }
    } catch {
      setGlobalError('Error de red al procesar la activación.')
      toast.error('Error de conexión.')
    } finally {
      setLoading(false)
    }
  }

  // Cálculo de progreso SVG para el círculo del Paso 2
  // Circumference para r=14 es 2 * PI * 14 = 87.96
  const circleRadius = 14
  const circumference = 2 * Math.PI * circleRadius
  const step2Progress = otpVerified
    ? 1
    : step === 2
    ? subStep2 === 1
      ? 0.33
      : subStep2 === 2
      ? 0.66
      : 0.9
    : 0
  const strokeDashoffset = circumference * (1 - step2Progress)

  return (
    <main className="min-h-[100dvh] bg-black text-white flex flex-col justify-start md:justify-center px-4 md:px-6 pt-12 sm:pt-14 md:pt-8 pb-20 md:pb-8 relative overflow-hidden">
      {/* Glow ambiental */}
      <div className="absolute top-0 right-1/4 w-80 h-80 bg-[#02D7E5]/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute top-1/3 left-1/4 w-80 h-80 bg-amber-500/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Logo Fitness Factory Fondo: pequeño, abajo centrado, opacidad muy baja */}
      <div
        className="absolute bottom-4 left-1/2 -translate-x-1/2 w-24 h-24 opacity-10 pointer-events-none bg-contain bg-no-repeat bg-center"
        style={{ backgroundImage: `url('/images/LOGO TEXTURA01.png')` }}
      />

      {/* Contenedor Principal (Ubicado en la mitad superior para no tapar el teclado) */}
      <div className="relative z-10 max-w-sm mx-auto w-full">
        {/* Stepper Centrado y Alineado */}
        <div className="w-full flex items-center justify-between relative mb-5 px-3">
          {/* Línea de fondo */}
          <div className="absolute top-1/2 left-8 right-8 h-0.5 bg-zinc-800 -translate-y-1/2 z-0" />
          
          {/* Línea de progreso dinámica */}
          <div
            className="absolute top-1/2 left-8 h-0.5 bg-[#02D7E5] -translate-y-1/2 transition-all duration-300 z-0"
            style={{
              width:
                step === 1
                  ? '0%'
                  : step === 2
                  ? `${Math.round(step2Progress * 50)}%`
                  : 'calc(100% - 4rem)'
            }}
          />

          {/* Círculo 1: Email */}
          <div className="relative z-10 flex flex-col items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-all ${
                step > 1
                  ? 'bg-[#02D7E5] text-black shadow-md shadow-[#02D7E5]/30'
                  : 'bg-zinc-950 border-2 border-[#02D7E5] text-[#02D7E5]'
              }`}
            >
              {step > 1 ? <Check className="w-4 h-4 stroke-[3]" /> : '1'}
            </div>
            <span className={`text-[10px] font-bold uppercase tracking-wider mt-1 ${step >= 1 ? 'text-white' : 'text-zinc-600'}`}>
              Email
            </span>
          </div>

          {/* Círculo 2: Perfil & OTP (Llenado Fraccional) */}
          <div className="relative z-10 flex flex-col items-center">
            <div className="relative w-8 h-8 flex items-center justify-center">
              {/* SVG Ring con stroke-dasharray para progreso fraccional */}
              <svg className="w-8 h-8 transform -rotate-90" viewBox="0 0 32 32">
                <circle
                  cx="16"
                  cy="16"
                  r={circleRadius}
                  stroke="#27272a"
                  strokeWidth="2.5"
                  fill="transparent"
                />
                <circle
                  cx="16"
                  cy="16"
                  r={circleRadius}
                  stroke="#02D7E5"
                  strokeWidth="2.5"
                  fill="transparent"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  className="transition-all duration-300"
                />
              </svg>

              <div
                className={`absolute inset-0 flex items-center justify-center font-bold text-xs rounded-full ${
                  otpVerified
                    ? 'bg-[#02D7E5] text-black'
                    : step === 2
                    ? 'text-[#02D7E5]'
                    : 'text-zinc-500'
                }`}
              >
                {otpVerified ? (
                  <Check className="w-4 h-4 stroke-[3]" />
                ) : step === 2 ? (
                  `2.${subStep2}`
                ) : (
                  '2'
                )}
              </div>
            </div>
            <span className={`text-[10px] font-bold uppercase tracking-wider mt-1 ${step >= 2 ? 'text-white' : 'text-zinc-600'}`}>
              Perfil
            </span>
          </div>

          {/* Círculo 3: Contraseña */}
          <div className="relative z-10 flex flex-col items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-all ${
                step === 3 && isPasswordReady
                  ? 'bg-emerald-400 text-black shadow-md shadow-emerald-400/30'
                  : step === 3
                  ? 'bg-zinc-950 border-2 border-[#02D7E5] text-[#02D7E5]'
                  : 'bg-zinc-900 border border-zinc-700 text-zinc-500'
              }`}
            >
              {step === 3 ? `3.${subStep3}` : '3'}
            </div>
            <span className={`text-[10px] font-bold uppercase tracking-wider mt-1 ${step === 3 ? 'text-white' : 'text-zinc-600'}`}>
              Clave
            </span>
          </div>
        </div>

        {/* Global Error Banner */}
        {globalError && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div className="text-xs text-red-200 leading-snug font-medium">
              {globalError}
            </div>
          </div>
        )}

        <AnimatePresence mode="wait">
          {/* ========================================================================= */}
          {/* PASO 1: VERIFICAR EMAIL                                                   */}
          {/* ========================================================================= */}
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="rounded-3xl bg-zinc-950/90 border border-white/10 p-5 shadow-2xl space-y-4"
            >
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-[#02D7E5] uppercase tracking-widest">
                  Activación
                </span>
                <h1 className="text-xl font-bold text-white tracking-tight">
                  Activa tu Cupo
                </h1>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Ingresa el correo con el que fuiste convocado o registrado.
                </p>
              </div>

              <form onSubmit={handleConsultarEmail} className="space-y-3 pt-1">
                <div className="relative">
                  <Mail className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="email"
                    required
                    autoFocus
                    placeholder="correo@ejemplo.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full pl-10 pr-3 py-3 bg-zinc-900 border border-white/10 rounded-2xl text-[16px] text-white placeholder-zinc-500 focus:outline-none focus:border-[#02D7E5]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 rounded-2xl bg-[#02D7E5] hover:bg-[#02D7E5]/90 text-black font-extrabold text-sm shadow-lg shadow-[#02D7E5]/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-black" />
                  ) : (
                    <>
                      <span>Continuar</span>
                      <ArrowRight className="w-4 h-4 text-black" />
                    </>
                  )}
                </button>
              </form>
            </motion.div>
          )}

          {/* ========================================================================= */}
          {/* PASO 2.1: CÉDULA & TALLA                                                   */}
          {/* ========================================================================= */}
          {step === 2 && subStep2 === 1 && preinscripcion && (
            <motion.div
              key="step2_1"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="rounded-3xl bg-zinc-950/90 border border-white/10 p-5 shadow-2xl space-y-4"
            >
              {/* Resumen Superior */}
              <div className="p-3 rounded-2xl bg-zinc-900/80 border border-white/10 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-[#02D7E5] uppercase">Atleta</span>
                  <h2 className="text-sm font-bold text-white truncate max-w-[170px]">
                    {preinscripcion.nombres}
                  </h2>
                </div>
                <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold bg-[#02D7E5]/15 text-[#02D7E5] border border-[#02D7E5]/30">
                  {categoria?.nombre || 'Categoría'}
                </span>
              </div>

              {preinscripcion.partner_nombres && (
                <div className="px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300 flex items-center gap-1.5 font-medium">
                  <Users className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>Compañero: <strong>{preinscripcion.partner_nombres}</strong></span>
                </div>
              )}

              <form onSubmit={handleAvanzar2_1} className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">
                    Cédula de Identidad
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={tipoDoc}
                      onChange={e => setTipoDoc(e.target.value)}
                      className="px-3 py-2.5 bg-zinc-900 border border-white/10 rounded-2xl text-[16px] font-bold text-white focus:outline-none"
                    >
                      <option value="V">V</option>
                      <option value="E">E</option>
                      <option value="J">J</option>
                      <option value="P">P</option>
                    </select>
                    <input
                      type="text"
                      required
                      placeholder="12345678"
                      value={numeroDoc}
                      onChange={e => setNumeroDoc(e.target.value.replace(/\D/g, '').slice(0, 9))}
                      className="flex-1 px-3 py-2.5 bg-zinc-900 border border-white/10 rounded-2xl text-[16px] text-white placeholder-zinc-500 focus:outline-none focus:border-[#02D7E5]"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">
                    Talla de Franela
                  </label>
                  <div className="grid grid-cols-5 gap-1.5">
                    {(['S', 'M', 'L', 'XL', 'XXL'] as const).map(t => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setTallaFranela(t)}
                        className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          tallaFranela === t
                            ? 'bg-[#02D7E5] text-black shadow-md shadow-[#02D7E5]/20'
                            : 'bg-zinc-900 text-zinc-400 hover:text-white border border-white/10'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="p-3 rounded-2xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>

                  <button
                    type="submit"
                    className="flex-1 py-3.5 rounded-2xl bg-[#02D7E5] hover:bg-[#02D7E5]/90 text-black font-extrabold text-sm shadow-lg shadow-[#02D7E5]/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Continuar</span>
                    <ArrowRight className="w-4 h-4 text-black" />
                  </button>
                </div>
              </form>
            </motion.div>
          )}

          {/* ========================================================================= */}
          {/* PASO 2.2: TELÉFONO & FECHA DE NACIMIENTO                                  */}
          {/* ========================================================================= */}
          {step === 2 && subStep2 === 2 && (
            <motion.div
              key="step2_2"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-full rounded-3xl bg-zinc-950/90 border border-white/10 p-5 shadow-2xl space-y-4 box-border overflow-hidden min-w-0"
            >
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-[#02D7E5] uppercase tracking-widest">
                  Paso 2.2 de 3
                </span>
                <h1 className="text-xl font-bold text-white tracking-tight">
                  Contacto y Nacimiento
                </h1>
                <p className="text-xs text-zinc-400">
                  Valida tu número de WhatsApp para recibir notificaciones de pista.
                </p>
              </div>

              <form onSubmit={handleAvanzar2_2} className="w-full max-w-full space-y-3 pt-1 box-border min-w-0">
                <div className="space-y-1 w-full max-w-full min-w-0 box-border">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">
                    WhatsApp
                  </label>
                  <div className="flex gap-2 w-full max-w-full min-w-0 box-border">
                    <select
                      value={countryCode}
                      onChange={e => setCountryCode(e.target.value)}
                      className="shrink-0 px-2.5 py-2.5 bg-zinc-900 border border-white/10 rounded-2xl text-[16px] font-bold text-white focus:outline-none"
                    >
                      <option value="+58">+58</option>
                      <option value="+1">+1</option>
                      <option value="+34">+34</option>
                      <option value="+57">+57</option>
                      <option value="+56">+56</option>
                    </select>
                    <input
                      type="tel"
                      required
                      placeholder="4121234567"
                      value={phoneRaw}
                      onChange={e => setPhoneRaw(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      className="flex-1 min-w-0 w-full px-3 py-2.5 bg-zinc-900 border border-white/10 rounded-2xl text-[16px] text-white placeholder-zinc-500 focus:outline-none focus:border-[#02D7E5] box-border"
                    />
                  </div>
                </div>

                <div className="space-y-1 w-full max-w-full min-w-0 box-border">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">
                    Fecha de Nacimiento
                  </label>
                  <div className="relative w-full max-w-full min-w-0 box-border">
                    <Calendar className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none z-10" />
                    <input
                      type="date"
                      required
                      value={fechaNacimiento}
                      onChange={e => setFechaNacimiento(e.target.value)}
                      className="block w-full max-w-full min-w-0 box-border pl-10 pr-3 py-2.5 min-h-[46px] bg-zinc-900 border border-white/10 rounded-2xl text-[16px] text-white focus:outline-none focus:border-[#02D7E5] [color-scheme:dark] appearance-none [-webkit-appearance:none] text-left [&::-webkit-date-and-time-value]:text-left [&::-webkit-date-and-time-value]:min-h-[1.5em]"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setSubStep2(1)}
                    className="p-3 rounded-2xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>

                  <button
                    type="submit"
                    className="flex-1 py-3.5 rounded-2xl bg-[#02D7E5] hover:bg-[#02D7E5]/90 text-black font-extrabold text-sm shadow-lg shadow-[#02D7E5]/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Continuar</span>
                    <ArrowRight className="w-4 h-4 text-black" />
                  </button>
                </div>
              </form>
            </motion.div>
          )}

          {/* ========================================================================= */}
          {/* PASO 2.3: VALIDAR OTP WHATSAPP                                            */}
          {/* ========================================================================= */}
          {step === 2 && subStep2 === 3 && (
            <motion.div
              key="step2_3"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="rounded-3xl bg-zinc-950/90 border border-white/10 p-5 shadow-2xl space-y-4"
            >
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-[#02D7E5] uppercase tracking-widest">
                  Paso 2.3 de 3
                </span>
                <h1 className="text-xl font-bold text-white tracking-tight">
                  Código WhatsApp
                </h1>
                <p className="text-xs text-zinc-400">
                  Enviado a <strong className="text-zinc-200">{countryCode}{phoneRaw}</strong>
                </p>
              </div>

              <div className="space-y-4 pt-1">
                <div className="flex justify-between gap-1.5 w-full max-w-full box-border">
                  {otpDigits.map((digit, i) => (
                    <input
                      key={i}
                      ref={el => { otpInputRefs.current[i] = el }}
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={1}
                      value={digit}
                      onChange={e => handleOtpChange(i, e.target.value)}
                      onKeyDown={e => handleOtpKeyDown(i, e)}
                      onPaste={handleOtpPaste}
                      className="w-10 h-12 text-center text-[16px] font-bold bg-zinc-900 border border-white/15 rounded-xl text-white focus:outline-none focus:border-[#02D7E5]"
                    />
                  ))}
                </div>

                <div className="flex items-center justify-between text-xs px-1">
                  <span className="text-zinc-500">
                    {timer > 0 ? `Reenviar en ${timer}s` : '¿No llegó?'}
                  </span>
                  {timer === 0 && (
                    <button
                      type="button"
                      onClick={enviarCodigoWhatsApp}
                      disabled={isSendingOtp}
                      className="text-[#02D7E5] font-bold hover:underline cursor-pointer"
                    >
                      Reenviar
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setSubStep2(2)}
                    className="p-3 rounded-2xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleVerificarOtp()}
                    disabled={isVerifyingOtp}
                    className="flex-1 py-3.5 rounded-2xl bg-[#02D7E5] hover:bg-[#02D7E5]/90 text-black font-extrabold text-sm shadow-lg shadow-[#02D7E5]/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isVerifyingOtp ? (
                      <Loader2 className="w-4 h-4 animate-spin text-black" />
                    ) : (
                      <span>Validar</span>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* ========================================================================= */}
          {/* PASO 3.1: INTRODUCIR CONTRASEÑA NUEVA                                     */}
          {/* ========================================================================= */}
          {step === 3 && subStep3 === 1 && (
            <motion.div
              key="step3_1"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="rounded-3xl bg-zinc-950/90 border border-white/10 p-5 shadow-2xl space-y-4"
            >
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-[#02D7E5] uppercase tracking-widest">
                  Paso 3.1 de 3
                </span>
                <h1 className="text-xl font-bold text-white tracking-tight">
                  Crea tu Contraseña
                </h1>
                <p className="text-xs text-zinc-400">
                  Define la clave para acceder a tu panel de atleta.
                </p>
              </div>

              <form onSubmit={handleAvanzar3_1} className="space-y-3 pt-1">
                <div className="relative flex items-center">
                  <Lock className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoFocus
                    placeholder="Contraseña"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full pl-10 pr-11 py-3 bg-zinc-900 border border-white/10 rounded-2xl text-[16px] text-white placeholder-zinc-500 focus:outline-none focus:border-[#02D7E5]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(prev => !prev)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white transition-colors p-1 rounded-lg focus:outline-none cursor-pointer"
                    title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4 text-zinc-400" />
                    ) : (
                      <Eye className="w-4 h-4 text-zinc-400" />
                    )}
                  </button>
                </div>

                {/* Micro Checklist inline */}
                <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-1 text-[11px]">
                  <div className={`flex items-center gap-1.5 ${hasMinLength ? 'text-emerald-400 font-semibold' : 'text-zinc-500'}`}>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Mínimo 8 caracteres</span>
                  </div>
                  <div className={`flex items-center gap-1.5 ${hasUppercase && hasNumber && hasSpecial ? 'text-emerald-400 font-semibold' : 'text-zinc-500'}`}>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Mayúscula, número y símbolo</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setStep(2)
                      setSubStep2(3)
                    }}
                    className="p-3 rounded-2xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>

                  <button
                    type="submit"
                    disabled={!isPasswordValid}
                    className="flex-1 py-3.5 rounded-2xl bg-[#02D7E5] hover:bg-[#02D7E5]/90 text-black font-extrabold text-sm shadow-lg shadow-[#02D7E5]/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <span>Continuar</span>
                    <ArrowRight className="w-4 h-4 text-black" />
                  </button>
                </div>
              </form>
            </motion.div>
          )}

          {/* ========================================================================= */}
          {/* PASO 3.2: CONFIRMAR CONTRASEÑA & FINALIZAR                                */}
          {/* ========================================================================= */}
          {step === 3 && subStep3 === 2 && (
            <motion.div
              key="step3_2"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="rounded-3xl bg-zinc-950/90 border border-white/10 p-5 shadow-2xl space-y-4"
            >
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">
                  Paso Final
                </span>
                <h1 className="text-xl font-bold text-white tracking-tight">
                  Confirma tu Clave
                </h1>
                <p className="text-xs text-zinc-400">
                  Repite tu contraseña para activar tu cuenta.
                </p>
              </div>

              <form onSubmit={handleFinalizarActivacion} className="space-y-3 pt-1">
                <div className="relative flex items-center">
                  <Lock className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    autoFocus
                    placeholder="Repetir contraseña"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    className="w-full pl-10 pr-11 py-3 bg-zinc-900 border border-white/10 rounded-2xl text-[16px] text-white placeholder-zinc-500 focus:outline-none focus:border-[#02D7E5]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(prev => !prev)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white transition-colors p-1 rounded-lg focus:outline-none cursor-pointer"
                    title={showConfirmPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="w-4 h-4 text-zinc-400" />
                    ) : (
                      <Eye className="w-4 h-4 text-zinc-400" />
                    )}
                  </button>
                </div>

                <div className={`p-2.5 rounded-xl text-xs flex items-center gap-2 border ${
                  passwordsMatch
                    ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-500'
                }`}>
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span className="font-semibold">
                    {passwordsMatch ? 'Las contraseñas coinciden' : 'Deben coincidir ambas contraseñas'}
                  </span>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setSubStep3(1)}
                    disabled={loading}
                    className="p-3 rounded-2xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>

                  <button
                    type="submit"
                    disabled={loading || !isPasswordReady}
                    className="flex-1 py-3.5 rounded-2xl bg-[#02D7E5] hover:bg-[#02D7E5]/90 text-black font-extrabold text-sm shadow-lg shadow-[#02D7E5]/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin text-black" />
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4 text-black" />
                        <span>Finalizar</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  )
}

export default function ActivacionPage() {
  return (
    <Suspense fallback={
      <div className="min-h-[100dvh] bg-black flex items-center justify-center text-[#02D7E5]">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    }>
      <ActivacionContent />
    </Suspense>
  )
}
