import { getR4Config } from './r4-service';

// ---------------------------------------------------------------------------
// Estado en memoria
// ---------------------------------------------------------------------------

let cachedToken: string | null = null;
let tokenExpiresAt: number | null = null;

/**
 * Solicita un nuevo token Bearer a la API de R4 Conecta y lo cachea.
 * El token original dura 15 minutos.
 */
async function fetchNewToken(): Promise<string> {
  const { apiKey, apiUrl, dispatcher } = getR4Config();

  console.info('[R4 Token Manager] Solicitando un nuevo token a R4 Conecta...');

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
    const err = `[R4 Token Manager] HTTP ${response.status}: ${body}`;
    console.error(err);
    throw new Error(err);
  }

  const json = await response.json();

  // R4 devuelve el token en json.access_token
  const token: string | undefined = json?.access_token;

  if (!token) {
    const err = `[R4 Token Manager] Respuesta inesperada — sin campo "access_token": ${JSON.stringify(json)}`;
    console.error(err);
    throw new Error(err);
  }

  // Calculamos la expiración: 15 minutos en ms.
  // Restamos 2 minutos (120,000 ms) al tiempo de expiración como margen de seguridad.
  cachedToken = token;
  tokenExpiresAt = Date.now() + (15 * 60 * 1000) - (2 * 60 * 1000); 

  console.info(`[R4 Token Manager] Nuevo token cacheado exitosamente (Expira en ~13 min)`);

  return token;
}

/**
 * Devuelve un token válido de R4 Conecta.
 * Si hay uno cacheado con al menos 2 minutos de vigencia, retorna el cacheado.
 * De lo contrario, solicita uno nuevo.
 */
export async function getValidToken(): Promise<string> {
  const now = Date.now();

  // Si existe y la fecha actual es menor al tiempo de expiración (ya con el colchón de 2 min restado)
  if (cachedToken && tokenExpiresAt && now < tokenExpiresAt) {
    return cachedToken;
  }

  // De lo contrario, o no existe o ya caducó (o está en los últimos 2 minutos de vida)
  return await fetchNewToken();
}
