"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Mail, Lock, Loader2, Eye, EyeOff, ShieldCheck } from 'lucide-react'
import { iniciarSesionUsuario } from '@/app/auth/actions'
import toast from 'react-hot-toast'

const loginSchema = z.object({
  email: z.string().min(1, 'Ingresa tu correo o cédula de administrador'),
  password: z.string().min(1, 'La contraseña es obligatoria'),
})

type LoginFormValues = z.infer<typeof loginSchema>

export default function AdminLoginPage() {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  })

  const isPending = isSubmitting || isLoading

  const onSubmit = async (data: LoginFormValues) => {
    setIsLoading(true)
    try {
      // Validación estricta en el servidor para el portal de admin
      const res = await iniciarSesionUsuario(data.email, data.password, 'admin')

      if (!res.success) {
        toast.error(res.error || 'Credenciales inválidas o no tienes permisos de administrador')
        setIsLoading(false)
        return
      }

      toast.success('¡Acceso concedido!')
      router.push(res.redirectUrl || '/admin/dashboard')
      router.refresh()
    } catch {
      setIsLoading(false)
      toast.error('Error de conexión al iniciar sesión.')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#02D7E5]/10 via-[#050505] to-[#050505] p-4">
      <div className="w-full max-w-md bg-white/[0.02] border border-white/5 backdrop-blur-xl rounded-3xl p-8 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)]">
        <div className="mb-8 text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-[#02D7E5]/10 border border-[#02D7E5]/30 mx-auto flex items-center justify-center text-[#02D7E5] shadow-lg shadow-[#02D7E5]/10">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold italic text-white tracking-tight">
            Hyrox Race Director
          </h1>
          <p className="text-xs text-[#02D7E5] font-bold tracking-widest uppercase">
            Portal Administrativo
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="space-y-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block ml-1">
              Usuario / Correo
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Mail className="h-4 w-4 text-zinc-500" />
              </div>
              <input
                id="email"
                type="text"
                placeholder="admin@ejemplo.com o cédula"
                className="block w-full pl-10 pr-3 py-3 border border-zinc-800 rounded-2xl bg-zinc-950/80 text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-[#02D7E5] focus:border-[#02D7E5] transition-all text-xs"
                {...register('email')}
                disabled={isPending}
              />
            </div>
            {errors.email && (
              <p className="text-xs text-red-400 mt-1 ml-1">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block ml-1">
              Contraseña
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Lock className="h-4 w-4 text-zinc-500" />
              </div>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                className="block w-full pl-10 pr-10 py-3 border border-zinc-800 rounded-2xl bg-zinc-950/80 text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-[#02D7E5] focus:border-[#02D7E5] transition-all text-xs"
                {...register('password')}
                disabled={isPending}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-zinc-500 hover:text-white"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            {errors.password && (
              <p className="text-xs text-red-400 mt-1 ml-1">{errors.password.message}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="w-full flex items-center justify-center py-3.5 px-4 rounded-2xl shadow-lg shadow-[#02D7E5]/20 text-xs font-bold text-black bg-[#02D7E5] hover:bg-[#02D7E5]/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#02D7E5] transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              'Ingresar al Panel de Control'
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
