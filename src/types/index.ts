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
