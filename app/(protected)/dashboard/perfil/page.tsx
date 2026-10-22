import { createClient } from '@/src/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  User,
  Phone,
  Mail,
  Shirt,
  ShieldCheck,
  ChevronLeft,
  Award,
  CheckCircle2
} from 'lucide-react'
import LogoutButton from './LogoutButton'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function PerfilAtletaPage() {
  const supabase = await createClient()

  // 1. Obtener la sesión protegida
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // 2. Extraer datos limpios del usuario en public.usuarios (SIN JOIN A SUSCRIPCIONES)
  const { data: perfil, error } = await supabase
    .from('usuarios')
    .select('id, nombres, cedula, telefono, email, talla_franela, rol')
    .eq('id', user.id)
    .maybeSingle()

  if (error) {
    console.error('[Perfil] Error obteniendo datos del atleta:', error)
  }

  const nombres = perfil?.nombres || 'Atleta Hyrox'
  const cedula = perfil?.cedula || 'N/A'
  const email = perfil?.email || user.email || 'N/A'
  const telefono = perfil?.telefono || 'No registrado'
  const tallaFranela = perfil?.talla_franela ? `Talla ${perfil.talla_franela}` : 'Sin especificar'

  return (
    <main className="pb-16 px-4 pt-4 space-y-6 max-w-md mx-auto">
      {/* 1. Header con Navegación hacia Atrás */}
      <header className="flex items-center gap-3">
        <Link
          href="/dashboard"
          className="w-10 h-10 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white transition-colors shrink-0"
          title="Volver al inicio"
        >
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div>
          <span className="text-[10px] font-bold tracking-widest text-[#02D7E5] uppercase">
            Ajustes de Cuenta
          </span>
          <h1 className="text-xl font-bold text-white tracking-tight">
            Perfil del Atleta
          </h1>
        </div>
      </header>

      {/* 2. Tarjeta Bento Principal: Atleta & Credencial */}
      <section className="relative overflow-hidden rounded-3xl bg-zinc-950/80 backdrop-blur-xl border border-white/10 p-6 shadow-2xl">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#02D7E5] to-transparent opacity-80" />
        <div className="absolute -bottom-12 -right-12 w-36 h-36 bg-[#02D7E5]/10 rounded-full blur-2xl pointer-events-none" />

        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-[#02D7E5]/25 via-zinc-900 to-zinc-800 border border-[#02D7E5]/40 flex items-center justify-center shadow-lg shadow-[#02D7E5]/15 shrink-0">
            <User className="w-8 h-8 text-[#02D7E5]" />
          </div>
          <div className="space-y-1 overflow-hidden">
            <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#02D7E5]/10 text-[#02D7E5] border border-[#02D7E5]/30">
              <Award className="w-3 h-3" />
              <span>Competidor Oficial</span>
            </div>
            <h2 className="text-lg font-bold text-white tracking-tight truncate">
              {nombres}
            </h2>
            <p className="text-xs text-zinc-400 flex items-center gap-1.5 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#02D7E5]" />
              Ficha Validada
            </p>
          </div>
        </div>
      </section>

      {/* 3. Grid Bento: Datos Personales Oficiales */}
      <section className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 px-1">
          Información Personal y de Carrera
        </h3>

        <div className="grid grid-cols-2 gap-3">
          {/* Tarjeta Documento */}
          <div className="p-4 rounded-3xl bg-zinc-950/70 border border-zinc-800/80 flex flex-col justify-between space-y-2">
            <div className="w-9 h-9 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-[#02D7E5]">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">
                Cédula / Documento
              </span>
              <span className="text-sm font-bold text-white truncate block">
                {cedula}
              </span>
            </div>
          </div>

          {/* Tarjeta Talla de Franela */}
          <div className="p-4 rounded-3xl bg-zinc-950/70 border border-zinc-800/80 flex flex-col justify-between space-y-2">
            <div className="w-9 h-9 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-[#02D7E5]">
              <Shirt className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">
                Talla Oficial
              </span>
              <span className="text-sm font-bold text-[#02D7E5] block">
                {tallaFranela}
              </span>
            </div>
          </div>

          {/* Tarjeta Correo */}
          <div className="col-span-2 p-4 rounded-3xl bg-zinc-950/70 border border-zinc-800/80 flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-[#02D7E5] shrink-0">
              <Mail className="w-4 h-4" />
            </div>
            <div className="overflow-hidden">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">
                Correo Electrónico
              </span>
              <span className="text-xs font-bold text-zinc-200 truncate block">
                {email}
              </span>
            </div>
          </div>

          {/* Tarjeta Teléfono */}
          <div className="col-span-2 p-4 rounded-3xl bg-zinc-950/70 border border-zinc-800/80 flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-[#02D7E5] shrink-0">
              <Phone className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">
                Teléfono de Contacto
              </span>
              <span className="text-xs font-bold text-zinc-200 block">
                {telefono}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Botón de Cerrar Sesión */}
      <section className="pt-2">
        <LogoutButton />
      </section>
    </main>
  )
}
