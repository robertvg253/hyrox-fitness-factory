import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Cargar variables de entorno desde .env.local si no están en process.env
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...rest] = trimmed.split('=');
      const val = rest.join('=').replace(/^["']|["']$/g, '');
      if (key && !process.env[key]) {
        process.env[key] = val;
      }
    }
  });
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const MAX_CUPOS = parseInt(process.env.NEXT_PUBLIC_MAX_CUPOS || '3', 10);
const TOTAL_CONCURRENTE = 200;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Error: NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY no configurados.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false }
});

async function runStressTest() {
  console.log('\n================================================================');
  console.log('⚡ HYROX STRESS TEST: CONTROL DE CUPOS CONCURRENTES (200 REQS)');
  console.log('================================================================');
  console.log(`🎯 URL Supabase:       ${SUPABASE_URL}`);
  console.log(`🎯 Límite Configurado:  ${MAX_CUPOS} cupos`);
  console.log(`🎯 Peticiones en paralelo: ${TOTAL_CONCURRENTE}`);
  console.log('----------------------------------------------------------------');

  // 1. Limpieza previa de pruebas anteriores
  try {
    await supabase
      .from('reservas_temporales')
      .delete()
      .like('cedula', 'STRESS_%');
  } catch (cleanErr) {
    // Silencioso si la tabla aún no existe
  }

  // 2. Comprobar existencia del RPC
  const testRpc = await supabase.rpc('reservar_cupo', {
    p_cedula: 'STRESS_TEST_PROBE',
    p_limite: MAX_CUPOS
  });

  if (testRpc.error) {
    if (testRpc.error.code === 'PGRST202') {
      console.log('\n⚠️  ATENCIÓN: La función RPC "reservar_cupo" aún no existe en Supabase.');
      console.log('👉 Ejecuta el archivo "reservas.sql" en el SQL Editor de tu Dashboard de Supabase.');
      console.log('👉 Luego vuelve a ejecutar este test con: node scripts/stress-test.mjs\n');
      process.exit(0);
    } else {
      console.error('❌ Error probando RPC:', testRpc.error.message);
      process.exit(1);
    }
  }

  // Limpiar probe
  await supabase.from('reservas_temporales').delete().eq('cedula', 'STRESS_TEST_PROBE');

  // 3. Generar 200 cédulas únicas ficticias
  const cedulas = Array.from({ length: TOTAL_CONCURRENTE }, (_, i) => {
    return `STRESS_V${(i + 1).toString().padStart(3, '0')}`;
  });

  console.log(`\n🚀 Lanzando ${TOTAL_CONCURRENTE} peticiones concurrentes simultáneas con Promise.all...`);
  const inicio = performance.now();

  // 4. Invocación concurrente masiva
  const promesas = cedulas.map(async (cedula) => {
    try {
      const { data, error } = await supabase.rpc('reservar_cupo', {
        p_cedula: cedula,
        p_limite: MAX_CUPOS
      });

      return { cedula, reservado: data === true, error: error ? error.message : null };
    } catch (err) {
      return { cedula, reservado: false, error: err.message };
    }
  });

  const resultados = await Promise.all(promesas);
  const duracion = ((performance.now() - inicio) / 1000).toFixed(2);

  // 5. Análisis de resultados
  const exitosos = resultados.filter(r => r.reservado && !r.error);
  const rechazados = resultados.filter(r => !r.reservado && !r.error);
  const fallos = resultados.filter(r => r.error);

  console.log(`⏱️  Completado en:       ${duracion} segundos\n`);
  console.log('----------------------------------------------------------------');
  console.log('📊 RESULTADOS DE LA PRUEBA:');
  console.log(`   ✅ Cupos Otorgados:     ${exitosos.length} (esperado: ${MAX_CUPOS})`);
  console.log(`   ⛔ Cupos Rechazados:    ${rechazados.length} (esperado: ${TOTAL_CONCURRENTE - MAX_CUPOS})`);
  console.log(`   ⚠️ Errores de Conexión: ${fallos.length}`);
  console.log('----------------------------------------------------------------');

  if (exitosos.length === MAX_CUPOS && rechazados.length === (TOTAL_CONCURRENTE - MAX_CUPOS)) {
    console.log('🎉 VERIFICACIÓN EXITOSA:');
    console.log(`   El sistema atómico cortó EXACTAMENTE en ${MAX_CUPOS} cupos.`);
    console.log(`   Se evitaron ${rechazados.length} reservas por sobrecupo (0% Overbooking).`);
    console.log('   Cédulas ganadoras de cupo:');
    exitosos.forEach(r => console.log(`     - ${r.cedula}`));
  } else {
    console.warn('⚠️  DISCREPANCIA EN LOS RESULTADOS:');
    console.log(`   Se esperaba que se otorgaran exactamente ${MAX_CUPOS} cupos.`);
  }

  // 6. Limpieza final de datos de prueba
  await supabase
    .from('reservas_temporales')
    .delete()
    .like('cedula', 'STRESS_%');

  console.log('\n🧹 Datos de prueba limpiados de public.reservas_temporales.');
  console.log('================================================================\n');
}

runStressTest().catch(err => {
  console.error('Error fatal ejecutando stress test:', err);
  process.exit(1);
});
