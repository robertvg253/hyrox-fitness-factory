import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { registrarEvento } from '@/src/services/logger'
import { procesarRenovacion } from '@/src/services/subscription-engine'

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Log en la consola del servidor (Vercel)
    console.log('[Webhook R4 Crudo]:', JSON.stringify(body));

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. Guardar en la tabla webhooks_log
    const { error: logError } = await supabase
      .from('webhooks_log')
      .insert({
        origen: 'r4',
        payload: body,
        processed: false
      });

    if (logError) {
      console.error('[Webhook R4] Error guardando log en BD:', logError);
    }

    // -----------------------------------------------------------------------
    // PROCESAMIENTO PRINCIPAL DE LA ORDEN Y SUSCRIPCIÓN
    // -----------------------------------------------------------------------
    const status = body?.status?.toLowerCase();
    const transactionId = body?.transaction_id || body?.reference;
    
    if (transactionId && status === 'approved') {
      // 2. Buscar la orden de cobro vinculada a este transaction_id
      const { data: orden, error: ordenError } = await supabase
        .from('ordenes_cobro')
        .select('id, estado, suscripcion_id, metadata, monto')
        .eq('r4_transaction_id', String(transactionId))
        .single();

      if (ordenError || !orden) {
        console.error(`[Webhook R4] Orden no encontrada para transaction_id ${transactionId}:`, ordenError?.message);
      } else if (orden.estado === 'PENDIENTE' || orden.estado === 'ENVIADO') {
        
        // 3. Actualizar la Orden a PAGADA
        const currentMetadata = typeof orden.metadata === 'object' && orden.metadata !== null ? orden.metadata : {};
        const { error: updateOrdenError } = await supabase
          .from('ordenes_cobro')
          .update({
            estado: 'PAGADA',
            r4_bank_reference: body.bank_reference || null,
            metadata: { 
              ...currentMetadata,
              bank: body.bank,
              exchange_rate: body.exchange_rate,
              webhook_processed_at: new Date().toISOString() 
            }
          })
          .eq('id', orden.id);

        if (updateOrdenError) {
          console.error(`[Webhook R4] Error actualizando orden ${orden.id}:`, updateOrdenError.message);
        } else {
          console.log(`[Webhook R4] Orden ${orden.id} actualizada a PAGADA.`);
          
          await registrarEvento('ordenes_cobro', orden.id, 'PAGO_APROBADO', {
            transaction_id: transactionId,
            bank_reference: body.bank_reference
          });

          // 4. Ejecución del Time-Stacking o Activación Inicial
          if (orden.suscripcion_id) {
            const { data: sub } = await supabase.from('suscripciones').select('estado').eq('id', orden.suscripcion_id).single()
            
            if (sub && sub.estado === 'INACTIVO') {
              const fechaCorte = new Date()
              fechaCorte.setUTCMonth(fechaCorte.getUTCMonth() + 1)
              
              await supabase.from('suscripciones').update({ 
                estado: 'ACTIVO',
                fecha_corte: fechaCorte.toISOString()
              }).eq('id', orden.suscripcion_id)

              console.log(`[Webhook R4] Suscripción ${orden.suscripcion_id} activada exitosamente tras cobro móvil.`)
            } else {
              const montoUsd = Number(orden.monto);
              const tasaR4 = Number(body.exchange_rate) || 1; // Ajustar dependiendo del formato de R4
              const montoPagadoVes = Number(body.amount?.value || body.amount) || (montoUsd * tasaR4); // Extraer pago real VES

              await procesarRenovacion(
                orden.id,
                orden.suscripcion_id,
                montoUsd,
                tasaR4,
                montoPagadoVes
              );
            }
          }

          // 5. Marcar Webhook como procesado
          await supabase
            .from('webhooks_log')
            .update({ processed: true })
            .eq('payload->>transaction_id', transactionId);
        }
      } else {
        console.log(`[Webhook R4] La orden ${orden.id} ya no está PENDIENTE/ENVIADO (Estado actual: ${orden.estado}). Ignorando.`);
      }
    } else if (transactionId && (status === 'failed' || status === 'rejected' || status === 'error')) {
      const { data: orden, error: ordenError } = await supabase
        .from('ordenes_cobro')
        .select('id, estado, metadata')
        .eq('r4_transaction_id', String(transactionId))
        .single();
        
      if (!ordenError && orden && (orden.estado === 'PENDIENTE' || orden.estado === 'ENVIADO')) {
        const currentMetadata = typeof orden.metadata === 'object' && orden.metadata !== null ? orden.metadata : {};
        await supabase.from('ordenes_cobro').update({
          estado: 'RECHAZADA',
          metadata: { ...currentMetadata, webhook_error: body.status_message || body.message || 'Error en R4' }
        }).eq('id', orden.id);
        console.log(`[Webhook R4] Orden ${orden.id} rechazada por fallo en cobro móvil.`);
        
        await supabase.from('webhooks_log').update({ processed: true }).eq('payload->>transaction_id', transactionId);
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
