'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  User,
  Mail,
  Phone,
  Calendar,
  Lock,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldCheck,
  Users,
  Trophy,
  Flame,
  Sparkles,
  Zap
} from 'lucide-react'
import toast from 'react-hot-toast'
import { createClient } from '@/src/utils/supabase/client'
import {
  obtenerCategoriasSimulacionActiva,
  evaluarDisponibilidadRegistro,
  registrarAtletaAutonomo
} from './actions'
import { enviarOtp, validarOtp } from '@/app/auth/actions'
import { Categoria, Simulacion } from '@/src/types'

export default function RegistroAutonomoWizard() {
  const router = useRouter()
  const supabase = createClient()

  // Steps: 1 = Datos Personales, Credenciales & OTP; 2 = Categoría; 3 = Compañero (si Dupla)
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [loading, setLoading] = useState(false)
  const [globalError, setGlobalError] = useState<string | null>(null)

  // Simulation & Categories State
  const [simulacion, setSimulacion] = useState<Simulacion | null>(null)
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [loadingCategorias, setLoadingCategorias] = useState(true)

  // Step 1: Datos Personales
  const [tipoDoc, setTipoDoc] = useState('V')
  const [numeroDoc, setNumeroDoc] = useState('')
  const [nombres, setNombres] = useState('')
  const [email, setEmail] = useState('')
  const [countryCode, setCountryCode] = useState('+58')
  const [phoneRaw, setPhoneRaw] = useState('')
  const [fechaNacimiento, setFechaNacimiento] = useState('')
  const [tallaFranela, setTallaFranela] = useState<'S' | 'M' | 'L' | 'XL' | 'XXL' | ''>('')
  
  // Step 1: Credenciales
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // Step 1: OTP
  const [otpSent, setOtpSent] = useState(false)
  const [otpVerified, setOtpVerified] = useState(false)
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', ''])
  const [timer, setTimer] = useState(60)
  const [isSendingOtp, setIsSendingOtp] = useState(false)
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false)
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([])

  // Step 2: Categoría
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState<Categoria | null>(null)

  // Step 3: Compañero (Sólo si es Dupla)
  const [compEmail, setCompEmail] = useState('')
  const [compNombre, setCompNombre] = useState('')
  const [compCountryCode, setCompCountryCode] = useState('+58')
  const [compPhoneRaw, setCompPhoneRaw] = useState('')
  const [compGenero, setCompGenero] = useState<'masculino' | 'femenino' | ''>('')

  // Cargar simulación activa y categorías al montar el componente
  useEffect(() => {
    async function loadData() {
      setLoadingCategorias(true)
      const res = await obtenerCategoriasSimulacionActiva()
      if (res.success) {
        setSimulacion(res.simulacion)
        setCategorias(res.categorias)
      } else {
        setGlobalError(res.error || 'No se pudo cargar la información de la competición activa.')
      }
      setLoadingCategorias(false)
    }
    loadData()
  }, [])

  // Timer regresivo para OTP
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
  const passwordsMatch = password === confirmPassword && password.length > 0
  const isPasswordReady = hasMinLength && hasUppercase && hasNumber && hasSpecial && passwordsMatch

  // Handlers para OTP
  const handleEnviarOtp = async () => {
    if (phoneRaw.length < 7) {
      return toast.error('Ingresa un número telefónico válido de al menos 7 dígitos')
    }

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
        setTimeout(() => otpInputRefs.current[0]?.focus(), 100)
      } else {
        toast.error(res.error || 'No se pudo despachar el código OTP.')
      }
    } catch {
      toast.error('Error enviando código de verificación.')
    } finally {
      setIsSendingOtp(false)
    }
  }

  const handleOtpChange = (index: number, val: string) => {
    const digit = val.slice(-1)
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
      return toast.error('Ingresa el código de 6 dígitos')
    }

    const fullPhone = `${countryCode}${phoneRaw.replace(/\D/g, '')}`
    setIsVerifyingOtp(true)

    try {
      const res = await validarOtp(fullPhone, code)
      if (res.success) {
        setOtpVerified(true)
        toast.success('¡Teléfono verificado por WhatsApp!')
      } else {
        toast.error(res.error || 'Código OTP incorrecto o expirado.')
      }
    } catch {
      toast.error('Error validando el código OTP.')
    } finally {
      setIsVerifyingOtp(false)
    }
  }

  // Handlers para Navegación de Steps
  const handleAvanzarPaso1 = async (e: React.FormEvent) => {
    e.preventDefault()
    setGlobalError(null)

    if (numeroDoc.length < 6) {
      return toast.error('Ingresa un número de cédula válido')
    }
    if (!nombres.trim()) {
      return toast.error('Ingresa tus nombres completos')
    }
    if (!email.trim() || !email.includes('@')) {
      return toast.error('Ingresa un correo electrónico válido')
    }
    if (!fechaNacimiento) {
      return toast.error('Ingresa tu fecha de nacimiento')
    }
    if (!tallaFranela) {
      return toast.error('Selecciona tu talla de franela')
    }
    if (!isPasswordReady) {
      return toast.error('La contraseña no cumple con los requisitos de seguridad')
    }
    if (!otpVerified) {
      return toast.error('Debes validar tu teléfono mediante el código OTP de WhatsApp')
    }

    // Verificar disponibilidad en backend (cédula y email libres + cupo disponible)
    setLoading(true)
    const fullCedula = `${tipoDoc}${numeroDoc.trim()}`
    try {
      const check = await evaluarDisponibilidadRegistro({
        cedula: fullCedula,
        email: email.trim()
      })

      if (!check.success) {
        setGlobalError(check.error || 'No se puede continuar con el registro.')
        toast.error(check.error || 'Error de disponibilidad.')
        setLoading(false)
        return
      }

      setStep(2)
    } catch {
      setGlobalError('Error de conexión verificando disponibilidad.')
    } finally {
      setLoading(false)
    }
  }

  const handleSeleccionarCategoria = (cat: Categoria) => {
    setCategoriaSeleccionada(cat)
  }

  const handleContinuarDesdePaso2 = () => {
    if (!categoriaSeleccionada) {
      return toast.error('Por favor selecciona una categoría de competición')
    }

    if (categoriaSeleccionada.tipo === 'dupla') {
      setStep(3)
    } else {
      // Si es Individual, completamos el registro directamente
      ejecutarRegistroFinal()
    }
  }

  const handleFinalizarPaso3 = (e: React.FormEvent) => {
    e.preventDefault()
    setGlobalError(null)

    if (!compEmail.trim() || !compEmail.includes('@')) {
      return toast.error('Ingresa un correo válido para tu compañero')
    }
    if (compEmail.trim().toLowerCase() === email.trim().toLowerCase()) {
      return toast.error('El correo del compañero no puede ser igual al tuyo')
    }
    if (!compNombre.trim()) {
      return toast.error('Ingresa el nombre completo de tu compañero')
    }
    if (compPhoneRaw.length < 7) {
      return toast.error('Ingresa un teléfono válido para tu compañero')
    }
    if (!compGenero) {
      return toast.error('Selecciona el género de tu compañero')
    }

    ejecutarRegistroFinal()
  }

  const ejecutarRegistroFinal = async () => {
    if (!categoriaSeleccionada || !simulacion) {
      return toast.error('Faltan datos de la competición o categoría')
    }

    setLoading(true)
    setGlobalError(null)

    const fullCedula = `${tipoDoc}${numeroDoc.trim()}`
    const fullPhone = `${countryCode}${phoneRaw.replace(/\D/g, '')}`

    const payload: any = {
      cedula: fullCedula,
      nombres: nombres.trim(),
      email: email.trim().toLowerCase(),
      telefono: fullPhone,
      tallaFranela,
      fechaNacimiento,
      password,
      simulacionId: simulacion.id,
      categoriaId: categoriaSeleccionada.id
    }

    if (categoriaSeleccionada.tipo === 'dupla') {
      const compFullPhone = `${compCountryCode}${compPhoneRaw.replace(/\D/g, '')}`
      payload.companero = {
        email: compEmail.trim().toLowerCase(),
        nombre: compNombre.trim(),
        telefono: compFullPhone,
        genero: compGenero
      }
    }

    try {
      const res = await registrarAtletaAutonomo(payload)

      if (res.success) {
        if (res.duplaInscritaSilenciosa) {
          toast.success('¡Registro exitoso! Tu compañero fue vinculado automáticamente a la dupla.', { duration: 4000 })
        } else if (categoriaSeleccionada.tipo === 'dupla') {
          toast.success('¡Registro exitoso! Tu compañero ha sido preinscrito para activar su cuenta.', { duration: 4000 })
        } else {
          toast.success('¡Inscripción exitosa! Bienvenido a Hyrox.', { duration: 3000 })
        }

        // Auto-login con las credenciales creadas
        const { error: loginErr } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password
        })

        if (!loginErr) {
          router.push('/dashboard')
        } else {
          router.push('/login')
        }
      } else {
        setGlobalError(res.error || 'Error al completar el registro.')
        toast.error(res.error || 'Error en el registro.')
      }
    } catch {
      setGlobalError('Error de conexión al procesar la inscripción.')
      toast.error('Error de red.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-black text-white flex flex-col justify-between p-4 md:p-8 relative overflow-hidden">
      {/* Background Texture & Glow */}
      <div
        className="absolute inset-0 opacity-15 pointer-events-none bg-cover bg-center"
        style={{ backgroundImage: `url('/images/LOGO TEXTURA01.png')` }}
      />
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#02D7E5]/10 rounded-full blur-[128px] pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-[128px] pointer-events-none" />

      {/* Header */}
      <header className="relative z-10 max-w-2xl mx-auto w-full flex items-center justify-between pb-6 border-b border-white/10">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-xl font-bold tracking-tight text-white">
            HYROX <span className="text-[#02D7E5]">FACTORY</span>
          </span>
        </Link>
        <span className="px-3 py-1 rounded-full bg-[#02D7E5]/10 border border-[#02D7E5]/30 text-[#02D7E5] font-bold text-[10px] uppercase tracking-widest flex items-center gap-1.5">
          <Flame className="w-3 h-3 text-[#02D7E5]" />
          Inscripción Oficial
        </span>
      </header>

      {/* Wizard Container */}
      <div className="relative z-10 max-w-xl mx-auto w-full my-auto py-8">
        {/* Stepper Indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-between relative">
            <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-zinc-800 -translate-y-1/2 z-0" />
            <div
              className="absolute top-1/2 left-0 h-0.5 bg-[#02D7E5] -translate-y-1/2 transition-all duration-500 z-0"
              style={{
                width: step === 1 ? '0%' : step === 2 ? (categoriaSeleccionada?.tipo === 'dupla' ? '50%' : '100%') : '100%'
              }}
            />

            {[
              { num: 1, label: 'Perfil & OTP' },
              { num: 2, label: 'Categoría' },
              { num: 3, label: 'Dupla', conditional: categoriaSeleccionada?.tipo === 'dupla' }
            ]
              .filter(s => s.conditional !== false || step === 3)
              .map(s => {
                const isActive = step === s.num
                const isDone = step > s.num
                return (
                  <div key={s.num} className="relative z-10 flex flex-col items-center">
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs transition-all duration-300 ${
                        isDone
                          ? 'bg-[#02D7E5] text-black shadow-lg shadow-[#02D7E5]/30'
                          : isActive
                          ? 'bg-zinc-950 border-2 border-[#02D7E5] text-[#02D7E5] shadow-lg shadow-[#02D7E5]/20'
                          : 'bg-zinc-900 border border-zinc-700 text-zinc-500'
                      }`}
                    >
                      {isDone ? <CheckCircle2 className="w-4 h-4" /> : s.num}
                    </div>
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider mt-1.5 ${
                        isActive || isDone ? 'text-white' : 'text-zinc-600'
                      }`}
                    >
                      {s.label}
                    </span>
                  </div>
                )
              })}
          </div>
        </div>

        {/* Global Error Banner */}
        {globalError && (
          <div className="mb-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-start gap-3 animate-in fade-in">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div className="text-xs text-red-200 leading-relaxed font-medium">
              {globalError}
            </div>
          </div>
        )}

        <AnimatePresence mode="wait">
          {/* ========================================================================= */}
          {/* PASO 1: DATOS PERSONALES, CREDENCIALES & OTP                               */}
          {/* ========================================================================= */}
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
              className="rounded-3xl bg-zinc-950/85 backdrop-blur-xl border border-white/10 p-6 md:p-8 shadow-2xl space-y-6"
            >
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-[#02D7E5] uppercase tracking-widest">
                  Paso 1 de {categoriaSeleccionada?.tipo === 'dupla' ? '3' : '2'}
                </span>
                <h1 className="text-2xl font-bold text-white tracking-tight">
                  Registro de Atleta Hyrox
                </h1>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Completa tus datos personales y valida tu WhatsApp para recibir tu asignación de heat y tiempos de carrera.
                </p>
              </div>

              <form onSubmit={handleAvanzarPaso1} className="space-y-4">
                {/* Cédula y Nombres */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-300 block">
                      Cédula / Identidad
                    </label>
                    <div className="flex gap-2">
                      <select
                        value={tipoDoc}
                        onChange={e => setTipoDoc(e.target.value)}
                        className="px-2.5 py-3 bg-zinc-900 border border-white/10 rounded-2xl text-xs font-bold text-white focus:outline-none focus:border-[#02D7E5]"
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
                        className="flex-1 px-3.5 py-3 bg-zinc-900/90 border border-white/10 rounded-2xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#02D7E5]"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-300 block">
                      Nombres Completos
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ej. Roberto Gómez"
                      value={nombres}
                      onChange={e => setNombres(e.target.value)}
                      className="w-full px-4 py-3 bg-zinc-900/90 border border-white/10 rounded-2xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#02D7E5]"
                    />
                  </div>
                </div>

                {/* Email Obligatorio */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-300 block">
                    Correo Electrónico (Obligatorio)
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-zinc-500 absolute left-4 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      placeholder="atleta@ejemplo.com"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 bg-zinc-900/90 border border-white/10 rounded-2xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#02D7E5]"
                    />
                  </div>
                </div>

                {/* Fecha de Nacimiento y Talla */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-300 block">
                      Fecha de Nacimiento
                    </label>
                    <div className="relative">
                      <Calendar className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="date"
                        required
                        value={fechaNacimiento}
                        onChange={e => setFechaNacimiento(e.target.value)}
                        className="block w-full max-w-full min-w-0 box-border pl-10 pr-3 py-3 bg-zinc-900/90 border border-white/10 rounded-2xl text-xs text-white focus:outline-none focus:border-[#02D7E5] [color-scheme:dark] appearance-none [-webkit-appearance:none]"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-300 block">
                      Talla Franela
                    </label>
                    <div className="grid grid-cols-5 gap-1.5">
                      {(['S', 'M', 'L', 'XL', 'XXL'] as const).map(t => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setTallaFranela(t)}
                          className={`py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
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
                </div>

                {/* Bloque de Teléfono y Validación OTP */}
                <div className="p-4 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase text-zinc-300 flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-[#02D7E5]" />
                      <span>Teléfono WhatsApp</span>
                    </span>
                    {otpVerified && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/25">
                        <CheckCircle2 className="w-3 h-3" />
                        WhatsApp Verificado
                      </span>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <select
                      value={countryCode}
                      onChange={e => setCountryCode(e.target.value)}
                      disabled={otpVerified}
                      className="px-3 py-2.5 bg-zinc-950 border border-white/10 rounded-xl text-xs font-bold text-white focus:outline-none"
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
                      disabled={otpVerified}
                      placeholder="4121234567"
                      value={phoneRaw}
                      onChange={e => setPhoneRaw(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      className="flex-1 px-4 py-2.5 bg-zinc-950 border border-white/10 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#02D7E5]"
                    />
                  </div>

                  {!otpVerified && (
                    <div>
                      {!otpSent ? (
                        <button
                          type="button"
                          onClick={handleEnviarOtp}
                          disabled={isSendingOtp || phoneRaw.length < 7}
                          className="w-full py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                        >
                          {isSendingOtp ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>Enviando código...</span>
                            </>
                          ) : (
                            <span>Validar Número con Código OTP</span>
                          )}
                        </button>
                      ) : (
                        <div className="space-y-3 pt-2">
                          <p className="text-[11px] text-zinc-400">
                            Ingresa el código numérico de 6 dígitos enviado por WhatsApp:
                          </p>

                          <div className="flex justify-between gap-1.5">
                            {otpDigits.map((digit, i) => (
                              <input
                                key={i}
                                ref={el => { otpInputRefs.current[i] = el }}
                                type="text"
                                inputMode="numeric"
                                maxLength={1}
                                value={digit}
                                onChange={e => handleOtpChange(i, e.target.value)}
                                onKeyDown={e => handleOtpKeyDown(i, e)}
                                className="w-10 h-12 text-center text-lg font-bold bg-zinc-950 border border-white/15 rounded-xl text-white focus:outline-none focus:border-[#02D7E5]"
                              />
                            ))}
                          </div>

                          <div className="flex items-center justify-between text-[11px] pt-1">
                            <span className="text-zinc-500">
                              {timer > 0 ? `Reenviar en ${timer}s` : '¿No recibiste el código?'}
                            </span>
                            {timer === 0 && (
                              <button
                                type="button"
                                onClick={handleEnviarOtp}
                                className="text-[#02D7E5] font-bold hover:underline cursor-pointer"
                              >
                                Reenviar Código
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Credenciales de Acceso */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-300 block">
                      Contraseña
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="password"
                        required
                        placeholder="••••••••"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        className="w-full pl-10 pr-3 py-3 bg-zinc-900/90 border border-white/10 rounded-2xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#02D7E5]"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-300 block">
                      Confirmar Contraseña
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="password"
                        required
                        placeholder="••••••••"
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        className="w-full pl-10 pr-3 py-3 bg-zinc-900/90 border border-white/10 rounded-2xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#02D7E5]"
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || !otpVerified || !isPasswordReady}
                  className="w-full py-4 rounded-2xl bg-[#02D7E5] hover:bg-[#02D7E5]/90 text-black font-extrabold text-sm shadow-xl shadow-[#02D7E5]/25 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-4"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-black" />
                      <span>Verificando Datos...</span>
                    </>
                  ) : (
                    <>
                      <span>Continuar a Selección de Categoría</span>
                      <ArrowRight className="w-4 h-4 text-black" />
                    </>
                  )}
                </button>
              </form>

              <div className="pt-1 text-center">
                <p className="text-xs text-zinc-500">
                  ¿Ya tienes una cuenta o recibiste una invitación?{' '}
                  <Link href="/activacion" className="text-[#02D7E5] font-bold hover:underline">
                    Activa tu cupo aquí
                  </Link>
                </p>
              </div>
            </motion.div>
          )}

          {/* ========================================================================= */}
          {/* PASO 2: SELECCIÓN DE CATEGORÍA                                              */}
          {/* ========================================================================= */}
          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
              className="rounded-3xl bg-zinc-950/85 backdrop-blur-xl border border-white/10 p-6 md:p-8 shadow-2xl space-y-6"
            >
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-[#02D7E5] uppercase tracking-widest">
                  Paso 2 de {categoriaSeleccionada?.tipo === 'dupla' ? '3' : '2'}
                </span>
                <h1 className="text-2xl font-bold text-white tracking-tight">
                  Selecciona tu Categoría
                </h1>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Competición activa: <strong className="text-white">{simulacion?.nombre || 'Hyrox Official Event'}</strong>. Elige la modalidad en la que vas a competir.
                </p>
              </div>

              {loadingCategorias ? (
                <div className="py-12 flex flex-col items-center justify-center gap-3 text-zinc-500">
                  <Loader2 className="w-6 h-6 animate-spin text-[#02D7E5]" />
                  <span className="text-xs font-semibold">Cargando categorías oficiales...</span>
                </div>
              ) : categorias.length === 0 ? (
                <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs text-center font-semibold">
                  No hay categorías configuradas para esta simulación. Contacta al administrador.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {categorias.map(cat => {
                    const isSelected = categoriaSeleccionada?.id === cat.id
                    const isDupla = cat.tipo === 'dupla'

                    return (
                      <div
                        key={cat.id}
                        onClick={() => handleSeleccionarCategoria(cat)}
                        className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between space-y-3 ${
                          isSelected
                            ? 'bg-[#02D7E5]/15 border-[#02D7E5] shadow-lg shadow-[#02D7E5]/15 scale-[1.01]'
                            : 'bg-zinc-900/60 hover:bg-zinc-900 border-white/10 hover:border-white/20'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider ${
                              isDupla
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                : 'bg-[#02D7E5]/20 text-[#02D7E5] border border-[#02D7E5]/40'
                            }`}
                          >
                            {isDupla ? 'Dupla' : 'Individual'}
                          </span>

                          <div
                            className={`w-5 h-5 rounded-full flex items-center justify-center border ${
                              isSelected
                                ? 'bg-[#02D7E5] border-[#02D7E5] text-black'
                                : 'border-zinc-700'
                            }`}
                          >
                            {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-black" />}
                          </div>
                        </div>

                        <div>
                          <h3 className="text-sm font-bold text-white tracking-tight">
                            {cat.nombre}
                          </h3>
                          <p className="text-[11px] text-zinc-400 mt-0.5">
                            {isDupla
                              ? 'Competirás en equipo de 2 atletas (compartirán equipo_id).'
                              : 'Registro individual con clasificación propia.'}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              <div className="flex items-center gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-4 py-3.5 rounded-2xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-bold text-xs transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={handleContinuarDesdePaso2}
                  disabled={loading || !categoriaSeleccionada}
                  className="flex-1 py-4 rounded-2xl bg-[#02D7E5] hover:bg-[#02D7E5]/90 text-black font-extrabold text-sm shadow-xl shadow-[#02D7E5]/25 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-black" />
                      <span>Registrando Atleta...</span>
                    </>
                  ) : categoriaSeleccionada?.tipo === 'dupla' ? (
                    <>
                      <span>Continuar a Datos de Compañero</span>
                      <ArrowRight className="w-4 h-4 text-black" />
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4 text-black" />
                      <span>Completar Inscripción Individual</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}

          {/* ========================================================================= */}
          {/* PASO 3: FORMULARIO OBLIGATORIO DE COMPAÑERO (DUPLAS)                       */}
          {/* ========================================================================= */}
          {step === 3 && categoriaSeleccionada && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
              className="rounded-3xl bg-zinc-950/85 backdrop-blur-xl border border-white/10 p-6 md:p-8 shadow-2xl space-y-6"
            >
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest">
                  Paso 3 de 3 — Modalidad Dupla
                </span>
                <h1 className="text-2xl font-bold text-white tracking-tight">
                  Datos de tu Compañero de Dupla
                </h1>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Has seleccionado <strong>{categoriaSeleccionada.nombre}</strong>. Si tu compañero ya tiene cuenta se vinculará a tu equipo; de lo contrario se le enviará su preinscripción.
                </p>
              </div>

              <form onSubmit={handleFinalizarPaso3} className="space-y-4">
                {/* Email del Compañero */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-300 block">
                    Correo del Compañero (Obligatorio)
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-zinc-500 absolute left-4 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      placeholder="companero@ejemplo.com"
                      value={compEmail}
                      onChange={e => setCompEmail(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 bg-zinc-900/90 border border-white/10 rounded-2xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#02D7E5]"
                    />
                  </div>
                </div>

                {/* Nombre Completo del Compañero */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-300 block">
                    Nombre Completo del Compañero
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-zinc-500 absolute left-4 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      placeholder="Ej. Carlos Mendoza"
                      value={compNombre}
                      onChange={e => setCompNombre(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 bg-zinc-900/90 border border-white/10 rounded-2xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#02D7E5]"
                    />
                  </div>
                </div>

                {/* Teléfono y Género del Compañero */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-300 block">
                      Teléfono del Compañero
                    </label>
                    <div className="flex gap-2">
                      <select
                        value={compCountryCode}
                        onChange={e => setCompCountryCode(e.target.value)}
                        className="px-2.5 py-3 bg-zinc-900 border border-white/10 rounded-2xl text-xs font-bold text-white focus:outline-none"
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
                        value={compPhoneRaw}
                        onChange={e => setCompPhoneRaw(e.target.value.replace(/\D/g, '').slice(0, 10))}
                        className="flex-1 px-3.5 py-3 bg-zinc-900/90 border border-white/10 rounded-2xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#02D7E5]"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-300 block">
                      Género del Compañero
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setCompGenero('masculino')}
                        className={`py-3 rounded-2xl text-xs font-bold border transition-all cursor-pointer ${
                          compGenero === 'masculino'
                            ? 'bg-[#02D7E5] text-black border-[#02D7E5]'
                            : 'bg-zinc-900 text-zinc-400 hover:text-white border-white/10'
                        }`}
                      >
                        Masculino
                      </button>
                      <button
                        type="button"
                        onClick={() => setCompGenero('femenino')}
                        className={`py-3 rounded-2xl text-xs font-bold border transition-all cursor-pointer ${
                          compGenero === 'femenino'
                            ? 'bg-[#02D7E5] text-black border-[#02D7E5]'
                            : 'bg-zinc-900 text-zinc-400 hover:text-white border-white/10'
                        }`}
                      >
                        Femenino
                      </button>
                    </div>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300 leading-relaxed">
                  <strong>Regla de Duplas:</strong> Cada atleta solo puede pertenecer a un equipo por competición. El sistema validará que tu compañero no esté ya inscrito en otra dupla.
                </div>

                <div className="flex items-center gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    disabled={loading}
                    className="px-4 py-3.5 rounded-2xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-bold text-xs transition-colors cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>

                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-4 rounded-2xl bg-gradient-to-r from-amber-500 to-[#02D7E5] hover:from-amber-400 hover:to-[#02D7E5]/90 text-black font-extrabold text-sm shadow-xl shadow-[#02D7E5]/25 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-black" />
                        <span>Validando Dupla e Inscribiendo...</span>
                      </>
                    ) : (
                      <>
                        <Users className="w-4 h-4 text-black" />
                        <span>Finalizar Inscripción de Dupla</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <footer className="relative z-10 max-w-2xl mx-auto w-full pt-6 text-center text-xs text-zinc-600 border-t border-white/5">
        Hyrox Fitness Factory © {new Date().getFullYear()} — Plataforma Oficial de Competición
      </footer>
    </main>
  )
}
