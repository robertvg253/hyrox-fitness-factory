"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2, Dumbbell, AlertCircle, MapPin, Pencil, Trash2, X } from "lucide-react";
// Asegúrate de que esta ruta coincida con tu cliente de navegador de Supabase
import { createClient } from "@/src/utils/supabase/client";
import { useTenant } from "../components/TenantProvider";

const formSchema = z.object({
  nombre: z.string().min(2, { message: "El nombre debe tener al menos 2 caracteres" }),
  duracion_minutos: z.coerce
    .number()
    .int()
    .positive({ message: "La duración debe ser mayor a 0" }),
  color_hex: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, { message: "Color hexadecimal inválido" }).default("#06b6d4"),
});

type FormValues = z.infer<typeof formSchema>;

interface Disciplina {
  id: string;
  nombre: string;
  duracion_minutos: number;
  color_hex: string;
  sede_id: string;
  sedes?: {
    nombre: string;
  };
}

export default function DisciplinasPage() {
  const { activeSede } = useTenant();
  const [disciplinas, setDisciplinas] = useState<Disciplina[]>([]);
  const [isFetching, setIsFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const supabase = createClient();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      nombre: "",
      duracion_minutos: "" as unknown as number,
      color_hex: "#06b6d4",
    },
  });

  const colorHexValue = watch("color_hex");
  const colorOptions = ["#06b6d4", "#10b981", "#f59e0b", "#f43f5e", "#8b5cf6", "#ec4899"];

  const fetchData = async () => {
    if (!activeSede) return;
    
    setIsFetching(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from("disciplinas")
        .select("*, sedes(nombre)")
        .eq("sede_id", activeSede.id)
        .order("created_at", { ascending: false });

      if (fetchError) throw fetchError;

      setDisciplinas(data || []);
    } catch (err: any) {
      setError(err.message || "Error al cargar los datos");
    } finally {
      setIsFetching(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeSede?.id]);

  const handleDelete = async (id: string) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar esta disciplina?')) return;
    
    try {
      const { error } = await supabase.from('disciplinas').delete().eq('id', id);
      if (error) throw error;
      setDisciplinas(prev => prev.filter(d => d.id !== id));
    } catch (err: any) {
      setError(err.message || 'Error al eliminar la disciplina');
    }
  };

  const handleEdit = (disciplina: Disciplina) => {
    setEditingId(disciplina.id);
    setValue('nombre', disciplina.nombre);
    setValue('duracion_minutos', disciplina.duracion_minutos);
    setValue('color_hex', disciplina.color_hex || '#06b6d4');
    setIsDrawerOpen(true);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setIsDrawerOpen(false);
    reset({ nombre: "", duracion_minutos: "" as unknown as number, color_hex: "#06b6d4" });
  };

  const onSubmit = async (values: FormValues) => {
    if (!activeSede) {
      setError("No hay una sede activa seleccionada");
      return;
    }
    
    setError(null);
    try {
      if (editingId) {
        const { error } = await supabase
          .from("disciplinas")
          .update({
            nombre: values.nombre,
            duracion_minutos: values.duracion_minutos,
            color_hex: values.color_hex,
            sede_id: activeSede.id,
          })
          .eq("id", editingId);

        if (error) throw error;
      } else {
        const { error } = await supabase.from("disciplinas").insert([
          {
            nombre: values.nombre,
            duracion_minutos: values.duracion_minutos,
            color_hex: values.color_hex,
            sede_id: activeSede.id,
          },
        ]);

        if (error) throw error;
      }
      
      setEditingId(null);
      setIsDrawerOpen(false);
      reset({ nombre: "", duracion_minutos: "" as unknown as number, color_hex: "#06b6d4" });
      await fetchData();

    } catch (err: any) {
      setError(err.message || "Error al guardar la disciplina");
    }
  };

  return (
    <div className="min-h-screen p-6 lg:p-12 text-white">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header Reestructurado */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-wide mb-2">Catálogo de Disciplinas</h1>
            <p className="text-gray-400">Gestiona las clases y disciplinas que ofrece el centro para la sede activa.</p>
          </div>
          <button
            onClick={() => setIsDrawerOpen(true)}
            disabled={!activeSede}
            className="bg-[#02D7E5] hover:bg-[#02b8c4] text-black font-semibold py-2.5 px-6 rounded-lg transition-all shadow-[0_0_15px_rgba(2,215,229,0.3)] hover:shadow-[0_0_25px_rgba(2,215,229,0.5)] whitespace-nowrap flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            + Nueva Disciplina
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg backdrop-blur-xl">
            <AlertCircle className="w-5 h-5" />
            <p>{error}</p>
          </div>
        )}

        {/* Tabla de Datos a Ancho Completo */}
        <div className="bg-white/5 border border-white/10 backdrop-blur-2xl shadow-2xl rounded-2xl overflow-hidden h-full min-h-[400px]">
          
          <div className="p-6 border-b border-white/5 flex justify-between items-center">
            <h2 className="text-xl font-bold">Disciplinas Activas - {activeSede?.nombre || "Sin Sede"}</h2>
            {isFetching && <Loader2 className="w-5 h-5 text-[#02D7E5] animate-spin" />}
          </div>

          <div className="p-0">
            {!isFetching && disciplinas.length === 0 ? (
              <div className="p-12 flex flex-col items-center justify-center text-gray-500 h-[300px]">
                <Dumbbell className="w-12 h-12 mb-4 opacity-50" />
                <p className="text-lg">No hay disciplinas registradas en esta sede</p>
                <p className="text-sm">Agrega una nueva usando el botón superior.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/5 bg-black/20">
                      <th className="py-4 px-6 text-sm font-medium text-gray-400 uppercase tracking-wider">Nombre</th>
                      <th className="py-4 px-6 text-sm font-medium text-gray-400 uppercase tracking-wider text-right">Duración</th>
                      <th className="py-4 px-6 text-sm font-medium text-gray-400 uppercase tracking-wider text-right opacity-0 w-24">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {disciplinas.map((disciplina) => (
                      <tr key={disciplina.id} className="hover:bg-white/[0.02] transition-colors group">
                        <td className="py-4 px-6 font-medium">
                          <div className="flex items-center gap-3">
                            <div 
                              className="w-3 h-3 rounded-full shrink-0" 
                              style={{ backgroundColor: disciplina.color_hex || '#06b6d4', boxShadow: `0 0 8px ${disciplina.color_hex || '#06b6d4'}80` }} 
                            />
                            <div>
                              {disciplina.nombre}
                              <div className="flex items-center text-xs text-gray-500 font-normal mt-1">
                                <MapPin className="w-3 h-3 mr-1" />
                                {disciplina.sedes?.nombre || "Sin Sede"}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-6 text-right text-gray-400">
                          {disciplina.duracion_minutos} min
                        </td>
                        <td className="py-4 px-6 text-right">
                          <div className="flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button type="button" onClick={() => handleEdit(disciplina)} title="Editar">
                              <Pencil className="w-4 h-4 text-white/40 hover:text-white transition-colors cursor-pointer" />
                            </button>
                            <button type="button" onClick={() => handleDelete(disciplina.id)} title="Eliminar">
                              <Trash2 className="w-4 h-4 text-white/40 hover:text-red-400 transition-colors cursor-pointer" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Drawer (Modal Lateral Derecho) */}
      <div 
        className={`fixed inset-0 z-40 transition-opacity duration-300 ${
          isDrawerOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Overlay oscuro */}
        <div 
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={cancelEdit}
        />
        
        {/* Panel Lateral */}
        <div 
          className={`absolute inset-y-0 right-0 w-full max-w-md bg-[#050505]/90 backdrop-blur-3xl border-l border-white/10 p-6 sm:p-8 shadow-2xl transform transition-transform duration-300 flex flex-col ${
            isDrawerOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          {/* Header del Drawer */}
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-xl font-bold">
              {editingId ? "Editar Disciplina" : "Nueva Disciplina"}
            </h2>
            <button 
              onClick={cancelEdit}
              className="p-2 text-white/50 hover:text-white transition-colors rounded-full hover:bg-white/5"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          {/* Formulario migrado al Drawer */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 flex-1 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
            
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Nombre
              </label>
              <input
                {...register("nombre")}
                type="text"
                placeholder="Ej. CrossTraining"
                className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#02D7E5] focus:border-transparent transition-all"
              />
              {errors.nombre && (
                <p className="text-red-400 text-xs mt-2">{errors.nombre.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Duración (minutos)
              </label>
              <input
                {...register("duracion_minutos")}
                type="number"
                placeholder="45"
                className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#02D7E5] focus:border-transparent transition-all"
              />
              {errors.duracion_minutos && (
                <p className="text-red-400 text-xs mt-2">{errors.duracion_minutos.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-3">
                Color Identificador
              </label>
              <div className="flex gap-3 flex-wrap">
                {colorOptions.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setValue("color_hex", color, { shouldValidate: true })}
                    className={`w-8 h-8 rounded-full cursor-pointer transition-all ${
                      colorHexValue === color 
                        ? "ring-2 ring-white ring-offset-2 ring-offset-[#050505] scale-110" 
                        : "hover:scale-110 opacity-70 hover:opacity-100"
                    }`}
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
              <input type="hidden" {...register("color_hex")} />
              {errors.color_hex && (
                <p className="text-red-400 text-xs mt-2">{errors.color_hex.message}</p>
              )}
            </div>

            <div className="pt-6 mt-auto">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-[#02D7E5] hover:bg-[#02b8c4] text-black font-semibold py-3 px-4 rounded-lg flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(2,215,229,0.3)] hover:shadow-[0_0_25px_rgba(2,215,229,0.5)]"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Guardando...
                  </>
                ) : editingId ? (
                  "Actualizar Disciplina"
                ) : (
                  "Guardar Disciplina"
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

    </div>
  );
}
