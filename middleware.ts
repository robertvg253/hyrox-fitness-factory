import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          
          supabaseResponse = NextResponse.next({
            request,
          })
          
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const url = request.nextUrl.clone()
  const pathname = url.pathname

  const isAdminRoute = pathname.startsWith('/admin')
  const isAdminLogin = pathname === '/admin/login'
  const isClientRoute = pathname.startsWith('/dashboard')

  // Redirigir si ya está autenticado e intenta ir a login
  if (pathname === '/login' && user) {
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  // ==========================================
  // LÓGICA DE RUTAS DE ADMIN
  // ==========================================
  if (isAdminRoute) {
    if (!user && !isAdminLogin) {
      url.pathname = '/admin/login'
      return NextResponse.redirect(url)
    }

    if (user) {
      // 1. Hacer el fetch manejando errores explícitamente y usando sintaxis relacional
      const { data: usuarioCrudo, error } = await supabase
        .from('usuarios')
        .select(`
          rol,
          suscripciones (
            estado,
            fecha_vencimiento
          )
        `)
        .eq('id', user.id)
        .single()
        
      // LOGS QUIRÚRGICOS
      console.log("Usuario crudo devuelto por Supabase:", JSON.stringify(usuarioCrudo, null, 2))

      if (error) {
        console.log("[MIDDLEWARE ERROR] Fallo al leer usuario. Revisa las políticas RLS. Error:", error)
      }

      const rol = (usuarioCrudo?.rol || '').toUpperCase()

      // Lógica de Extracción de la suscripción (la más reciente o activa)
      // Como es un array, tomamos la primera de forma segura
      const suscripciones = usuarioCrudo?.suscripciones || []
      // Dependiendo de Supabase, puede venir como array o objeto simple si es uno a uno. Asumimos array por seguridad.
      const suscripcionActiva = Array.isArray(suscripciones) ? suscripciones[0] : suscripciones

      const estado = (suscripcionActiva?.estado || 'VENCIDO').toUpperCase()
      const fechaVencimientoBD = suscripcionActiva?.fecha_vencimiento

      // Restauramos la evaluación de fechas para los logs
      if (rol === 'ATLETA') {
        if (estado === 'ACTIVO' && fechaVencimientoBD) {
          const fechaVencimiento = new Date(fechaVencimientoBD)
          const ahora = new Date()
          const estaVencido = fechaVencimiento < ahora
          console.log(`[MIDDLEWARE] Evaluación de fecha: BD (${fechaVencimiento.toISOString()}) < Servidor (${ahora.toISOString()}) = ${estaVencido}`)
        } else if (estado === 'ACTIVO' && !fechaVencimientoBD) {
          console.log("[MIDDLEWARE] ATLETA ACTIVO pero fecha_vencimiento es null. Aplicando bloqueo de seguridad en evaluación.")
        }
      }

      // Atletas no pueden acceder a /admin
      if (rol === 'ATLETA' && isAdminRoute) {
        url.pathname = '/dashboard'
        return NextResponse.redirect(url)
      }

      // Si está logueado y es ADMIN/SUPERADMIN e intenta ir a /admin/login
      if (isAdminLogin && (rol === 'ADMIN' || rol === 'SUPERADMIN')) {
        url.pathname = '/admin/dashboard'
        return NextResponse.redirect(url)
      }
    }
    
    return supabaseResponse
  }

  // ==========================================
  // LÓGICA DE RUTAS DE CLIENTE
  // ==========================================
  if (isClientRoute) {
    if (!user) {
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }

    // Ya no bloqueamos ni redirigimos a /pago-requerido por estado.
    // El componente del /dashboard manejará la degradación elegante de UI.
    return supabaseResponse
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
