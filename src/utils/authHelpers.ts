import crypto from 'crypto'

export function generarIdentidadFantasma(cedula: string) {
  // Normalizar la cédula: quitar espacios, guiones y poner en mayúsculas
  const cedulaNormalizada = cedula.replace(/[\s-]/g, '').toUpperCase();
  
  // Usamos crypto.randomUUID() genérico de entorno Node
  const claveFicticia = `${crypto.randomUUID()}A1!`;
  const emailFicticio = `${cedulaNormalizada}@fitnessfactory.local`;

  return { emailFicticio, claveFicticia };
}
