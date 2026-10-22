'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { Loader2, ArrowRight } from 'lucide-react'
import { iniciarSesionUsuario } from '@/app/auth/actions'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const router = useRouter()
  
  const [loading, setLoading] = useState(false)
  
  // Step 1: Identificación
  const [tipoDocumento, setTipoDocumento] = useState('V')
  const [numeroDocumento, setNumeroDocumento] = useState('')
  const [password, setPassword] = useState('')

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (numeroDocumento.length < 7) return toast.error('Ingresa un número válido de al menos 7 dígitos')
    if (!password) return toast.error('Ingresa tu contraseña')
    
    const fullCedula = `${tipoDocumento}${numeroDocumento}`

    setLoading(true)
    try {
      const res = await iniciarSesionUsuario(fullCedula, password)
      
      if (!res.success) {
        toast.error('Credenciales inválidas')
        return
      }

      toast.success('¡Bienvenido!')
      router.push(res.redirectUrl || res.redirect || '/dashboard')
      router.refresh()
    } catch {
      toast.error('Credenciales inválidas')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black p-6 text-white">
      <div className="w-full max-w-sm space-y-8 bg-zinc-950/80 p-8 rounded-2xl border border-zinc-900 shadow-2xl animate-in fade-in zoom-in-95 duration-300">
        <div className="flex flex-col items-center text-center">
          <Image
            src="/images/LOGO TEXTURA01.png"
            alt="Logo"
            width={150}
            height={50}
            className="h-auto w-[150px] object-contain mb-2"
            priority
          />
          <h2 className="text-xs font-bold tracking-widest text-zinc-400 uppercase">
            ACCESO ATLETAS
          </h2>
        </div>

        <form onSubmit={handleLoginSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-zinc-400 ml-1">
              Cédula de Identidad
            </label>
            <div className="flex flex-row gap-2">
              <select
                value={tipoDocumento}
                onChange={e => setTipoDocumento(e.target.value)}
                disabled={loading}
                className="w-[80px] p-4 bg-black border border-zinc-800 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-[#02D7E5] focus:border-[#02D7E5] transition-all font-medium appearance-none text-center cursor-pointer disabled:opacity-50"
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
                autoComplete="username"
                value={numeroDocumento}
                onChange={e => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 9)
                  setNumeroDocumento(val)
                }}
                disabled={loading}
                className="flex-1 p-4 bg-black border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-[#02D7E5] focus:border-[#02D7E5] transition-all disabled:opacity-50 font-medium"
                placeholder="Ej. 12345678"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center ml-1">
              <label className="block text-sm font-medium text-zinc-400">
                Contraseña
              </label>
              <Link href="/recuperar-password" className="text-xs text-[#02D7E5] hover:text-white transition-colors">
                ¿Olvidaste tu contraseña?
              </Link>
            </div>
            <input
              required
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              disabled={loading}
              className="w-full p-4 bg-black border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-[#02D7E5] focus:border-[#02D7E5] transition-all disabled:opacity-50 font-medium"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading || numeroDocumento.length < 7 || !password}
            className="w-full flex items-center justify-center gap-2 py-4 font-bold text-black bg-[#02D7E5] hover:bg-[#02D7E5]/90 rounded-xl transition-all disabled:opacity-50 shadow-[0_0_15px_rgba(2,215,229,0.2)]"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
              <>Iniciar Sesión <ArrowRight className="w-4 h-4" /></>
            )}
          </button>
        </form>

        <div className="flex flex-col items-center gap-2 pt-6 border-t border-zinc-900">
          <Link href="/registro" className="text-sm font-medium text-zinc-400 hover:text-white transition-colors flex items-center gap-1">
            ¿Eres nuevo? <span className="text-[#02D7E5]">Regístrate aquí</span>
          </Link>
          <Link href="/activacion" className="text-xs font-medium text-zinc-500 hover:text-zinc-300 transition-colors flex items-center gap-1">
            ¿Te preinscribieron o invitaron? <span className="text-amber-400 font-semibold">Activa tu cupo</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
