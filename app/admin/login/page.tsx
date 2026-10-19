"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Mail, Lock, Loader2, Eye, EyeOff } from 'lucide-react'
import { createClient } from '@/src/utils/supabase/client'
import toast from 'react-hot-toast'

const loginSchema = z.object({
  email: z.string().email('Ingresa un correo electrónico válido'),
  password: z.string().min(1, 'La contraseña es obligatoria'),
})

type LoginFormValues = z.infer<typeof loginSchema>

export default function AdminLoginPage() {
  const router = useRouter()
  const supabase = createClient()
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
      const { error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      })

      if (error) {
        throw error
      }

      router.push('/admin/dashboard')
    } catch (error: any) {
      setIsLoading(false)
      toast.error('Credenciales inválidas')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#02D7E5]/10 via-[#050505] to-[#050505] p-4">
      <div className="w-full max-w-md bg-white/[0.02] border border-white/5 backdrop-blur-xl rounded-2xl p-8 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)]">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold italic text-white tracking-tight">
            Fitness Factory
          </h1>
          <p className="text-sm text-[#02D7E5] mt-2 font-medium tracking-wide">
            ADMIN PORTAL
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-1">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-gray-500" />
              </div>
              <input
                id="email"
                type="email"
                placeholder="correo@ejemplo.com"
                className="block w-full pl-10 pr-3 py-3 border border-white/5 rounded-lg bg-black/50 text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-[#02D7E5] focus:border-[#02D7E5] transition-all sm:text-sm"
                {...register('email')}
                disabled={isPending}
              />
            </div>
            {errors.email && (
              <p className="text-xs text-red-400 mt-1 ml-1">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-1">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-gray-500" />
              </div>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Contraseña"
                className="block w-full pl-10 pr-10 py-3 border border-white/5 rounded-lg bg-black/50 text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-[#02D7E5] focus:border-[#02D7E5] transition-all sm:text-sm"
                {...register('password')}
                disabled={isPending}
              />
              <button
                type="button"
                onClick={() => setShowPassword(prev => !prev)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-gray-300 focus:outline-none transition-colors"
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5" />
                ) : (
                  <Eye className="h-5 w-5" />
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
            className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-bold text-[#050505] bg-[#02D7E5] hover:bg-[#02D7E5]/90 hover:shadow-[0_0_15px_rgba(2,215,229,0.4)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#02D7E5] focus:ring-offset-[#050505] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
          >
            {isPending ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin text-[#050505]" />
                <span>Iniciando sesión...</span>
              </>
            ) : (
              'Iniciar Sesión'
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
