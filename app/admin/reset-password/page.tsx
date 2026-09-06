"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Mail, Lock, KeyRound, Loader2, ArrowLeft } from 'lucide-react'
import { createClient } from '@/src/utils/supabase/client'

const resetPasswordSchema = z.object({
  email: z.string().email('Ingresa un correo electrónico válido'),
  token: z.string().length(8, 'El código de seguridad debe tener exactamente 8 dígitos'),
  password: z.string().min(6, 'La nueva contraseña debe tener al menos 6 caracteres'),
})

type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>

export default function ResetPasswordPage() {
  const router = useRouter()
  const supabase = createClient()
  const [authError, setAuthError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
  })

  const onSubmit = async (data: ResetPasswordFormValues) => {
    try {
      setAuthError(null)
      
      // 1. Verificar el código OTP
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: data.email,
        token: data.token,
        type: 'recovery',
      })

      if (verifyError) {
        throw verifyError
      }

      // 2. Actualizar la contraseña
      const { error: updateError } = await supabase.auth.updateUser({
        password: data.password,
      })

      if (updateError) {
        throw updateError
      }

      // 3. Redirigir al login
      router.push('/admin/login')
    } catch (error: any) {
      setAuthError(error.message || 'Error al restablecer la contraseña. Verifica tu código.')
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
            NUEVA CONTRASEÑA
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
                placeholder="Correo electrónico"
                className="block w-full pl-10 pr-3 py-3 border border-white/5 rounded-lg bg-black/50 text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-[#02D7E5] focus:border-[#02D7E5] transition-all sm:text-sm"
                {...register('email')}
                disabled={isSubmitting}
              />
            </div>
            {errors.email && (
              <p className="text-xs text-red-400 mt-1 ml-1">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-1">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <KeyRound className="h-5 w-5 text-gray-500" />
              </div>
              <input
                id="token"
                type="text"
                placeholder="Código de 8 dígitos"
                maxLength={8}
                className="block w-full pl-10 pr-3 py-3 border border-white/5 rounded-lg bg-black/50 text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-[#02D7E5] focus:border-[#02D7E5] transition-all sm:text-sm text-center tracking-[0.5em] font-mono"
                {...register('token')}
                disabled={isSubmitting}
              />
            </div>
            {errors.token && (
              <p className="text-xs text-red-400 mt-1 ml-1">{errors.token.message}</p>
            )}
          </div>

          <div className="space-y-1">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-gray-500" />
              </div>
              <input
                id="password"
                type="password"
                placeholder="Nueva contraseña"
                className="block w-full pl-10 pr-3 py-3 border border-white/5 rounded-lg bg-black/50 text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-[#02D7E5] focus:border-[#02D7E5] transition-all sm:text-sm"
                {...register('password')}
                disabled={isSubmitting}
              />
            </div>
            {errors.password && (
              <p className="text-xs text-red-400 mt-1 ml-1">{errors.password.message}</p>
            )}
          </div>

          {authError && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <p className="text-sm text-red-400 text-center">{authError}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-bold text-[#050505] bg-[#02D7E5] hover:bg-[#02D7E5]/90 hover:shadow-[0_0_15px_rgba(2,215,229,0.4)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#02D7E5] focus:ring-offset-[#050505] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
          >
            {isSubmitting ? (
              <Loader2 className="w-5 h-5 animate-spin text-[#050505]" />
            ) : (
              'Confirmar Nueva Contraseña'
            )}
          </button>
        </form>

        <div className="mt-8 text-center">
          <Link
            href="/admin/login"
            className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-[#02D7E5] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Cancelar y volver
          </Link>
        </div>
      </div>
    </div>
  )
}
