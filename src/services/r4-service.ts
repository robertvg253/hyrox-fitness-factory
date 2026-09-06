/**
 * r4-service.ts
 * Servicio de comunicación con la pasarela bancaria R4 Conecta.
 * Todas las funciones aquí son Server-Side únicamente (Node.js / Route Handlers / Server Actions).
 * NO importar en componentes cliente ("use client").
 */
import { ProxyAgent } from 'undici';

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export interface R4CobroPayload {
  monto: number;
  nombre: string;
  cedula: string;
  telefono: string;
  order_id: string; // UUID de la tabla ordenes_cobro
}

export interface R4CobroResult {
  success: boolean;
  /** ID de instrucción retornado por R4 (para guardar en ordenes_cobro) */
  instruction_id?: string;
  /** Respuesta cruda de R4 para auditoría */
  raw?: unknown;
  error?: string;
}

// ---------------------------------------------------------------------------
// Helpers de configuración
// ---------------------------------------------------------------------------

function getR4Config() {
  const apiKey = process.env.R4_API_KEY;
  const apiUrl = process.env.R4_API_URL;
  const proxyUrl = process.env.DO_PROXY_URL;

  if (!apiKey || !apiUrl) {
    throw new Error(
      '[R4 Service] Variables de entorno R4_API_KEY o R4_API_URL no configuradas.'
    );
  }

  const dispatcher = proxyUrl ? new ProxyAgent(proxyUrl) : undefined;
  if (proxyUrl) {
    console.info('[R4 Service] Enrutando tráfico a través del proxy estático (***)');
  }

  // Normalizar: quitar barra final si existe
  return { apiKey, apiUrl: apiUrl.replace(/\/$/, ''), dispatcher };
}

// ---------------------------------------------------------------------------
// 1. Obtener token efímero
// ---------------------------------------------------------------------------

/**
 * Solicita un token Bearer efímero a la API de R4 Conecta.
 * El token tiene vida corta; se recomienda obtenerlo justo antes de cada operación.
 */
export async function getR4Token(): Promise<string> {
  const { apiKey, apiUrl, dispatcher } = getR4Config();

  const response = await fetch(`${apiUrl}/restapi/api/token/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ api_key: apiKey }),
    ...(dispatcher && { dispatcher }),
  } as RequestInit);

  if (!response.ok) {
    const body = await response.text().catch(() => '(sin cuerpo)');
    const err = `[R4 getR4Token] HTTP ${response.status}: ${body}`;
    console.error(err);
    throw new Error(err);
  }

  const json = await response.json();

  // R4 devuelve el token en json.access_token
  const token: string | undefined = json?.access_token;

  if (!token) {
    const err = `[R4 getR4Token] Respuesta inesperada — sin campo "access_token": ${JSON.stringify(json)}`;
    console.error(err);
    throw new Error(err);
  }

  return token;
}

// ---------------------------------------------------------------------------
// 2. Emitir Cobro Móvil
// ---------------------------------------------------------------------------

/**
 * Emite una instrucción de cobro móvil (C2P / Biopago) en R4 Conecta.
 *
 * @example
 * const result = await emitirCobroR4({
 *   monto: 50.00,
 *   nombre: 'Juan Pérez',
 *   cedula: '12345678',
 *   telefono: '04141234567',
 *   order_id: 'uuid-de-ordenes_cobro',
 * });
 */
export async function emitirCobroR4(payload: R4CobroPayload): Promise<R4CobroResult> {
  const { monto, nombre, cedula, telefono, order_id } = payload;

  try {
    const { apiUrl, dispatcher } = getR4Config();

    // Paso 1: token efímero
    const token = await getR4Token();

    // Paso 2: construir body según especificación R4
    const body = {
      client: {
        name: nombre,
        document: cedula,
        phone: telefono,
      },
      description: 'Mensualidad Reto Factory',
      amount: {
        value: monto,
        currency: 'USD',
      },
      metadata: {
        order_id,
      },
    };

    const response = await fetch(`${apiUrl}/restapi/api/instructions/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Idempotency-Key': order_id,
      },
      body: JSON.stringify(body),
      ...(dispatcher && { dispatcher }),
    } as RequestInit);

    const json = await response.json().catch(() => null);

    if (!response.ok) {
      const errMsg = `[R4 emitirCobroR4] HTTP ${response.status}: ${JSON.stringify(json)}`;
      console.error(errMsg, { payload, responseBody: json });
      return {
        success: false,
        raw: json,
        error: json?.detail ?? json?.message ?? `Error HTTP ${response.status}`,
      };
    }

    console.info('[R4 emitirCobroR4] Instrucción emitida exitosamente:', {
      order_id,
      instruction_id: json?.id,
    });

    return {
      success: true,
      instruction_id: json?.id ?? json?.instruction_id,
      raw: json,
    };

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[R4 emitirCobroR4] Error inesperado:', {
      message,
      // Ocultar datos sensibles del atleta en logs
      payload: { monto, nombre, cedula: '***', telefono: '***', order_id },
    });

    return {
      success: false,
      error: message,
    };
  }
}
