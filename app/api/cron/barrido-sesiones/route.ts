import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: Request) {
  try {
    // 1. Protección del Cronjob (Autorización)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 2. Ejecutar la Lógica de Barrido
    const hoyISO = getCaracasMidnightUTC(0).toISOString();
    const hoyRealISO = new Date().toISOString();
    
    // Buscar todas las suscripciones que tengan el sello explícito vencido o igual a hoy
    // Supabase permite filtrar JSONB: metadata->>'recortar_sesiones_el' <= hoyISO
    const { data: suscripciones, error: fetchErr } = await supabaseAdmin
      .from('suscripciones')
      .select('id, metadata, planes(sesiones_total)')
      .lte("metadata->>'recortar_sesiones_el'", hoyRealISO);

    if (fetchErr) {
      console.error('[Cron] Error buscando suscripciones para barrido:', fetchErr.message);
      throw fetchErr;
    }

    let podados = 0;

    for (const sub of (suscripciones || [])) {
      const metadata = { ...sub.metadata };
      delete metadata.recortar_sesiones_el;
      
      const maxSesiones = sub.planes?.sesiones_total || 0;

      const { error: updateErr } = await supabaseAdmin
        .from('suscripciones')
        .update({ 
          sesiones_restantes: maxSesiones,
          metadata: metadata
        })
        .eq('id', sub.id);

      if (updateErr) {
        console.error(`[Cron] Error podando suscripcion ${sub.id}:`, updateErr.message);
      } else {
        podados++;
      }
    }

    return NextResponse.json({ 
      message: 'Barrido ejecutado exitosamente', 
      podados
    }, { status: 200 });

  } catch (error: any) {
    console.error('[Cron] Error en barrido de sesiones:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
