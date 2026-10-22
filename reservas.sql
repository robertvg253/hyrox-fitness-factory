-- ==============================================================================
-- SISTEMA DE CONTROL DE CUPOS CONCURRENTES Y RESERVA ATÓMICA PARA HYROX
-- ==============================================================================
-- Este script crea la tabla de reservas temporales con TTL (10 minutos)
-- y la función RPC atómica 'reservar_cupo' protegida con PostgreSQL advisory locks
-- para garantizar que ante alto tráfico concurrente no exista overbooking.
-- ==============================================================================

-- 1. Crear tabla de reservas temporales
CREATE TABLE IF NOT EXISTS public.reservas_temporales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cedula TEXT UNIQUE NOT NULL,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expira_en TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '10 minutes')
);

-- Índices de alto rendimiento para búsquedas concurrentes y limpieza por tiempo
CREATE INDEX IF NOT EXISTS idx_reservas_temporales_cedula ON public.reservas_temporales(cedula);
CREATE INDEX IF NOT EXISTS idx_reservas_temporales_expira_en ON public.reservas_temporales(expira_en);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.reservas_temporales ENABLE ROW LEVEL SECURITY;

-- Política de RLS: Acceso total para service_role
DROP POLICY IF EXISTS "Permitir gestión completa a service_role" ON public.reservas_temporales;
CREATE POLICY "Permitir gestión completa a service_role"
  ON public.reservas_temporales
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 2. Función RPC Atómica: reservar_cupo
-- Parámetros:
--   p_cedula: Cédula del atleta que inicia el proceso de registro
--   p_limite: Número máximo de cupos permitidos en la competición
-- Retorna:
--   TRUE  -> Cupo reservado con éxito por 10 minutos (o renovado)
--   FALSE -> Cupos agotados (la suma de usuarios + reservas activas >= límite)
CREATE OR REPLACE FUNCTION public.reservar_cupo(p_cedula TEXT, p_limite INT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cedula_limpia TEXT;
  v_usuarios_count INT;
  v_reservas_count INT;
  v_total INT;
BEGIN
  -- Normalización de cédula: eliminar espacios, puntos, guiones y pasar a mayúsculas
  v_cedula_limpia := UPPER(REGEXP_REPLACE(TRIM(p_cedula), '[\s\-\.]', '', 'g'));

  IF v_cedula_limpia IS NULL OR v_cedula_limpia = '' THEN
    RETURN FALSE;
  END IF;

  -- Bloqueo transaccional advisory lock en PostgreSQL (ID numérico único 742918365).
  -- Esto serializa las invocaciones concurrentes a nivel de base de datos durante la transacción,
  -- eliminando cualquier posibilidad de condiciones de carrera (race conditions) ante cientos de peticiones simultáneas.
  PERFORM pg_advisory_xact_lock(742918365);

  -- Si el atleta ya existe en public.usuarios, permitir acceso (no consume cupo adicional)
  IF EXISTS (
    SELECT 1 FROM public.usuarios 
    WHERE UPPER(REGEXP_REPLACE(cedula, '[\s\-\.]', '', 'g')) = v_cedula_limpia
  ) THEN
    RETURN TRUE;
  END IF;

  -- 1. Contar usuarios registrados actualmente
  SELECT COUNT(*) INTO v_usuarios_count
  FROM public.usuarios;

  -- 2. Contar reservas temporales activas (expira_en > NOW).
  -- Excluimos la propia cédula si ya tenía una reserva activa (para permitirle renovar su ventana de 10 min)
  -- y excluimos cédulas que ya se convirtieron en usuarios para evitar doble conteo.
  SELECT COUNT(*) INTO v_reservas_count
  FROM public.reservas_temporales
  WHERE expira_en > NOW()
    AND cedula <> v_cedula_limpia
    AND cedula NOT IN (
      SELECT UPPER(REGEXP_REPLACE(cedula, '[\s\-\.]', '', 'g')) 
      FROM public.usuarios 
      WHERE cedula IS NOT NULL
    );

  v_total := v_usuarios_count + v_reservas_count;

  -- 3. Si la suma alcanza o supera el límite establecido, rechazar la reserva
  IF v_total >= p_limite THEN
    RETURN FALSE;
  END IF;

  -- 4. Hay cupo disponible: insertar nueva reserva o renovar expiración a 10 minutos
  INSERT INTO public.reservas_temporales (cedula, creado_en, expira_en)
  VALUES (v_cedula_limpia, NOW(), NOW() + INTERVAL '10 minutes')
  ON CONFLICT (cedula)
  DO UPDATE SET expira_en = NOW() + INTERVAL '10 minutes';

  RETURN TRUE;
END;
$$;

-- Otorgar permisos de ejecución al RPC para roles de Supabase
GRANT EXECUTE ON FUNCTION public.reservar_cupo(TEXT, INT) TO anon, authenticated, service_role;
