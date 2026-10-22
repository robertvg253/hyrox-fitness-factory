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

  // Redirigir si ya está autenticado e intenta ir a login de atleta
  if (pathname === '/login' && user) {
    const { data: usuario } = await supabase
      .from('usuarios')
      .select('rol')
      .eq('id', user.id)
      .maybeSingle()

    const rol = (usuario?.rol || '').toLowerCase().trim()
    url.pathname = rol === 'admin' ? '/admin/dashboard' : '/dashboard'
    return NextResponse.redirect(url)
  }

  // ==========================================
  // LÓGICA DE RUTAS DE ADMIN (/admin/:path*)
  // ==========================================
  if (isAdminRoute) {
    // 1. Si no está autenticado y no está en el login de admin, redirigir a /admin/login
    if (!user && !isAdminLogin) {
      url.pathname = '/admin/login'
      return NextResponse.redirect(url)
    }

    if (user) {
      // 2. Fetch del rol directamente en public.usuarios
      const { data: usuarioCrudo } = await supabase
        .from('usuarios')
        .select('rol')
        .eq('id', user.id)
        .maybeSingle()

      const rol = (usuarioCrudo?.rol || '').toLowerCase().trim()
      const esAdmin = rol === 'admin'

      // Si está en /admin/login y ya está logueado:
      if (isAdminLogin) {
        url.pathname = esAdmin ? '/admin/dashboard' : '/dashboard'
        return NextResponse.redirect(url)
      }

      // Si intenta acceder a cualquier ruta protegida de admin y NO es admin:
      if (!esAdmin) {
        url.pathname = '/dashboard'
        return NextResponse.redirect(url)
      }
    }

    return supabaseResponse
  }

  // ==========================================
  // LÓGICA DE RUTAS DE ATLETA (/dashboard)
  // ==========================================
  if (isClientRoute) {
    if (!user) {
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }

    return supabaseResponse
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
