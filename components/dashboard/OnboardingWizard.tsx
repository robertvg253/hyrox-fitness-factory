'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, ArrowRight, Target, Dumbbell, Activity, CheckCircle2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { activarPasePrueba } from '@/app/(protected)/dashboard/actions'

import { Eye, EyeOff } from 'lucide-react'

export default function OnboardingWizard({ cedula }: { cedula: string }) {
  const router = useRouter()
  
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [loading, setLoading] = useState(false)
  
  // Form Data
  const [objetivo, setObjetivo] = useState('')
  const [fechaNacimiento, setFechaNacimiento] = useState('')
  const [genero, setGenero] = useState('')
  const [aceptoTerminos, setAceptoTerminos] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [errorVisual, setErrorVisual] = useState('')

  const handleStep1 = (e: React.FormEvent) => {
    e.preventDefault()
    if (!objetivo) return toast.error('Selecciona un objetivo')
    setStep(2)
  }

  const handleStep2 = (e: React.FormEvent) => {
    e.preventDefault()
    if (!genero) return toast.error('Selecciona tu género')
    if (!fechaNacimiento) return toast.error('Ingresa tu fecha de nacimiento')
    if (!aceptoTerminos) return toast.error('Debes aceptar los términos y condiciones')
    setStep(3)
  }

  const handleStep3 = (e: React.FormEvent) => {
    e.preventDefault()
    if (!password || !confirmPassword) return toast.error('Ingresa tu contraseña')
    if (password !== confirmPassword) return toast.error('Las contraseñas no coinciden')
    if (password.length < 8) return toast.error('La contraseña debe tener al menos 8 caracteres')
    if (!/[A-Z]/.test(password)) return toast.error('La contraseña debe tener al menos una mayúscula')
    if (!/[0-9]/.test(password)) return toast.error('La contraseña debe tener al menos un número')
    setStep(4)
  }

  const handleActivarPase = async () => {
    setLoading(true)
    setErrorVisual('')
    try {
      const res = await activarPasePrueba({ fechaNacimiento, genero, password })
      if (res.success) {
        toast.success('¡Pase de prueba activado con éxito!')
        router.push('/dashboard')
        router.refresh()
      } else {
        toast.error(res.error || 'Error al activar pase')
        setErrorVisual(res.error || 'Error al activar pase')
      }
    } catch (err: any) {
      toast.error('Error de conexión')
      setErrorVisual(err.message || 'Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black p-6 text-white overflow-hidden relative">
      {/* Background Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-[#02D7E5]/10 blur-[120px] rounded-full pointer-events-none"></div>

      <div className="max-w-md w-full relative z-10">
        
        {/* Progress Dots */}
        <div className="flex justify-center gap-2 mb-10">
          {[1, 2, 3, 4].map((i) => (
            <div 
              key={i} 
              className={`h-2 rounded-full transition-all duration-500 ${step >= i ? 'w-8 bg-[#02D7E5]' : 'w-2 bg-zinc-800'}`}
            />
          ))}
        </div>

        <div className="bg-zinc-950/80 p-8 rounded-3xl border border-zinc-900 shadow-2xl relative min-h-[400px] flex flex-col">
          
          {step === 1 && (
            <form onSubmit={handleStep1} className="flex-1 flex flex-col animate-in slide-in-from-right-8 fade-in duration-500">
              <div className="mb-8">
                <h2 className="text-2xl font-bold mb-2">¿Qué objetivo buscas?</h2>
                <p className="text-sm text-zinc-400">Queremos conocerte para ofrecerte la mejor experiencia.</p>
              </div>

              <div className="space-y-3 flex-1">
                {[
                  { id: 'grasa', label: 'Perder Grasa', icon: Activity },
                  { id: 'masa', label: 'Ganar Masa Muscular', icon: Dumbbell },
                  { id: 'resistencia', label: 'Mejorar Resistencia', icon: Target },
                ].map((opt) => {
                  const Icon = opt.icon
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setObjetivo(opt.id)}
                      className={`w-full flex items-center p-4 rounded-xl border transition-all duration-200 ${
                        objetivo === opt.id 
                          ? 'bg-[#02D7E5]/10 border-[#02D7E5] text-white shadow-[0_0_15px_rgba(2,215,229,0.15)]' 
                          : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:bg-zinc-800'
                      }`}
                    >
                      <Icon className={`w-6 h-6 mr-3 ${objetivo === opt.id ? 'text-[#02D7E5]' : 'text-zinc-500'}`} />
                      <span className="font-semibold">{opt.label}</span>
                    </button>
                  )
                })}
              </div>

              <button
                type="submit"
                disabled={!objetivo}
                className="w-full mt-6 flex items-center justify-center gap-2 py-4 font-bold text-black bg-[#02D7E5] hover:bg-[#02D7E5]/90 rounded-xl transition-all disabled:opacity-50"
              >
                Siguiente <ArrowRight className="w-5 h-5" />
              </button>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={handleStep2} className="flex-1 flex flex-col animate-in slide-in-from-right-8 fade-in duration-500">
              <div className="mb-8">
                <h2 className="text-2xl font-bold mb-2">Unos últimos detalles</h2>
                <p className="text-sm text-zinc-400">Requerimos esta información por motivos de seguridad y salud.</p>
              </div>

              <div className="flex-1 space-y-6">
                <div className="space-y-3">
                  <label className="block text-sm font-bold text-zinc-300">Fecha de Nacimiento</label>
                  <input
                    type="date"
                    required
                    value={fechaNacimiento}
                    onChange={(e) => setFechaNacimiento(e.target.value)}
                    className="w-full p-4 bg-zinc-900 border border-zinc-800 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-[#02D7E5] focus:border-[#02D7E5] transition-all"
                  />
                </div>

                <div className="space-y-3">
                  <label className="block text-sm font-bold text-zinc-300">Género</label>
                  <select
                    required
                    value={genero}
                    onChange={(e) => setGenero(e.target.value)}
                    className="w-full p-4 bg-zinc-900 border border-zinc-800 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-[#02D7E5] focus:border-[#02D7E5] transition-all cursor-pointer"
                  >
                    <option value="" disabled className="text-zinc-500">Selecciona tu género</option>
                    <option value="masculino">Masculino</option>
                    <option value="femenino">Femenino</option>
                    <option value="prefiero no decirlo">Prefiero no decirlo</option>
                  </select>
                </div>

                <div className="flex items-start gap-3 mt-4 bg-zinc-900 p-4 rounded-xl border border-zinc-800">
                  <input
                    type="checkbox"
                    id="terminos"
                    checked={aceptoTerminos}
                    onChange={(e) => setAceptoTerminos(e.target.checked)}
                    className="mt-1 w-5 h-5 rounded border-zinc-700 text-[#02D7E5] focus:ring-[#02D7E5] bg-zinc-800"
                  />
                  <label htmlFor="terminos" className="text-sm text-zinc-400 leading-relaxed cursor-pointer">
                    Acepto los <span className="text-[#02D7E5] underline">términos y condiciones</span> y asumo la responsabilidad por mi estado de salud para realizar actividad física.
                  </label>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-6 py-4 font-bold text-zinc-400 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 rounded-xl transition-all"
                >
                  Volver
                </button>
                <button
                  type="submit"
                  disabled={!fechaNacimiento || !aceptoTerminos}
                  className="flex-1 flex items-center justify-center gap-2 py-4 font-bold text-black bg-[#02D7E5] hover:bg-[#02D7E5]/90 rounded-xl transition-all disabled:opacity-50"
                >
                  Siguiente <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </form>
          )}

          {step === 3 && (
            <form onSubmit={handleStep3} className="flex-1 flex flex-col animate-in slide-in-from-right-8 fade-in duration-500">
              <div className="mb-8">
                <h2 className="text-2xl font-bold mb-2">Crea tu contraseña</h2>
                <p className="text-sm text-zinc-400">Protege tu cuenta para futuras reservas.</p>
              </div>

              <div className="flex-1 space-y-5">
                {/* Input oculto para accesibilidad de gestores de contraseñas */}
                <input type="text" autoComplete="username" value={cedula} className="hidden" readOnly />

                <div className="space-y-2 relative">
                  <label className="block text-sm font-bold text-zinc-300">Contraseña</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full p-4 pr-12 bg-zinc-900 border border-zinc-800 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-[#02D7E5] focus:border-[#02D7E5] transition-all"
                      placeholder="Mínimo 8 caracteres"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-bold text-zinc-300">Confirmar Contraseña</label>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full p-4 bg-zinc-900 border border-zinc-800 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-[#02D7E5] focus:border-[#02D7E5] transition-all"
                    placeholder="Repite tu contraseña"
                  />
                </div>

                <div className="space-y-2 pt-2">
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className={`w-4 h-4 ${password.length >= 8 ? 'text-[#02D7E5]' : 'text-zinc-600'}`} />
                    <span className={password.length >= 8 ? 'text-zinc-300' : 'text-zinc-500'}>Mínimo 8 caracteres</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className={`w-4 h-4 ${/[A-Z]/.test(password) ? 'text-[#02D7E5]' : 'text-zinc-600'}`} />
                    <span className={/[A-Z]/.test(password) ? 'text-zinc-300' : 'text-zinc-500'}>Al menos 1 mayúscula</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className={`w-4 h-4 ${/[0-9]/.test(password) ? 'text-[#02D7E5]' : 'text-zinc-600'}`} />
                    <span className={/[0-9]/.test(password) ? 'text-zinc-300' : 'text-zinc-500'}>Al menos 1 número</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="px-6 py-4 font-bold text-zinc-400 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 rounded-xl transition-all"
                >
                  Volver
                </button>
                <button
                  type="submit"
                  disabled={!password || password !== confirmPassword || password.length < 8 || !/[A-Z]/.test(password) || !/[0-9]/.test(password)}
                  className="flex-1 flex items-center justify-center gap-2 py-4 font-bold text-black bg-[#02D7E5] hover:bg-[#02D7E5]/90 rounded-xl transition-all disabled:opacity-50"
                >
                  Siguiente <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </form>
          )}

          {step === 4 && (
            <div className="flex-1 flex flex-col items-center justify-center text-center animate-in zoom-in-95 fade-in duration-500">
              <div className="w-20 h-20 bg-[#02D7E5]/20 rounded-full flex items-center justify-center mb-6 border border-[#02D7E5]/30">
                <CheckCircle2 className="w-10 h-10 text-[#02D7E5]" />
              </div>
              
              <h2 className="text-3xl font-bold mb-3">¡Todo listo para tu evolución!</h2>
              <p className="text-zinc-400 mb-8 max-w-[280px]">
                Tu perfil ha sido completado. Ahora puedes reclamar tu pase gratuito y reservar tu primera clase.
              </p>

              <button
                type="button"
                onClick={handleActivarPase}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-5 font-bold text-black bg-[#02D7E5] hover:bg-[#02D7E5]/90 rounded-2xl transition-all disabled:opacity-50 shadow-[0_0_30px_rgba(2,215,229,0.3)] text-lg"
              >
                {loading ? (
                  <><Loader2 className="w-6 h-6 animate-spin" /> Activando Pase...</>
                ) : (
                  'Entrar al panel'
                )}
              </button>
              
              {errorVisual && (
                <p className="mt-4 text-red-400 text-sm font-medium w-full max-w-[280px]">
                  {errorVisual}
                </p>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
