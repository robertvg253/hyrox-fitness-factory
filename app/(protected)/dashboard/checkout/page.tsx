import { createClient } from '@/src/utils/supabase/server'
import { redirect } from 'next/navigation'
import CheckoutClient from '@/components/dashboard/CheckoutClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function CheckoutPage({
  searchParams
}: {
  searchParams: Promise<{ plan_id?: string }>
}) {
  const params = await searchParams
  const planId = params.plan_id

  if (!planId) {
    redirect('/dashboard/suscripcion/nueva')
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch plan
  const { data: plan, error: planError } = await supabase
    .from('planes')
    .select('*')
    .eq('id', planId)
    .single()

  if (planError || !plan) {
    redirect('/dashboard/suscripcion/nueva')
  }

  // Fetch user details
  const { data: userData, error: userError } = await supabase
    .from('usuarios')
    .select('id, nombre_completo, telefono, cedula_rif, sede_id')
    .eq('id', user.id)
    .single()

  if (userError || !userData) {
    redirect('/dashboard')
  }

  // Fetch metodos_pago from sede
  let metodosPago = null
  if (userData.sede_id) {
    const { data: sedeData } = await supabase
      .from('sedes')
      .select('metodos_pago')
      .eq('id', userData.sede_id)
      .single()
      
    if (sedeData?.metodos_pago) {
      metodosPago = sedeData.metodos_pago
    }
  }

  // Fetch latest order for this user and this plan
  let ordenPrevia = null
  const { data: latestOrder } = await supabase
    .from('ordenes_cobro')
    .select(`
      id, 
      estado, 
      created_at, 
      suscripciones!inner(plan_id)
    `)
    .eq('usuario_id', user.id)
    .eq('suscripciones.plan_id', planId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (latestOrder) {
    const isRecent = new Date().getTime() - new Date(latestOrder.created_at).getTime() < 24 * 60 * 60 * 1000;
    if (isRecent || latestOrder.estado === 'POR_CONCILIAR' || latestOrder.estado === 'PENDIENTE') {
      ordenPrevia = { id: latestOrder.id, estado: latestOrder.estado }
    }
  }

  return (
    <CheckoutClient 
      plan={plan}
      user={userData}
      metodosPago={metodosPago}
      ordenPrevia={ordenPrevia}
    />
  )
}
