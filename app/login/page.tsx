'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/src/utils/supabase/client'

const loginSchema = z.object({
  email: z.string().email('Ingresa un correo electrónico válido'),
  password: z.string().min(1, 'La contraseña es obligatoria'),
})

type LoginFormValues = z.infer<typeof loginSchema>

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [globalError, setGlobalError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginFormValues) => {
    try {
      setGlobalError(null)
      const { error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      })

      if (error) {
        // Mensaje de error genérico para seguridad
        throw new Error('Credenciales inválidas o acceso denegado.')
      }

      router.push('/dashboard')
      router.refresh()
    } catch (error: any) {
      setGlobalError(error.message)
    }
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
          <h2 className="text-xs font-bold tracking-widest text-zinc-400 uppercase">BIENVENIDO DE NUEVO</h2>
        </div>
        
        {globalError && (
          <div className="p-4 text-sm font-medium text-red-400 bg-red-950/20 border border-red-900/50 rounded-xl text-center">
            {globalError}
          </div>
        )}

        <div className="flex flex-row gap-4 mb-6">
          <button 
            type="button"
            onClick={() => console.log('Próximamente')}
            disabled={isSubmitting}
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-zinc-900 border border-zinc-800 rounded-xl hover:bg-zinc-800 transition-colors disabled:opacity-50"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" xmlns="http://www.w3.org/2000/svg">
              <path fill="#ffffff" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#ffffff" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#ffffff" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#ffffff" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            <span className="text-sm font-medium">Google</span>
          </button>
          <button 
            type="button"
            onClick={() => console.log('Próximamente')}
            disabled={isSubmitting}
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-zinc-900 border border-zinc-800 rounded-xl hover:bg-zinc-800 transition-colors disabled:opacity-50"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
              <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.04 2.26-.79 3.55-.83 1.55-.1 2.76.65 3.54 1.76-3.04 1.76-2.54 5.92.51 7.15-.71 1.69-1.57 3.33-2.68 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
            </svg>
            <span className="text-sm font-medium">Apple</span>
          </button>
        </div>

        <div className="flex items-center gap-4">
          <div className="h-px bg-zinc-800 flex-1"></div>
          <span className="text-xs text-zinc-500 font-medium">O</span>
          <div className="h-px bg-zinc-800 flex-1"></div>
        </div>

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
          
          <div className="space-y-2">
            <label className="block text-sm font-medium text-zinc-300 ml-1" htmlFor="password">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              className="w-full p-4 bg-black border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-brand-primary focus:border-brand-primary transition-all disabled:opacity-50"
              placeholder="••••••••"
              {...register('password')}
              disabled={isSubmitting}
            />
            {errors.password && <p className="text-xs text-red-400 ml-1">{errors.password.message}</p>}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full flex items-center justify-center gap-2 py-4 font-bold text-zinc-950 bg-brand-primary rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 focus:ring-offset-black transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
          >
            {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Ingresar'}
          </button>
        </form>

        <div className="flex flex-col items-center space-y-4 pt-6 border-t border-zinc-900">
          <Link href="/forgot-password" className="text-sm font-medium text-zinc-400 hover:text-white transition-colors">
            ¿Olvidaste tu contraseña?
          </Link>
          <Link href="/register" className="text-sm font-medium text-zinc-400 hover:text-white transition-colors">
            No tengo cuenta, Registrarme
          </Link>
        </div>
      </div>
    </div>
  )
}
