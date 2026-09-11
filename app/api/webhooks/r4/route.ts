import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Log en la consola del servidor (Vercel)
    console.log('[Webhook R4 Crudo]:', JSON.stringify(body));

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Guardar en la tabla webhooks_log
    const { error } = await supabase
      .from('webhooks_log')
      .insert({
        origen: 'r4',
        payload: body,
        processed: false
      });

    if (error) {
      console.error('[Webhook R4] Error guardando log en BD:', error);
    } else {
      // -----------------------------------------------------------------------
      // PROCESAMIENTO BASE DE LA ORDEN DE COBRO
      // -----------------------------------------------------------------------
      const status = body?.status?.toLowerCase();
      const orderId = body?.metadata?.order_id;
      // Extraemos el identificador interno de R4
      const r4TransactionId = body?.transaction_id || body?.reference;
      // Extraemos el recibo definitivo del banco
      const r4BankReference = body?.bank_reference;

      if (orderId && status === 'approved') {
        const { error: updateError } = await supabase
          .from('ordenes_cobro')
          .update({
            estado: 'APROBADO',
            r4_transaction_id: r4TransactionId || null,
            r4_bank_reference: r4BankReference || null,
            metadata: { 
              ...((body as any)?.metadata || {}), 
              webhook_processed_at: new Date().toISOString() 
            }
          })
          .eq('id', orderId)
          .eq('estado', 'PENDIENTE'); // Idempotencia: solo actualizar si estaba PENDIENTE

        if (updateError) {
          console.error(`[Webhook R4] Error actualizando la orden ${orderId}:`, updateError.message);
        } else {
          console.log(`[Webhook R4] Orden ${orderId} actualizada a APROBADO exitosamente.`);
          // Marcar el webhook como procesado
          await supabase.from('webhooks_log').update({ processed: true }).eq('payload->>transaction_id', r4TransactionId);
        }
      }
    }

    // Retorna de inmediato un status 200 OK para evitar reintentos por timeout
    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error('[Webhook R4] Error procesando notificación:', error);
    // Se recomienda devolver 200 incluso en errores de parseo para evitar bloqueos en la pasarela
    return NextResponse.json({ received: true }, { status: 200 });
  }
}
