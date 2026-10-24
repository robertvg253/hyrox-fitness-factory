export type EstadoOrden = 
  | 'PENDIENTE'
  | 'ENVIADO'
  | 'APROBADO'
  | 'RECHAZADO'
  | 'EXPIRADO'
  | 'ERROR'
  | 'POR_CONCILIAR'
  | 'CANCELADO';

export type EstadoSuscripcion = 
  | 'ACTIVO'
  | 'INACTIVO'
  | 'CANCELADO';

export interface Suscripcion {
  id: string;
  usuario_id: string;
  plan_id: string;
  estado: EstadoSuscripcion;
  fecha_inicio?: string;
  fecha_corte?: string;
  sesiones_restantes?: number | null;
}

export interface Plan {
  id: string;
  nombre: string;
  precio_usd: number;
  sedes?: string[]; // UUIDs o nombres
  estado?: 'ACTIVO' | 'INACTIVO' | 'ARCHIVADO';
  tipo?: 'TIEMPO' | 'SESIONES';
  sesiones_total?: number | null;
}

export type MetodoPago = 
  | 'EFECTIVO'
  | 'ZELLE'
  | 'PAGO_MOVIL'
  | 'PUNTO_DE_VENTA'
  | 'TRANSFERENCIA'
  | 'COBRO_MOVIL'
  | 'MIXTO';

export interface MetadataOrden {
  origin?: string;
  timestamp?: string;
  r4_raw?: any;
  r4_error?: any;
  bank?: string;
  exchange_rate?: string | number;
  webhook_processed_at?: string;
  // Campos de conciliación y pago manual
  responsable_id?: string;
  responsable_nombre?: string;
  metodo_pago?: MetodoPago;
  referencia?: string;
  pagos_desglosados?: {
    metodo: MetodoPago;
    monto: number;
    titular?: string;
    banco?: string;
    referencia?: string;
  }[];
  fecha_corte_anterior?: string | Date;
  [key: string]: any; // Firma index para permitir flexilibidad (ej: metadata actual en Supabase)
}

// ============================================================================
// TIPOS HYROX: CATEGORÍAS, SIMULACIONES, EQUIPOS Y PREINSCRIPCIONES
// ============================================================================

export type TipoCategoria = 'individual' | 'dupla';

export interface Categoria {
  id: string;
  nombre: string;
  tipo: TipoCategoria;
  genero?: 'masculino' | 'femenino' | 'mixto' | string | null;
}

export interface SimulacionCategoria {
  simulacion_id: string;
  categoria_id: string;
  categorias?: Categoria;
}

export interface ParticipanteSimulacion {
  id: string;
  simulacion_id: string;
  usuario_id: string;
  dorsal?: string | null;
  heat_asignado?: string | null;
  salida_asignada?: string | null;
  promedio_previo_segundos?: number | null;
  tiempo_resultado_segundos?: number | null;
  asistio?: boolean | null;
  categoria_id?: string | null;
  partner_nombres?: string | null;
}

export interface Preinscripcion {
  id: string;
  email: string;
  nombres: string;
  categoria_id?: string | null;
  partner_email?: string | null;
  partner_nombres?: string | null;
  reclamado: boolean;
  creado_en?: string;
  telefono?: string | null;
  genero?: string | null;
  simulacion_id?: string | null;
  heat_asignado?: string | null;
  salida_asignada?: string | null;
}

export interface Simulacion {
  id: string;
  nombre: string;
  estado: 'PENDIENTE' | 'EN_CURSO' | 'FINALIZADA';
  tabla_liberada?: boolean;
  heats_liberados?: boolean;
  fecha_creacion?: string;
}

export interface TiempoHistorico {
  id?: string;
  usuario_id: string;
  numero_test: number;
  tiempo_segundos: number;
  creado_en?: string;
}

export interface TiempoPreinscrito {
  id?: string;
  email: string;
  numero_test: number;
  tiempo_segundos: number;
  creado_en?: string;
}

