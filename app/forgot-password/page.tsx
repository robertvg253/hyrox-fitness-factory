'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/src/utils/supabase/client'

const forgotPasswordSchema = z.object({
  email: z.string().email('Ingresa un correo electrónico válido'),
})

type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>

export default function ForgotPasswordPage() {
  const supabase = createClient()
  const [globalError, setGlobalError] = useState<string | null>(null)
  const [isSuccess, setIsSuccess] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
  })

  const onSubmit = async (data: ForgotPasswordValues) => {
    try {
      setGlobalError(null)
      const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
        redirectTo: `${window.location.origin}/reset-password`, // Asegúrate de tener esta ruta si es diferente
      })

      if (error) {
        throw new Error('Hubo un problema al solicitar el restablecimiento de contraseña.')
      }

      setIsSuccess(true)
    } catch (error: any) {
      setGlobalError(error.message)
    }
  }

  if (isSuccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-black p-6 text-white">
        <div className="w-full max-w-sm space-y-6 bg-zinc-950/80 p-8 rounded-2xl border border-zinc-900 shadow-2xl text-center">
          <h2 className="text-xl font-bold tracking-tight text-white">Correo Enviado</h2>
          <p className="text-zinc-400 text-sm">
            Si existe una cuenta asociada a ese correo, recibirás un enlace para restablecer tu contraseña.
          </p>
          <Link href="/login" className="block w-full py-4 font-bold text-zinc-950 bg-brand-primary rounded-xl hover:opacity-90 transition-all">
            Volver al Login
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black p-6 text-white">
      <div className="w-full max-w-sm space-y-8 bg-zinc-950/80 p-8 rounded-2xl border border-zinc-900 shadow-2xl">
        <div className="flex flex-col items-center text-center">
          <Image
            src="/images/LOGO TEXTURA01.png"
            alt="Logo"
            width={150}
            height={50}
            className="h-auto w-[150px] object-contain mb-2"
            priority
          />
          <h2 className="text-xs font-bold tracking-widest text-zinc-400 uppercase">RECUPERAR CONTRASEÑA</h2>
        </div>
        
        {globalError && (
          <div className="p-4 text-sm font-medium text-red-400 bg-red-950/20 border border-red-900/50 rounded-xl text-center">
            {globalError}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-zinc-300 ml-1" htmlFor="email">
              Correo Electrónico
            </label>
            <input
              id="email"
              type="email"
              className="w-full p-4 bg-black border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-brand-primary focus:border-brand-primary transition-all disabled:opacity-50"
              placeholder="tu@email.com"
              {...register('email')}
              disabled={isSubmitting}
            />
            {errors.email && <p className="text-xs text-red-400 ml-1">{errors.email.message}</p>}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full flex items-center justify-center gap-2 py-4 font-bold text-zinc-950 bg-brand-primary rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 focus:ring-offset-black transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
          >
            {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Enviar Enlace'}
          </button>
        </form>

        <div className="flex flex-col items-center pt-6 border-t border-zinc-900">
          <Link href="/login" className="text-sm font-medium text-zinc-400 hover:text-white transition-colors">
            Recordé mi contraseña. Volver al Login
          </Link>
        </div>
      </div>
    </div>
  )
}
