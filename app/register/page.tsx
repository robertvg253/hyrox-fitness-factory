'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, ArrowLeft } from 'lucide-react'
import { createClient } from '@/src/utils/supabase/client'
import { motion, AnimatePresence } from 'framer-motion'

const registerSchema = z.object({
  email: z.string().email('Ingresa un correo electrónico válido'),
  cedula: z.string().min(4, 'La cédula/RIF es obligatoria'),
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Formato E.164 (Ej. +584121234567)'),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
  confirmPassword: z.string().min(8, 'La confirmación es obligatoria'),
  otp: z.string().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Las contraseñas no coinciden",
  path: ["confirmPassword"],
})

type RegisterFormValues = z.infer<typeof registerSchema>

export default function RegisterMultiStepPage() {
  const router = useRouter()
  const supabase = createClient()
  
  const [step, setStep] = useState(1)
  const [globalError, setGlobalError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const {
    register,
    trigger,
    getValues,
    setValue,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    mode: 'onChange',
  })

  // Estados locales para los inputs compuestos
  const [docType, setDocType] = useState('V')
  const [docNumber, setDocNumber] = useState('')
  const [countryCode, setCountryCode] = useState('+58')
  const [phoneNumber, setPhoneNumber] = useState('')

  // Estados para OTP de 6 cuadros
  const [otpValues, setOtpValues] = useState(['', '', '', '', '', ''])
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  const handleDocTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setDocType(e.target.value)
    setValue('cedula', `${e.target.value}${docNumber}`, { shouldValidate: true })
  }

  const handleDocNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const num = e.target.value.replace(/\D/g, '')
    setDocNumber(num)
    setValue('cedula', `${docType}${num}`, { shouldValidate: true })
  }

  const handleCountryCodeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setCountryCode(e.target.value)
    const rawNum = phoneNumber.replace(/\D/g, '')
    setValue('phone', `${e.target.value}${rawNum}`, { shouldValidate: true })
  }

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '')
    
    if (val.startsWith('0')) {
      val = val.substring(1)
    }

    if (val.length > 10) {
      val = val.substring(0, 10)
    }

    let formatted = val
    if (val.length > 6) {
      formatted = `${val.substring(0, 3)}-${val.substring(3, 6)}-${val.substring(6)}`
    } else if (val.length > 3) {
      formatted = `${val.substring(0, 3)}-${val.substring(3)}`
    }

    setPhoneNumber(formatted)
    setValue('phone', `${countryCode}${val}`, { shouldValidate: true })
  }

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return // Solo números

    const newOtp = [...otpValues]
    // Tomar solo el último carácter en caso de que escriban rápido
    newOtp[index] = value.slice(-1)
    setOtpValues(newOtp)

    // Saltar al siguiente
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }
    
    setValue('otp', newOtp.join(''), { shouldValidate: true })
  }

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpValues[index] && index > 0) {
      // Si está vacío y presiona borrar, saltar al anterior
      inputRefs.current[index - 1]?.focus()
    } else if (e.key === 'Enter' && otpValues.join('').length === 6) {
      handleVerifyOtp()
    }
  }

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const pasteData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    
    if (pasteData) {
      const newOtp = [...otpValues]
      for (let i = 0; i < pasteData.length; i++) {
        newOtp[i] = pasteData[i]
      }
      setOtpValues(newOtp)
      setValue('otp', newOtp.join(''), { shouldValidate: true })
      
      // Focus al último input lleno o al final
      const focusIndex = pasteData.length < 6 ? pasteData.length : 5
      inputRefs.current[focusIndex]?.focus()
    }
  }

  // Avanzar de paso validando campos específicos
  const handleNext = async () => {
    setGlobalError(null)
    let isValid = false

    if (step === 1) isValid = await trigger('email')
    if (step === 2) isValid = await trigger('cedula')
    if (step === 3) isValid = await trigger('phone')
    if (step === 4) {
      isValid = await trigger(['password', 'confirmPassword'])
      if (isValid) {
        await handleSignUp()
        return // signUp cambia el paso internamente si es exitoso
      }
    }

    if (isValid && step < 4) {
      setStep((prev) => prev + 1)
    }
  }

  const handleBack = () => {
    if (step > 1 && step < 5) {
      setStep((prev) => prev - 1)
      setGlobalError(null)
    } else if (step === 1) {
      router.push('/login')
    }
  }

  const handleSignUp = async () => {
    setIsLoading(true)
    try {
      const data = getValues()
      const { error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            cedula: data.cedula,
            phone: data.phone,
          }
        }
      })

      if (error) throw error

      // Registro exitoso, pasar a OTP
      setStep(5)
    } catch (error: any) {
      setGlobalError(error.message || 'Hubo un problema al crear tu cuenta.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleVerifyOtp = async () => {
    setIsLoading(true)
    setGlobalError(null)
    try {
      const data = getValues()
      const { error } = await supabase.auth.verifyOtp({
        email: data.email,
        token: data.otp || '',
        type: 'signup'
      })

      if (error) throw error

      // Verificación exitosa, ir al dashboard
      router.push('/dashboard')
    } catch (error: any) {
      setGlobalError('Código inválido o expirado. Intenta de nuevo.')
    } finally {
      setIsLoading(false)
    }
  }

  // Variantes para animación framer-motion
  const slideVariants = {
    hidden: { x: 50, opacity: 0 },
    visible: { x: 0, opacity: 1, transition: { duration: 0.3 } },
    exit: { x: -50, opacity: 0, transition: { duration: 0.2 } }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black p-4 sm:p-6 text-white overflow-hidden">
      <div className="w-full max-w-md bg-zinc-950/80 rounded-3xl border border-zinc-900 shadow-2xl overflow-hidden relative min-h-[550px] flex flex-col">
        
        {/* Cabecera y Barra de Progreso */}
        <div className="p-6 pb-4 relative z-10 flex flex-col items-center border-b border-zinc-900/50">
          {step < 5 && (
            <button onClick={handleBack} className="absolute left-6 top-8 text-zinc-400 hover:text-white transition-colors">
              <ArrowLeft className="w-6 h-6" />
            </button>
          )}
          <Image
            src="/images/LOGO TEXTURA01.png"
            alt="Logo"
            width={120}
            height={40}
            className="h-auto w-[120px] object-contain mb-4"
            priority
          />
          
          {step < 5 && (
            <div className="w-full mt-4">
              <div className="flex justify-between text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">
                <span>Paso {step}</span>
                <span>4 Pasos</span>
              </div>
              <div className="w-full h-1 bg-zinc-900 rounded-full overflow-hidden">
                <motion.div 
                  className="h-full bg-brand-primary"
                  initial={{ width: `${((step - 1) / 4) * 100}%` }}
                  animate={{ width: `${(step / 4) * 100}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Contenido Dinámico con AnimatePresence */}
        <div className="flex-1 p-6 flex flex-col justify-between relative">
          
          <div>
            {globalError && (
              <div className="mb-6 p-3 text-sm font-medium text-red-400 bg-red-950/20 border border-red-900/50 rounded-xl text-center">
                {globalError}
              </div>
            )}

            <AnimatePresence mode="wait">
              {step === 1 && (
                <motion.div key="step1" variants={slideVariants} initial="hidden" animate="visible" exit="exit" className="flex flex-col justify-center space-y-4 pt-4">
                  <h3 className="text-2xl font-bold tracking-tight text-white text-center mb-4">¿Cuál es tu correo?</h3>
                  <input
                    type="email"
                    className="w-full p-4 bg-black border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-brand-primary focus:border-brand-primary transition-all text-center text-lg"
                    placeholder="tu@email.com"
                    {...register('email')}
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && handleNext()}
                  />
                  {errors.email && <p className="text-xs text-red-400 text-center">{errors.email.message}</p>}
                </motion.div>
              )}

              {step === 2 && (
                <motion.div key="step2" variants={slideVariants} initial="hidden" animate="visible" exit="exit" className="flex flex-col justify-center space-y-4 pt-4">
                  <h3 className="text-2xl font-bold tracking-tight text-white text-center mb-4">Identificación</h3>
                  <div className="flex bg-black border border-zinc-800 rounded-xl overflow-hidden focus-within:ring-1 focus-within:ring-brand-primary focus-within:border-brand-primary transition-all">
                    <select
                      value={docType}
                      onChange={handleDocTypeChange}
                      className="bg-zinc-900 text-white p-4 outline-none border-r border-zinc-800 text-lg font-medium cursor-pointer"
                    >
                      <option value="V">V</option>
                      <option value="E">E</option>
                      <option value="J">J</option>
                      <option value="G">G</option>
                      <option value="P">P</option>
                    </select>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={docNumber}
                      onChange={handleDocNumberChange}
                      className="w-full p-4 bg-transparent text-white placeholder-zinc-600 focus:outline-none text-center text-lg tracking-widest"
                      placeholder="12345678"
                      autoFocus
                      onKeyDown={(e) => e.key === 'Enter' && handleNext()}
                    />
                  </div>
                  {errors.cedula && <p className="text-xs text-red-400 text-center">{errors.cedula.message}</p>}
                  <p className="text-xs text-zinc-500 text-center mt-2">Selecciona el tipo y escribe tu número de documento.</p>
                </motion.div>
              )}

              {step === 3 && (
                <motion.div key="step3" variants={slideVariants} initial="hidden" animate="visible" exit="exit" className="flex flex-col justify-center space-y-4 pt-4">
                  <h3 className="text-2xl font-bold tracking-tight text-white text-center mb-4">Número de Contacto</h3>
                  <div className="flex bg-black border border-zinc-800 rounded-xl overflow-hidden focus-within:ring-1 focus-within:ring-brand-primary focus-within:border-brand-primary transition-all">
                    <select
                      value={countryCode}
                      onChange={handleCountryCodeChange}
                      className="bg-zinc-900 text-white px-2 py-4 outline-none border-r border-zinc-800 text-lg font-medium cursor-pointer"
                    >
                      <option value="+58">🇻🇪 +58</option>
                      <option value="+1">🇺🇸 +1</option>
                      <option value="+57">🇨🇴 +57</option>
                      <option value="">Otro</option>
                    </select>
                    <input
                      type="tel"
                      value={phoneNumber}
                      onChange={handlePhoneChange}
                      className="w-full p-4 bg-transparent text-white placeholder-zinc-600 focus:outline-none text-center text-lg tracking-widest"
                      placeholder="412-123-4567"
                      autoFocus
                      onKeyDown={(e) => e.key === 'Enter' && handleNext()}
                    />
                  </div>
                  {errors.phone && <p className="text-xs text-red-400 text-center">{errors.phone.message}</p>}
                  <p className="text-xs text-zinc-500 text-center mt-2">Omite el 0 inicial si lo tiene.</p>
                </motion.div>
              )}

              {step === 4 && (
                <motion.div key="step4" variants={slideVariants} initial="hidden" animate="visible" exit="exit" className="flex flex-col justify-center space-y-4 pt-4">
                  <h3 className="text-2xl font-bold tracking-tight text-white text-center mb-4">Crea una Contraseña</h3>
                  <input
                    type="password"
                    className="w-full p-4 bg-black border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-brand-primary focus:border-brand-primary transition-all text-center text-lg"
                    placeholder="Contraseña (mín 8 carác.)"
                    {...register('password')}
                    autoFocus
                  />
                  {errors.password && <p className="text-xs text-red-400 text-center">{errors.password.message}</p>}
                  
                  <input
                    type="password"
                    className="w-full p-4 bg-black border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-brand-primary focus:border-brand-primary transition-all text-center text-lg mt-4"
                    placeholder="Confirma la contraseña"
                    {...register('confirmPassword')}
                    onKeyDown={(e) => e.key === 'Enter' && handleNext()}
                  />
                  {errors.confirmPassword && <p className="text-xs text-red-400 text-center">{errors.confirmPassword.message}</p>}
                </motion.div>
              )}

              {step === 5 && (
                <motion.div key="step5" variants={slideVariants} initial="hidden" animate="visible" exit="exit" className="flex flex-col justify-center space-y-4 pt-4">
                  <h3 className="text-2xl font-bold tracking-tight text-white text-center mb-2">Verificación OTP</h3>
                  <div className="text-sm text-zinc-400 text-center mb-6 px-4 flex flex-col items-center gap-1">
                    <span>Hemos enviado un código de 6 dígitos a</span>
                    <span className="text-brand-primary font-medium">{getValues('email')}</span>
                    <button 
                      onClick={() => setStep(1)}
                      className="text-xs text-zinc-500 hover:text-white transition-colors underline decoration-dotted underline-offset-4 mt-1 flex items-center gap-1"
                      type="button"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                      ¿Typo en el correo? Corregir aquí
                    </button>
                  </div>
                  
                  <div className="flex justify-center gap-2 sm:gap-3">
                    {otpValues.map((digit, index) => (
                      <input
                        key={index}
                        ref={(el) => {
                          inputRefs.current[index] = el
                        }}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleOtpChange(index, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(index, e)}
                        onPaste={handleOtpPaste}
                        className="w-12 h-14 sm:w-14 sm:h-16 bg-zinc-950 border border-zinc-800 rounded-xl text-white text-center text-2xl font-bold focus:border-brand-primary focus:ring-1 focus:ring-brand-primary outline-none transition-all duration-300 shadow-inner"
                        autoFocus={index === 0}
                      />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          
          {/* Botón de Acción Principal */}
          <div className="mt-8">
            {step < 5 ? (
              <button
                type="button"
                onClick={handleNext}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 py-4 font-bold text-zinc-950 bg-brand-primary rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 focus:ring-offset-black transition-all hover:opacity-90 disabled:opacity-50"
              >
                {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : (step === 4 ? 'Finalizar y Crear Cuenta' : 'Siguiente')}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleVerifyOtp}
                disabled={isLoading || getValues('otp')?.length !== 6}
                className="w-full flex items-center justify-center gap-2 py-4 font-bold text-zinc-950 bg-brand-primary rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 focus:ring-offset-black transition-all hover:opacity-90 disabled:opacity-50"
              >
                {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : 'Verificar y Entrar'}
              </button>
            )}
            
            {step === 1 && (
              <div className="mt-6 text-center">
                <Link href="/login" className="text-sm font-medium text-zinc-500 hover:text-white transition-colors">
                  ¿Ya tienes cuenta? Ingresa
                </Link>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}
