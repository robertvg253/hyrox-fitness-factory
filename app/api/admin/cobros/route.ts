import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { emitirCobroR4 } from '@/src/services/r4-service'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { usuario_id, monto, sede_id } = body

    if (!usuario_id || !monto || !sede_id) {
      return NextResponse.json({ error: 'Faltan datos requeridos (usuario_id, monto, sede_id)' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Consultar usuario y sus suscripciones
    const { data: usuario, error: userErr } = await supabase
      .from('usuarios')
      .select(`
        nombre_completo,
        cedula_rif,
        telefono,
        sede_id,
        suscripciones (
          id,
          estado,
          created_at
        )
      `)
      .eq('id', usuario_id)
      .single()

    if (userErr || !usuario) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }

    if (usuario.sede_id !== sede_id) {
      return NextResponse.json({ error: 'El usuario no pertenece a la sede activa del panel administrativo' }, { status: 403 })
    }

    if (!usuario.telefono || !usuario.cedula_rif) {
      return NextResponse.json({ error: "El usuario no tiene un número de teléfono o cédula registrado." }, { status: 400 })
    }

    // Buscar la suscripción activa, si no la última, si no null
    const suscripciones = Array.isArray(usuario.suscripciones) ? usuario.suscripciones : []
    
    // Ordenar descendente por created_at para tener la más reciente de primera
    suscripciones.sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
    
    const suscripcionActiva = suscripciones.find((s: any) => s.estado?.toUpperCase() === 'ACTIVO')
    const suscripcionIdFinal = suscripcionActiva?.id || suscripciones[0]?.id || null

    // 1. Insertar orden PENDIENTE
    const { data: nuevaOrden, error: ordenErr } = await supabase
      .from('ordenes_cobro')
      .insert({
        usuario_id,
        suscripcion_id: suscripcionIdFinal,
        monto: Number(monto),
        moneda: 'USD',
        estado: 'PENDIENTE',
        metadata: { origin: 'admin-panel', timestamp: new Date().toISOString() },
      })
      .select('id')
      .single()

    if (ordenErr || !nuevaOrden?.id) {
      return NextResponse.json({ error: 'Error creando la orden de cobro' }, { status: 500 })
    }

    const orderId = nuevaOrden.id

    // 2. Llamar al servicio R4
    const r4Result = await emitirCobroR4({
      monto: Number(monto),
      nombre: usuario.nombre_completo,
      cedula: usuario.cedula_rif,
      telefono: usuario.telefono,
      order_id: orderId,
    })

    // 3. Actualizar orden
    if (r4Result.success) {
      await supabase
        .from('ordenes_cobro')
        .update({
          estado: 'ENVIADO',
          r4_transaction_id: r4Result.instruction_id ?? null,
          metadata: {
            origin: 'admin-panel',
            r4_raw: r4Result.raw,
            timestamp: new Date().toISOString(),
          },
        })
        .eq('id', orderId)

      return NextResponse.json({
        ok: true,
        message: 'Cobro emitido exitosamente',
        order_id: orderId,
      })
    } else {
      await supabase
        .from('ordenes_cobro')
        .update({
          estado: 'ERROR',
          metadata: {
            origin: 'admin-panel',
            r4_error: r4Result.error,
            r4_raw: r4Result.raw,
            timestamp: new Date().toISOString(),
          },
        })
        .eq('id', orderId)

      return NextResponse.json({ error: 'Error del servicio de pagos R4', details: r4Result.error }, { status: 502 })
    }
  } catch (error: any) {
    console.error('[admin/cobros] Error:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
