import { createClient } from '@/src/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, CheckCircle2 } from 'lucide-react'
import { obtenerPlanesSede } from '@/app/(protected)/dashboard/actions'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function NuevaSuscripcionPage({ searchParams }: { searchParams: Promise<{ cambiar?: string }> }) {
  const resolvedParams = await searchParams
  const isCambiar = resolvedParams.cambiar === 'true'

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Obtener el sede_id del usuario actual
  const { data: userData } = await supabase
    .from('usuarios')
    .select('sede_id')
    .eq('id', user.id)
    .single()

  const sedeId = userData?.sede_id

  let planesDisponibles: any[] = []

  if (sedeId) {
    const res = await obtenerPlanesSede(sedeId)
    if (res.success && res.data) {
      planesDisponibles = res.data
    }
  } else {
    console.warn('[NuevaSuscripcion] Usuario no tiene sede asignada:', user.id)
  }

  // Obtener suscripción actual para Smart Routing
  const { data: sub } = await supabase
    .from('suscripciones')
    .select('plan_id, planes(*)')
    .eq('usuario_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const currentPlanRaw = sub?.planes
  const currentPlan: any = Array.isArray(currentPlanRaw) ? currentPlanRaw[0] : currentPlanRaw
  const isPaidPlan = currentPlan && currentPlan.precio_usd > 0 && !currentPlan.nombre.toLowerCase().includes('prueba')
  const showFastRenewal = isPaidPlan && !isCambiar

  return (
    <main className="min-h-screen bg-black text-white p-6">
      <header className="flex items-center mb-8 relative">
        <Link href="/dashboard" className="absolute left-0 p-2 -ml-2 text-zinc-400 hover:text-white transition-colors">
          <ArrowLeft className="w-6 h-6" />
        </Link>
        <h1 className="text-xl font-bold text-center w-full">
          {showFastRenewal ? 'Renovar tu suscripción' : 'Elige tu Plan'}
        </h1>
      </header>

      {showFastRenewal ? (
        <div className="space-y-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex flex-col gap-4 relative overflow-hidden shadow-xl">
            <div className="absolute -right-10 -top-10 bg-[#02D7E5]/5 w-32 h-32 rounded-full blur-2xl pointer-events-none"></div>
            
            <h3 className="text-zinc-400 text-sm font-medium tracking-wide uppercase">Tu Plan Actual</h3>
            
            <div className="flex justify-between items-start z-10">
              <div>
                <h2 className="text-2xl font-bold uppercase tracking-wide text-white">{currentPlan.nombre}</h2>
                <p className="text-sm text-zinc-400 mt-1">{currentPlan.tipo === 'SESIONES' ? `${currentPlan.sesiones_total} Sesiones` : 'Ilimitado'} / Mes</p>
              </div>
              <div className="text-right">
                <span className="text-2xl font-black text-[#02D7E5]">${currentPlan.precio_usd}</span>
              </div>
            </div>

            <div className="z-10 mt-4 space-y-3">
              <Link 
                href={`/dashboard/checkout?plan_id=${currentPlan.id}`}
                className="w-full py-4 bg-[#02D7E5] hover:bg-[#02D7E5]/90 text-black font-extrabold rounded-xl transition-all shadow-[0_0_15px_rgba(2,215,229,0.15)] flex items-center justify-center gap-2 text-lg"
              >
                Continuar con este plan <CheckCircle2 className="w-5 h-5" />
              </Link>
              
              <Link
                href="?cambiar=true"
                className="w-full py-3 bg-transparent text-zinc-400 hover:text-white font-medium rounded-xl transition-colors flex items-center justify-center"
              >
                Quiero cambiar de plan
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <>
          {!sedeId && (
        <div className="bg-red-900/30 border border-red-500/50 rounded-xl p-4 text-center">
          <p className="text-red-200 text-sm">
            Error: No tienes una sede asignada. Por favor, contacta a soporte.
          </p>
        </div>
      )}

      {sedeId && planesDisponibles.length === 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
          <p className="text-zinc-400 text-sm">
            No hay planes disponibles en tu sede actualmente.
          </p>
        </div>
      )}

      <div className="space-y-4 pb-20">
        {planesDisponibles.map((plan) => (
          <div 
            key={plan.id}
            className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex flex-col gap-4 relative overflow-hidden"
          >
            {/* Decal Background */}
            <div className="absolute -right-10 -top-10 bg-[#02D7E5]/5 w-32 h-32 rounded-full blur-2xl pointer-events-none"></div>

            <div className="flex justify-between items-start z-10">
              <div>
                <h2 className="text-lg font-bold uppercase tracking-wide text-white">{plan.nombre}</h2>
                <p className="text-xs text-zinc-400 mt-1">{plan.tipo === 'SESIONES' ? `${plan.sesiones_total} Sesiones` : 'Ilimitado'} / Mes</p>
              </div>
              <div className="text-right">
                <span className="text-xl font-black text-[#02D7E5]">${plan.precio_usd}</span>
              </div>
            </div>

            <div className="z-10 mt-2">
              <Link 
                href={`/dashboard/checkout?plan_id=${plan.id}`}
                className="w-full py-3 bg-transparent border-2 border-[#02D7E5] hover:bg-[#02D7E5]/10 text-[#02D7E5] font-bold rounded-xl transition-colors flex items-center justify-center"
              >
                Seleccionar
              </Link>
            </div>
          </div>
        ))}
        </div>
        </>
      )}
    </main>
  )
}
