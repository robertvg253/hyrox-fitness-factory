'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { Loader2, ArrowRight, ShieldCheck, ArrowLeft } from 'lucide-react'
import { createClient } from '@/src/utils/supabase/client'
import { verificarCedula, enviarOtp, validarOtp } from '@/app/auth/actions'
import toast from 'react-hot-toast'

export default function RegistroPage() {
  const router = useRouter()
  const supabase = createClient()
  
  // Steps: 1: Cédula, 2: Nombres, 3: Teléfono, 4: OTP
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [loading, setLoading] = useState(false)
  // Form Data
  const [tipoDocumento, setTipoDocumento] = useState('V')
  const [numeroDocumento, setNumeroDocumento] = useState('')
  const [cedula, setCedula] = useState('')
  const [nombre, setNombre] = useState('')
  const [apellido, setApellido] = useState('')
  const [countryCode, setCountryCode] = useState('+58')
  const [phoneRaw, setPhoneRaw] = useState('')
  const [phoneFormatted, setPhoneFormatted] = useState('')
  const [telefono, setTelefono] = useState('')

  const [errorVisual, setErrorVisual] = useState('')

  // OTP Data
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [timer, setTimer] = useState(60)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    let interval: NodeJS.Timeout
    if (step === 4 && timer > 0) {
      interval = setInterval(() => setTimer(t => t - 1), 1000)
    }
    return () => clearInterval(interval)
  }, [step, timer])

  // Handlers for Form Progress
  const handleStep1 = async (e: React.FormEvent) => {
    e.preventDefault()
    if (numeroDocumento.length < 7) return toast.error('Ingresa un número válido de al menos 7 dígitos')
    
    const fullCedula = `${tipoDocumento}${numeroDocumento}`
    setCedula(fullCedula)

    setLoading(true)
    try {
      const res = await verificarCedula(cedula)
      if (res.success) {
        toast.error('Esta cédula ya está registrada. Por favor inicia sesión.')
        router.push('/login')
        return
      }
      setStep(2)
    } catch (err) {
      toast.error('Error verificando la cédula.')
    } finally {
      setLoading(false)
    }
  }

  const handleStep2 = (e: React.FormEvent) => {
    e.preventDefault()
    if (!nombre.trim() || !apellido.trim()) return toast.error('Debes ingresar tu nombre y apellido')
    setStep(3)
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

  const handleStep3 = async (e: React.FormEvent) => {
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
        toast.success(otpRes.message)
        setStep(4)
        setTimer(60)
      } else {
        toast.error('Error al enviar el código.')
      }
    } catch (err) {
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
      const nombreCompleto = `${nombre.trim()} ${apellido.trim()}`
      const res = await validarOtp(telefono, codigo, { isRegister: true, cedula, nombre: nombreCompleto })
      
      if (res.success && res.dummyEmail) {
         const { error } = await supabase.auth.signInWithPassword({
           email: res.dummyEmail,
           password: res.dummyPassword
         })

         if (error) {
           setErrorVisual('Error al iniciar sesión segura en tu dispositivo.')
           return
         }

         toast.success('¡Registro exitoso! Bienvenido.')
         router.push('/dashboard')
      } else {
        toast.error(res.error || 'Código incorrecto.')
        setErrorVisual(res.error || 'Código incorrecto.')
      }
    } catch (err: any) {
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

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="flex flex-col justify-start items-start pt-8 md:pt-16 px-6 max-w-md mx-auto w-full">
        
        {/* Nav Back (excepto step 1) */}
        {step > 1 && (
          <button 
            onClick={() => setStep((step - 1) as any)} 
            disabled={loading}
            className="mb-8 flex items-center text-sm font-medium text-zinc-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-1" /> Volver
          </button>
        )}
        {step === 1 && <div className="mb-8 h-[20px]" />}

        <div className="w-full flex flex-col items-start mb-10">
          <Image
            src="/images/LOGO TEXTURA01.png"
            alt="Logo"
            width={120}
            height={40}
            className="h-auto w-[120px] object-contain mb-4"
            priority
          />
          <h1 className="text-2xl font-bold tracking-tight text-white mb-2">
            Crea tu cuenta
          </h1>
          <p className="text-sm text-zinc-400">
            Únete a la mejor comunidad fitness. Paso {step} de 4.
          </p>
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
                className="w-full flex items-center justify-center gap-2 py-4 font-bold text-black bg-[#02D7E5] hover:bg-[#02D7E5]/90 rounded-xl transition-all disabled:opacity-50 mt-4"
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

          {/* Step 2: Nombres */}
          {step === 2 && (
            <form onSubmit={handleStep2} className="space-y-5 w-full animate-in slide-in-from-right-4 fade-in duration-300">
              <div className="space-y-2">
                <label className="block text-sm font-bold text-zinc-300">Nombre</label>
                <input
                  required
                  type="text"
                  value={nombre}
                  onChange={e => setNombre(e.target.value)}
                  className="w-full p-4 bg-zinc-900 border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-[#02D7E5] focus:border-[#02D7E5] transition-all text-lg font-medium"
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
                  className="w-full p-4 bg-zinc-900 border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-[#02D7E5] focus:border-[#02D7E5] transition-all text-lg font-medium"
                  placeholder="Ej. Pérez"
                />
              </div>

              <button
                type="submit"
                disabled={!nombre || !apellido}
                className="w-full flex items-center justify-center gap-2 py-4 font-bold text-black bg-[#02D7E5] hover:bg-[#02D7E5]/90 rounded-xl transition-all disabled:opacity-50 mt-6"
              >
                Continuar <ArrowRight className="w-5 h-5" />
              </button>
            </form>
          )}

          {/* Step 3: Teléfono */}
          {step === 3 && (
            <form onSubmit={handleStep3} className="space-y-6 w-full animate-in slide-in-from-right-4 fade-in duration-300">
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
                  Enviaremos un código SMS para verificar tu identidad. No compartiremos tu número con nadie.
                </p>
              </div>

              <button
                type="submit"
                disabled={loading || phoneRaw.length < 10}
                className="w-full flex items-center justify-center gap-2 py-4 font-bold text-black bg-[#02D7E5] hover:bg-[#02D7E5]/90 rounded-xl transition-all disabled:opacity-50 mt-4"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Enviar Código OTP'}
              </button>
            </form>
          )}

          {/* Step 4: OTP */}
          {step === 4 && (
            <form onSubmit={handleVerifyOtp} className="space-y-8 w-full animate-in slide-in-from-right-4 fade-in duration-300">
              <div className="space-y-2">
                <div className="flex items-center gap-3 mb-4">
                  <ShieldCheck className="w-8 h-8 text-[#02D7E5]" />
                  <p className="text-sm text-zinc-300 leading-relaxed">
                    Hemos enviado un código a <br/>
                    <span className="font-bold text-white tracking-wide">{telefono}</span>
                  </p>
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
                  ) : 'Verificar y Entrar'}
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

        </div>
      </div>
    </div>
  )
}
