import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function proxy(request: NextRequest) {
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
      // 1. Fetch de rol del usuario
      const { data: usuarioCrudo, error } = await supabase
        .from('usuarios')
        .select('rol')
        .eq('id', user.id)
        .single()

      if (error) {
        console.log("[MIDDLEWARE ERROR] Fallo al leer usuario en admin:", error)
      }

      const rol = (usuarioCrudo?.rol || '').toUpperCase()
      const isStaff = ['SUPERADMIN', 'GERENTE', 'GERENTE_SEDE', 'RECEPCIONISTA', 'RECEPCION'].includes(rol)

      // 1. Validación estricta: Si es ATLETA o no tiene rol de staff, expulsarlo inmediatamente
      if (!isStaff) {
        url.pathname = rol === 'ATLETA' ? '/dashboard' : '/login'
        return NextResponse.redirect(url)
      }

      // 2. Si está autenticado como staff e intenta acceder a /admin/login
      if (isAdminLogin) {
        url.pathname = '/admin/dashboard'
        return NextResponse.redirect(url)
      }

      // 3. Doble protección de rutas de alta gerencia: /admin/finanzas y /admin/kpis
      const isHighManagementRoute = pathname.startsWith('/admin/finanzas') || pathname.startsWith('/admin/kpis')
      const isHighManagementRole = ['SUPERADMIN', 'GERENTE', 'GERENTE_SEDE'].includes(rol)

      if (isHighManagementRoute && !isHighManagementRole) {
        // Recepción y otros roles de staff son redirigidos a su panel principal
        url.pathname = '/admin/dashboard'
        return NextResponse.redirect(url)
      }

      // 4. Protección estricta de /admin/configuracion: Únicamente SUPERADMIN
      const isConfiguracionRoute = pathname.startsWith('/admin/configuracion')
      if (isConfiguracionRoute && rol !== 'SUPERADMIN') {
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
