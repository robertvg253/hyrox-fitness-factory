"use client";

import { useEffect, useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2, AlertCircle, Pencil, Trash2, X, User, Dumbbell, Clock, Star, Copy } from "lucide-react";
import { createClient } from "@/src/utils/supabase/client";
import { useTenant } from "../components/TenantProvider";

// Helper para Formato AM/PM
const formatAMPM = (date: Date) => {
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
};

// Zod Schema
const formSchema = z.object({
  tipo_clase: z.enum(["REGULAR", "ESPECIAL"]),
  disciplina_id: z.string().optional(),
  nombre_clase: z.string().optional(),
  instructor_id: z.string().optional().nullable(),
  fecha_base: z.string().optional(),
  hora_base: z.string().optional(),
  aforo_maximo: z.coerce
    .number()
    .int()
    .positive({ message: "El aforo debe ser mayor a 0" })
    .min(1, { message: "El aforo mínimo es 1" }),
}).superRefine((data, ctx) => {
  if (data.tipo_clase === "REGULAR" && (!data.disciplina_id || data.disciplina_id.trim() === "")) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Debes seleccionar una disciplina para una clase regular",
      path: ["disciplina_id"],
    });
  }
  if (data.tipo_clase === "ESPECIAL" && (!data.nombre_clase || data.nombre_clase.trim() === "")) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Debes escribir un nombre para la clase especial",
      path: ["nombre_clase"],
    });
  }
});

type FormValues = z.infer<typeof formSchema>;

interface Disciplina {
  id: string;
  nombre: string;
}

interface Instructor {
  id: string;
  nombre: string;
}

interface ClaseProgramada {
  id: string;
  sede_id: string;
  disciplina_id?: string | null;
  nombre_clase?: string | null;
  grupo_recurrencia_id?: string | null;
  instructor_id?: string | null;
  fecha_hora_inicio: string;
  aforo_maximo: number;
  disciplinas?: { nombre: string } | null;
  instructores?: { nombre: string } | null;
}

export default function CalendarioPage() {
  const { activeSede } = useTenant();
  const [clases, setClases] = useState<ClaseProgramada[]>([]);
  const [disciplinas, setDisciplinas] = useState<Disciplina[]>([]);
  const [instructores, setInstructores] = useState<Instructor[]>([]);
  
  const [isFetching, setIsFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [duplicatingRecurrenciaId, setDuplicatingRecurrenciaId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [viewingClase, setViewingClase] = useState<ClaseProgramada | null>(null);
  const [isDetailsDrawerOpen, setIsDetailsDrawerOpen] = useState(false);
  const [selectedDays, setSelectedDays] = useState<number[]>([]); 
  const [selectedHours, setSelectedHours] = useState<number[]>([]); 

  // Inline Delete State
  const [isDeletingMode, setIsDeletingMode] = useState(false);

  // Estados Vista Diaria y Semana
  const [currentView, setCurrentView] = useState<'semana' | 'dia'>('semana');
  const [currentDay, setCurrentDay] = useState<Date>(new Date());

  const supabase = createClient();

  const getStartOfWeek = (d: Date) => {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Lunes
    date.setDate(diff);
    date.setHours(0,0,0,0);
    return date;
  };
  const [currentWeekStart, setCurrentWeekStart] = useState(getStartOfWeek(new Date()));

  const nextPeriod = () => {
    if (currentView === 'semana') {
      const next = new Date(currentWeekStart);
      next.setDate(next.getDate() + 7);
      setCurrentWeekStart(next);
    } else {
      const next = new Date(currentDay);
      next.setDate(next.getDate() + 1);
      setCurrentDay(next);
    }
  };
  
  const prevPeriod = () => {
    if (currentView === 'semana') {
      const prev = new Date(currentWeekStart);
      prev.setDate(prev.getDate() - 7);
      setCurrentWeekStart(prev);
    } else {
      const prev = new Date(currentDay);
      prev.setDate(prev.getDate() - 1);
      setCurrentDay(prev);
    }
  };

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
      tipo_clase: "REGULAR",
      disciplina_id: "",
      nombre_clase: "",
      instructor_id: "",
      fecha_base: "",
      hora_base: "",
      aforo_maximo: "" as unknown as number,
    },
  });

  const watchTipoClase = watch("tipo_clase");

  const fetchData = async () => {
    if (!activeSede) return;

    setIsFetching(true);
    setError(null);
    try {
      const [clasesRes, disciplinasRes, instructoresRes] = await Promise.all([
        supabase
          .from("clases_programadas")
          .select("*, disciplinas(nombre), instructores(nombre)")
          .eq("sede_id", activeSede.id)
          .order("fecha_hora_inicio", { ascending: true }),
        supabase
          .from("disciplinas")
          .select("id, nombre")
          .eq("sede_id", activeSede.id)
          .order("nombre", { ascending: true }),
        supabase
          .from("instructores")
          .select("id, nombre")
          .eq("sede_id", activeSede.id) 
      ]);

      if (clasesRes.error) throw clasesRes.error;
      if (disciplinasRes.error) throw disciplinasRes.error;
      if (instructoresRes.error) throw instructoresRes.error;

      setClases(clasesRes.data || []);
      setDisciplinas(disciplinasRes.data || []);
      setInstructores(instructoresRes.data || []);
    } catch (err: any) {
      setError(err.message || "Error al cargar los datos.");
    } finally {
      setIsFetching(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeSede?.id]);

  const classesThisWeek = useMemo(() => {
    const endOfWeek = new Date(currentWeekStart);
    endOfWeek.setDate(endOfWeek.getDate() + 6);
    endOfWeek.setHours(23,59,59,999);

    return clases.filter((c) => {
      const d = new Date(c.fecha_hora_inicio);
      return d >= currentWeekStart && d <= endOfWeek;
    });
  }, [clases, currentWeekStart]);

  const confirmDelete = (clase: ClaseProgramada) => {
    setViewingClase(clase);
    setIsDeletingMode(true);
  };

  const executeDelete = async (type: 'single' | 'series', clase: ClaseProgramada) => {
    try {
      if (type === 'series' && clase.grupo_recurrencia_id) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        const tomorrowISO = tomorrow.toISOString();

        const { error } = await supabase
          .from('clases_programadas')
          .delete()
          .eq('grupo_recurrencia_id', clase.grupo_recurrencia_id)
          .gte('fecha_hora_inicio', tomorrowISO);
          
        if (error) throw error;
      } else {
        const { error } = await supabase.from('clases_programadas').delete().eq('id', clase.id);
        if (error) throw error;
      }
      
      setClases(prev => {
        if (type === 'series') {
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          tomorrow.setHours(0, 0, 0, 0);
          return prev.filter(c => {
            if (c.grupo_recurrencia_id === clase.grupo_recurrencia_id) {
               return new Date(c.fecha_hora_inicio) < tomorrow;
            }
            return true;
          });
        }
        return prev.filter(c => c.id !== clase.id);
      });
      
      setIsDeletingMode(false);
      cancelEdit();
      setIsDetailsDrawerOpen(false);
    } catch (err: any) {
      setError(err.message || 'Error al eliminar la clase');
    }
  };

  const handleEdit = (clase: ClaseProgramada) => {
    setEditingId(clase.id);
    setDuplicatingRecurrenciaId(null);
    
    if (clase.disciplina_id) {
      setValue('tipo_clase', 'REGULAR');
      setValue('disciplina_id', clase.disciplina_id);
      setValue('nombre_clase', '');
    } else {
      setValue('tipo_clase', 'ESPECIAL');
      setValue('disciplina_id', '');
      setValue('nombre_clase', clase.nombre_clase || '');
    }
    
    setValue('instructor_id', clase.instructor_id || '');
    setValue('aforo_maximo', clase.aforo_maximo);

    // Corrección de Zona Horaria (Local vs UTC)
    const localDate = new Date(clase.fecha_hora_inicio);
    const dateString = `${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(2, '0')}-${String(localDate.getDate()).padStart(2, '0')}`;
    const hourString = `${String(localDate.getHours()).padStart(2, '0')}:00`;
    
    setValue('fecha_base', dateString);
    setValue('hora_base', hourString);

    setSelectedDays([]); 
    setSelectedHours([]);
    setIsDrawerOpen(true);
  };

  const handleDuplicate = (clase: ClaseProgramada) => {
    setIsDetailsDrawerOpen(false);
    setEditingId(null);
    setDuplicatingRecurrenciaId(clase.grupo_recurrencia_id || null);
    
    if (clase.disciplina_id) {
      setValue('tipo_clase', 'REGULAR');
      setValue('disciplina_id', clase.disciplina_id);
      setValue('nombre_clase', '');
    } else {
      setValue('tipo_clase', 'ESPECIAL');
      setValue('disciplina_id', '');
      setValue('nombre_clase', clase.nombre_clase || '');
    }
    
    setValue('instructor_id', clase.instructor_id || '');
    setValue('aforo_maximo', clase.aforo_maximo);

    const localDate = new Date(clase.fecha_hora_inicio);
    const dateString = `${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(2, '0')}-${String(localDate.getDate()).padStart(2, '0')}`;
    const hourString = `${String(localDate.getHours()).padStart(2, '0')}:00`;
    
    setValue('fecha_base', dateString);
    setValue('hora_base', hourString);

    setSelectedDays([]);
    setSelectedHours([]);
    setIsDrawerOpen(true);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDuplicatingRecurrenciaId(null);
    setIsDrawerOpen(false);
    setIsDeletingMode(false);
    setSelectedDays([]);
    setSelectedHours([]);
    reset({ 
      tipo_clase: "REGULAR",
      disciplina_id: "", 
      nombre_clase: "",
      instructor_id: "", 
      fecha_base: "",
      hora_base: "",
      aforo_maximo: "" as unknown as number 
    });
  };

  const onSubmit = async (values: FormValues) => {
    if (!activeSede) {
      setError("No hay una sede activa seleccionada");
      return;
    }

    setError(null);
    try {
      const isRegular = values.tipo_clase === "REGULAR";
      const payloadInstructor = values.instructor_id && values.instructor_id.trim() !== "" ? values.instructor_id : null;

      // Validación para fecha y hora base (siempre requerida al editar o duplicar, o en especial)
      if (editingId || !isRegular || duplicatingRecurrenciaId) {
        if (!values.fecha_base || !values.hora_base) {
          setError("Debes seleccionar la fecha y hora de la clase");
          return;
        }
      }

      if (editingId) {
        const localDate = new Date(`${values.fecha_base}T${values.hora_base}:00`);
        const { error } = await supabase
          .from("clases_programadas")
          .update({
            disciplina_id: isRegular ? values.disciplina_id : null,
            nombre_clase: !isRegular ? values.nombre_clase : null,
            instructor_id: payloadInstructor,
            fecha_hora_inicio: localDate.toISOString(),
            aforo_maximo: values.aforo_maximo,
          })
          .eq("id", editingId);

        if (error) throw error;
      } else {
        let inserts = [];
        const uuidV4 = duplicatingRecurrenciaId || crypto.randomUUID(); // Usar serie origen si duplicamos
        
        if (isRegular && !duplicatingRecurrenciaId) {
          // Creación masiva
          const today = new Date();
          today.setHours(0,0,0,0);
          
          if (selectedDays.length === 0 || selectedHours.length === 0) {
            setError("Para una clase regular, debes seleccionar al menos un día y una hora.");
            return;
          }

          const MAX_DAYS = 28; 
          for (let i = 0; i < MAX_DAYS; i++) {
            const currentDate = new Date(today);
            currentDate.setDate(today.getDate() + i);
            
            if (selectedDays.includes(currentDate.getDay())) {
              for (const hour of selectedHours) {
                const classDate = new Date(currentDate);
                classDate.setHours(hour, 0, 0, 0);
                inserts.push({
                  sede_id: activeSede.id,
                  disciplina_id: values.disciplina_id,
                  nombre_clase: null,
                  instructor_id: payloadInstructor,
                  fecha_hora_inicio: classDate.toISOString(),
                  aforo_maximo: values.aforo_maximo,
                  grupo_recurrencia_id: uuidV4,
                });
              }
            }
          }
        } else {
          // Especial, o Duplicación
          const localDate = new Date(`${values.fecha_base}T${values.hora_base}:00`);
          inserts.push({
            sede_id: activeSede.id,
            disciplina_id: isRegular ? values.disciplina_id : null,
            nombre_clase: !isRegular ? values.nombre_clase : null,
            instructor_id: payloadInstructor,
            fecha_hora_inicio: localDate.toISOString(),
            aforo_maximo: values.aforo_maximo,
            grupo_recurrencia_id: duplicatingRecurrenciaId ? duplicatingRecurrenciaId : null,
          });
        }

        if (inserts.length > 0) {
          const { error } = await supabase.from("clases_programadas").insert(inserts);
          if (error) throw error;
        }
      }
      
      cancelEdit();
      await fetchData();

    } catch (err: any) {
      setError(err.message || "Error al guardar la clase programada");
    }
  };

  const daysOfWeek = [
    { label: "Lunes", short: "Lun", value: 1 },
    { label: "Martes", short: "Mar", value: 2 },
    { label: "Miércoles", short: "Mié", value: 3 },
    { label: "Jueves", short: "Jue", value: 4 },
    { label: "Viernes", short: "Vie", value: 5 },
    { label: "Sábado", short: "Sáb", value: 6 },
    { label: "Domingo", short: "Dom", value: 0 },
  ];

  const hours = Array.from({ length: 15 }, (_, i) => i + 6); // 6 AM a 20 PM

  const renderWeekCellClasses = (dayClasses: ClaseProgramada[]) => {
    const count = dayClasses.length;
    if (count === 0) return null;
  
    let gridClass = "w-full h-full p-[2px] ";
    if (count === 1) gridClass += "";
    else if (count === 2) gridClass += "grid grid-rows-2 gap-[2px]";
    else if (count === 3) gridClass += "grid grid-cols-2 grid-rows-2 gap-[2px]";
    else gridClass += "grid grid-cols-2 grid-rows-2 gap-[2px]";
  
    const displayCount = count > 4 ? 3 : count;
    const displayClasses = dayClasses.slice(0, displayCount);
    const hasMore = count > 4;
  
    return (
      <div className={gridClass}>
        {displayClasses.map((clase, idx) => {
          const isSpecial = !clase.disciplina_id && clase.nombre_clase;
          
          let cardClass = "bg-[#0a0a0a] rounded-md relative overflow-hidden transition-all cursor-pointer group flex flex-col justify-center ";
          
          if (isSpecial) cardClass += "hover:bg-amber-400/10 ";
          else cardClass += "hover:bg-[#02D7E5]/10 ";
  
          if (count === 1) {
            cardClass += "h-full w-full p-2 ";
          } else {
            cardClass += "p-1 ";
          }
  
          if (count === 3 && idx === 2) {
            cardClass += "col-span-2 ";
          }
  
          const showDetails = count === 1;
  
          return (
            <div 
              key={clase.id} 
              onClick={() => {
                setViewingClase(clase);
                setIsDetailsDrawerOpen(true);
              }}
              className={cardClass}
            >
              <div className={`absolute top-0 left-0 w-[3px] h-full ${isSpecial ? 'bg-amber-400' : 'bg-[#02D7E5]'}`} />
              
              <div className="absolute top-0.5 right-0.5 flex items-center gap-0.5 z-10">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEdit(clase);
                  }}
                  className="p-1 rounded-sm bg-white/5 text-white/40 hover:bg-white/20 hover:text-white transition-colors opacity-0 group-hover:opacity-100"
                  title="Editar Clase"
                >
                  <Pencil className={count > 1 ? "w-2.5 h-2.5" : "w-3.5 h-3.5"} />
                </button>
              </div>
  
              <p className={`font-bold truncate pl-1.5 pr-3 leading-tight ${showDetails ? 'text-xs mb-1' : 'text-[10px]'} ${isSpecial ? 'text-amber-400' : 'text-white'}`}>
                {isSpecial ? clase.nombre_clase : clase.disciplinas?.nombre}
              </p>
              
              {showDetails && (
                <>
                  <div className={`flex items-center text-[10px] mb-1 pl-1.5 ${isSpecial ? 'text-amber-400/80' : 'text-[#02D7E5]'}`}>
                    <Clock className="w-3 h-3 mr-1.5 opacity-70" />
                    {formatAMPM(new Date(clase.fecha_hora_inicio))}
                  </div>
                  
                  {clase.instructor_id && (
                    <div className="flex items-center text-[10px] text-gray-400 truncate pl-1.5 hidden sm:flex">
                      <User className="w-3 h-3 mr-1.5 opacity-70" />
                      {clase.instructores?.nombre || 'Sin asignar'}
                    </div>
                  )}
                </>
              )}
            </div>
          )
        })}
        
        {hasMore && (
          <div 
            onClick={() => {
              setCurrentDay(new Date(dayClasses[0].fecha_hora_inicio));
              setCurrentView('dia');
            }}
            className="bg-[#050505] rounded-md hover:bg-white/5 flex items-center justify-center text-[10px] font-bold text-gray-400 hover:text-white cursor-pointer transition-colors"
          >
            +{count - 3} clases
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen p-6 lg:p-12 text-white">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-wide mb-2">Calendario Admin</h1>
            <p className="text-gray-400">Parrilla interactiva de clases para la sede <span className="font-bold text-[#02D7E5]">{activeSede?.nombre}</span></p>
          </div>
          <button
            onClick={() => setIsDrawerOpen(true)}
            disabled={!activeSede}
            className="bg-[#02D7E5] hover:bg-[#02b8c4] text-black font-semibold py-2.5 px-6 rounded-lg transition-all shadow-[0_0_15px_rgba(2,215,229,0.3)] hover:shadow-[0_0_25px_rgba(2,215,229,0.5)] whitespace-nowrap flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            + Nueva Clase
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg backdrop-blur-xl">
            <AlertCircle className="w-5 h-5" />
            <p>{error}</p>
          </div>
        )}

        {/* Controles de Vista y Periodo */}
        <div className="flex flex-col sm:flex-row justify-between items-center bg-white/5 p-4 rounded-xl border border-white/10 backdrop-blur-sm gap-4">
          <div className="flex bg-black/40 p-1 rounded-lg border border-white/10">
            <button
              onClick={() => setCurrentView('semana')}
              className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-all ${
                currentView === 'semana' ? 'bg-[#02D7E5] text-black shadow-md' : 'text-gray-400 hover:text-white'
              }`}
            >
              Semana
            </button>
            <button
              onClick={() => setCurrentView('dia')}
              className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-all ${
                currentView === 'dia' ? 'bg-[#02D7E5] text-black shadow-md' : 'text-gray-400 hover:text-white'
              }`}
            >
              Día
            </button>
          </div>

          <div className="flex items-center gap-4">
            <button onClick={prevPeriod} className="text-[#02D7E5] hover:text-white transition font-medium">&larr; Anterior</button>
            <div className="font-bold tracking-wider uppercase text-sm text-center">
              {currentView === 'semana' ? (
                <>
                  {currentWeekStart.toLocaleDateString('es-ES', { month: 'short', day: 'numeric' })} - 
                  {(() => {
                     const end = new Date(currentWeekStart);
                     end.setDate(end.getDate() + 6);
                     return end.toLocaleDateString('es-ES', { month: 'short', day: 'numeric' });
                  })()}
                </>
              ) : (
                currentDay.toLocaleDateString('es-ES', { weekday: 'long', month: 'short', day: 'numeric' })
              )}
            </div>
            <button onClick={nextPeriod} className="text-[#02D7E5] hover:text-white transition font-medium">Siguiente &rarr;</button>
          </div>
        </div>

        {/* CSS Grid Calendario Visual */}
        <div className="bg-white/5 border border-white/10 backdrop-blur-2xl shadow-2xl rounded-2xl overflow-hidden min-h-[600px] flex flex-col relative">
          
          {isFetching && (
            <div className="absolute inset-0 z-10 bg-black/50 backdrop-blur-sm flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-[#02D7E5] animate-spin" />
            </div>
          )}

          {currentView === 'semana' ? (
            <>
              {/* Grid Header Semana */}
              <div className="grid grid-cols-[80px_repeat(7,minmax(0,1fr))] border-b border-white/10 bg-black/40">
                <div className="p-4 text-center text-xs font-bold text-gray-500 uppercase tracking-widest border-r border-white/5 flex items-center justify-center">
                  <Clock className="w-4 h-4" />
                </div>
                {daysOfWeek.map((day) => {
                  const dayDate = new Date(currentWeekStart);
                  const dayOffset = day.value === 0 ? 6 : day.value - 1;
                  dayDate.setDate(dayDate.getDate() + dayOffset);
                  const isToday = new Date().toDateString() === dayDate.toDateString();

                  return (
                    <div 
                      key={day.value} 
                      onClick={() => {
                        setCurrentDay(dayDate);
                        setCurrentView('dia');
                      }}
                      className={`p-4 text-center border-r border-white/5 last:border-r-0 cursor-pointer transition-colors hover:bg-white/5 ${isToday ? 'bg-[#02D7E5]/10' : ''}`}
                    >
                      <p className={`text-sm font-bold ${isToday ? 'text-[#02D7E5]' : 'text-gray-300'}`}>{day.label}</p>
                      <p className="text-xs text-gray-500">{dayDate.getDate()}</p>
                    </div>
                  );
                })}
              </div>

              {/* Grid Body Semana */}
              <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent bg-black/20">
                {hours.map((hour) => (
                  <div key={hour} className="grid grid-cols-[80px_repeat(7,minmax(0,1fr))] border-b border-white/5">
                    {/* Etiqueta de Hora */}
                    <div className="p-2 border-r border-white/5 flex items-start justify-center pt-3 bg-black/10">
                      <span className="text-xs text-gray-500 font-medium whitespace-nowrap">
                        {hour === 12 ? '12:00 PM' : hour > 12 ? `${hour - 12}:00 PM` : `${hour}:00 AM`}
                      </span>
                    </div>
                    
                    {/* Celdas de Días */}
                    {daysOfWeek.map((day) => {
                      const dayDate = new Date(currentWeekStart);
                      const dayOffset = day.value === 0 ? 6 : day.value - 1;
                      dayDate.setDate(dayDate.getDate() + dayOffset);
                      const isToday = new Date().toDateString() === dayDate.toDateString();

                      const dayClasses = classesThisWeek.filter((c) => {
                        const d = new Date(c.fecha_hora_inicio);
                        return d.getDay() === day.value && d.getHours() === hour;
                      });

                      return (
                        <div key={`${day.value}-${hour}`} className={`h-32 p-0 w-full overflow-hidden border-r border-white/5 last:border-r-0 relative transition-colors hover:bg-white/[0.03] ${isToday ? 'bg-[#02D7E5]/5' : ''}`}>
                          {renderWeekCellClasses(dayClasses)}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              {/* Grid Header Día */}
              <div className="grid grid-cols-[80px_1fr] border-b border-white/10 bg-black/40">
                <div className="p-4 text-center text-xs font-bold text-gray-500 uppercase tracking-widest border-r border-white/5 flex items-center justify-center">
                  <Clock className="w-4 h-4" />
                </div>
                <div className="p-4 text-center flex flex-col items-center justify-center">
                  <p className="text-sm font-bold text-[#02D7E5] uppercase tracking-wide">
                    {currentDay.toLocaleDateString('es-ES', { weekday: 'long' })}
                  </p>
                  <p className="text-xs text-gray-400">{currentDay.getDate()} de {currentDay.toLocaleDateString('es-ES', { month: 'long' })}</p>
                </div>
              </div>

              {/* Grid Body Día */}
              <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent bg-black/20">
                {hours.map((hour) => {
                  const dayClasses = clases.filter((c) => {
                    const d = new Date(c.fecha_hora_inicio);
                    return d.toDateString() === currentDay.toDateString() && d.getHours() === hour;
                  });

                  return (
                    <div key={hour} className="grid grid-cols-[80px_1fr] border-b border-white/5 min-h-[140px]">
                      <div className="p-2 border-r border-white/5 flex items-start justify-center pt-3 bg-black/10">
                        <span className="text-xs text-gray-500 font-medium whitespace-nowrap">
                          {hour === 12 ? '12:00 PM' : hour > 12 ? `${hour - 12}:00 PM` : `${hour}:00 AM`}
                        </span>
                      </div>
                      
                      <div className="p-4 flex flex-row gap-4 overflow-x-auto hide-scrollbar">
                        {dayClasses.map((clase) => {
                          const isSpecial = !clase.disciplina_id && clase.nombre_clase;
                          return (
                            <div 
                              key={clase.id} 
                              onClick={() => {
                                setViewingClase(clase);
                                setIsDetailsDrawerOpen(true);
                              }}
                              className={`shrink-0 w-72 bg-[#0a0a0a]/80 border backdrop-blur-xl rounded-md p-4 transition-all cursor-pointer shadow-lg group relative overflow-hidden flex flex-col justify-between ${
                                isSpecial 
                                  ? 'border-amber-400/40 hover:bg-amber-400/10 hover:border-amber-400/60' 
                                  : 'border-[#02D7E5]/30 hover:bg-[#02D7E5]/20 hover:border-[#02D7E5]/50'
                              }`}
                            >
                              <div className={`absolute top-0 left-0 w-1.5 h-full ${isSpecial ? 'bg-amber-400' : 'bg-[#02D7E5]'}`} />
                              
                              <div className="absolute top-2 right-2 flex items-center gap-1 z-10">
                                {isSpecial && (
                                  <div className="flex items-center justify-center bg-amber-400/20 rounded-md p-1.5">
                                    <Star className="w-4 h-4 text-amber-400" />
                                  </div>
                                )}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleEdit(clase);
                                  }}
                                  className="p-1.5 rounded-md bg-white/5 text-white/40 hover:bg-white/10 hover:text-white transition-colors opacity-0 group-hover:opacity-100"
                                  title="Editar Clase"
                                >
                                  <Pencil className="w-4 h-4" />
                                </button>
                              </div>

                              <div className="pl-3">
                                <p className={`text-base font-bold mb-3 pr-8 ${isSpecial ? 'text-amber-400' : 'text-white'}`}>
                                  {isSpecial ? clase.nombre_clase : clase.disciplinas?.nombre}
                                </p>
                                
                                <div className={`flex items-center text-sm mb-2 ${isSpecial ? 'text-amber-400/80' : 'text-[#02D7E5]'}`}>
                                  <Clock className="w-4 h-4 mr-2 opacity-70" />
                                  {formatAMPM(new Date(clase.fecha_hora_inicio))}
                                </div>
                                
                                {clase.instructor_id && (
                                  <div className="flex items-center text-sm text-gray-400 truncate mb-4">
                                    <User className="w-4 h-4 mr-2 opacity-70" />
                                    {clase.instructores?.nombre || 'Sin asignar'}
                                  </div>
                                )}
                              </div>
                              
                              <div className="flex items-center justify-between text-xs text-gray-500 pl-3 pt-3 border-t border-white/10">
                                <span>Aforo Máximo: {clase.aforo_maximo} personas</span>
                              </div>
                            </div>
                          )
                        })}
                        {dayClasses.length === 0 && (
                          <div className="flex-1 flex items-center justify-center text-white/20 text-sm font-medium">
                            No hay clases programadas para esta hora.
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

        </div>

      </div>

      {/* Drawer para Agendar/Editar */}
      <div 
        className={`fixed inset-0 z-40 transition-opacity duration-300 ${
          isDrawerOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div 
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={cancelEdit}
        />
        
        <div 
          className={`absolute inset-y-0 right-0 w-full max-w-md bg-[#050505]/90 backdrop-blur-3xl border-l border-white/10 p-6 sm:p-8 shadow-2xl transform transition-transform duration-300 flex flex-col ${
            isDrawerOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-xl font-bold">
              {editingId ? "Editar Clase" : duplicatingRecurrenciaId ? "Duplicar Clase" : "Agendar Nueva Clase"}
            </h2>
            <div className="flex items-center gap-2">
              {editingId && (
                <button
                  type="button"
                  onClick={() => {
                    const c = clases.find(x => x.id === editingId);
                    if (c) {
                       setIsDrawerOpen(false);
                       setViewingClase(c);
                       setIsDeletingMode(true);
                       setIsDetailsDrawerOpen(true);
                    }
                  }}
                  className="p-2 text-red-500 hover:text-red-400 transition-colors rounded-full hover:bg-red-500/10"
                  title="Eliminar Clase"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              )}
              <button 
                onClick={cancelEdit}
                className="p-2 text-white/50 hover:text-white transition-colors rounded-full hover:bg-white/5"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
          
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 flex-1 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
            
            {/* Toggle Tipo de Clase */}
            <div className="flex bg-black/40 p-1 rounded-lg border border-white/10">
              <button
                type="button"
                onClick={() => setValue("tipo_clase", "REGULAR")}
                className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all ${
                  watchTipoClase === "REGULAR" 
                    ? "bg-[#02D7E5] text-black shadow-md" 
                    : "text-gray-400 hover:text-white"
                }`}
              >
                Clase Regular
              </button>
              <button
                type="button"
                onClick={() => setValue("tipo_clase", "ESPECIAL")}
                className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all ${
                  watchTipoClase === "ESPECIAL" 
                    ? "bg-amber-400 text-black shadow-md" 
                    : "text-gray-400 hover:text-white"
                }`}
              >
                Clase Especial
              </button>
            </div>

            {/* Input Condicional: Disciplina (Select) vs Nombre (Text) */}
            {watchTipoClase === "REGULAR" ? (
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Disciplina del Catálogo
                </label>
                <div className="relative">
                  <select
                    {...register("disciplina_id")}
                    className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-[#02D7E5] focus:border-transparent transition-all appearance-none"
                  >
                    <option value="" disabled hidden>Selecciona una disciplina...</option>
                    {disciplinas.map((disc) => (
                      <option key={disc.id} value={disc.id} className="bg-neutral-900 text-white">
                        {disc.nombre}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-400">
                    <Dumbbell className="w-4 h-4" />
                  </div>
                </div>
                {errors.disciplina_id && <p className="text-red-400 text-xs mt-2">{errors.disciplina_id.message}</p>}
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Nombre de Clase Especial
                </label>
                <div className="relative">
                  <input
                    {...register("nombre_clase")}
                    type="text"
                    placeholder="Ej. Masterclass Aniversario"
                    className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition-all"
                  />
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-400">
                    <Star className="w-4 h-4" />
                  </div>
                </div>
                {errors.nombre_clase && <p className="text-red-400 text-xs mt-2">{errors.nombre_clase.message}</p>}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Instructor (Opcional)
              </label>
              <div className="relative">
                <select
                  {...register("instructor_id")}
                  className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-[#02D7E5] focus:border-transparent transition-all appearance-none"
                >
                  <option value="">Sin instructor asignado</option>
                  {instructores.map((inst) => (
                    <option key={inst.id} value={inst.id} className="bg-neutral-900 text-white">
                      {inst.nombre}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-400">
                  <User className="w-4 h-4" />
                </div>
              </div>
              {errors.instructor_id && <p className="text-red-400 text-xs mt-2">{errors.instructor_id.message}</p>}
            </div>

            {/* Input Condicional: Fecha y Hora Base vs Selectores de Recurrencia */}
            {watchTipoClase === "ESPECIAL" || editingId || duplicatingRecurrenciaId ? (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Fecha de la Clase
                  </label>
                  <input
                    {...register("fecha_base")}
                    type="date"
                    className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#02D7E5] focus:border-transparent transition-all"
                    style={{ colorScheme: 'dark' }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Hora (Formato AM/PM)
                  </label>
                  <select
                    {...register("hora_base")}
                    className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-[#02D7E5] focus:border-transparent transition-all appearance-none"
                  >
                    <option value="" disabled hidden>Seleccionar...</option>
                    {hours.map((hour) => {
                      const val = `${String(hour).padStart(2, '0')}:00`;
                      const label = hour === 12 ? '12:00 PM' : hour > 12 ? `${hour - 12}:00 PM` : `${hour}:00 AM`;
                      return (
                        <option key={val} value={val} className="bg-neutral-900 text-white">
                          {label}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-3">
                    Días de la Semana (Próximas 4 semanas)
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {daysOfWeek.map((day) => (
                      <button
                        key={day.value}
                        type="button"
                        onClick={() => {
                          if (selectedDays.includes(day.value)) {
                            setSelectedDays(selectedDays.filter(d => d !== day.value));
                          } else {
                            setSelectedDays([...selectedDays, day.value]);
                          }
                        }}
                        className={`w-10 h-10 rounded-full text-sm font-bold flex items-center justify-center transition-all ${
                          selectedDays.includes(day.value)
                            ? 'bg-[#02D7E5] text-black shadow-[0_0_15px_rgba(2,215,229,0.4)] border border-[#02D7E5]'
                            : 'bg-white/5 text-gray-400 hover:bg-white/10 border border-white/10'
                        }`}
                      >
                        {day.short}
                      </button>
                    ))}
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-3">
                    Horarios (Selección Múltiple)
                  </label>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {hours.map((hour) => (
                      <button
                        key={hour}
                        type="button"
                        onClick={() => {
                          if (selectedHours.includes(hour)) {
                            setSelectedHours(selectedHours.filter(h => h !== hour));
                          } else {
                            setSelectedHours([...selectedHours, hour]);
                          }
                        }}
                        className={`py-2 px-1 text-xs font-bold rounded-lg border transition-all ${
                          selectedHours.includes(hour)
                            ? 'bg-[#02D7E5] text-black border-[#02D7E5] shadow-[0_0_10px_rgba(2,215,229,0.3)]'
                            : 'bg-black/30 text-gray-400 border-white/10 hover:border-white/30'
                        }`}
                      >
                        {hour === 12 ? '12:00 PM' : hour > 12 ? `${hour - 12}:00 PM` : `${hour}:00 AM`}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Aforo Máximo (Capacidad)
              </label>
              <input
                {...register("aforo_maximo")}
                type="number"
                placeholder="Ej. 20"
                className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#02D7E5] focus:border-transparent transition-all"
              />
              {errors.aforo_maximo && <p className="text-red-400 text-xs mt-2">{errors.aforo_maximo.message}</p>}
            </div>

            <div className="pt-6 mt-auto">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-[#02D7E5] hover:bg-[#02b8c4] text-black font-bold py-3 px-4 rounded-lg flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(2,215,229,0.3)] hover:shadow-[0_0_25px_rgba(2,215,229,0.5)]"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Guardando...
                  </>
                ) : editingId ? (
                  "Actualizar Clase"
                ) : (
                  "Agendar Clase"
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Drawer de Detalles de Clase */}
      <div 
        className={`fixed inset-0 z-40 transition-opacity duration-300 ${
          isDetailsDrawerOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div 
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={() => {
            setIsDetailsDrawerOpen(false);
            setTimeout(() => setIsDeletingMode(false), 300);
          }}
        />
        
        <div 
          className={`absolute inset-y-0 right-0 w-full max-w-md bg-[#050505]/90 backdrop-blur-3xl border-l border-white/10 p-6 sm:p-8 shadow-2xl transform transition-transform duration-300 flex flex-col ${
            isDetailsDrawerOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          {!isDeletingMode && (
            <div className="flex items-center justify-between mb-8 animate-in fade-in duration-300">
              <h2 className="text-xl font-bold">Detalles de la Clase</h2>
              <div className="flex items-center gap-2">
                {viewingClase && (
                  <>
                    <button
                      onClick={() => handleDuplicate(viewingClase)}
                      className="p-2 text-[#02D7E5] hover:text-white transition-colors rounded-full hover:bg-white/5"
                      title="Duplicar Clase"
                    >
                      <Copy className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => confirmDelete(viewingClase)}
                      className="p-2 text-red-500 hover:text-red-400 transition-colors rounded-full hover:bg-red-500/10"
                      title="Eliminar Clase"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </>
                )}
                <button 
                  onClick={() => {
                    setIsDetailsDrawerOpen(false);
                    setTimeout(() => setIsDeletingMode(false), 300);
                  }}
                  className="p-2 text-white/50 hover:text-white transition-colors rounded-full hover:bg-white/5"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}
          
          {isDeletingMode && viewingClase ? (
            <div className="flex-1 flex flex-col justify-center items-center h-full p-4 text-center animate-in fade-in zoom-in-95 duration-300">
               <Trash2 className="w-16 h-16 text-red-500/50 mb-6" />
               <h3 className="text-2xl font-bold text-white mb-3">Eliminar Clase</h3>
               <p className="text-gray-400 text-sm mb-10">
                 ¿Estás seguro de que deseas eliminar <span className="text-white font-bold">{viewingClase.disciplina_id ? viewingClase.disciplinas?.nombre : viewingClase.nombre_clase}</span>?
               </p>
               
               <div className="w-full space-y-4">
                 <button 
                   onClick={() => executeDelete('single', viewingClase)}
                   className="w-full p-4 bg-red-500 hover:bg-red-600 text-white rounded-xl text-base font-bold shadow-[0_0_20px_rgba(239,68,68,0.3)] transition-all"
                 >
                   Eliminar solo esta clase
                 </button>
                 
                 {viewingClase.grupo_recurrencia_id && (
                   <div className="pt-6 mt-6 border-t border-white/5 space-y-3">
                     <button 
                       onClick={() => executeDelete('series', viewingClase)}
                       className="w-full p-3 bg-transparent border border-red-500/30 hover:bg-red-500/10 text-red-400 rounded-xl text-sm font-semibold transition-all"
                     >
                       Eliminar serie recurrente a partir de mañana
                     </button>
                     <p className="text-xs text-muted-foreground text-gray-500 leading-relaxed px-2 text-left">
                       <strong className="text-gray-400">Nota:</strong> Al seleccionar esto, se eliminarán todas las clases de esta disciplina recurrente a partir del día de mañana. Las clases de hoy se mantendrán intactas para proteger los cupos de las personas ya inscritas.
                     </p>
                   </div>
                 )}
                 
                 <div className="pt-4">
                   <button 
                     onClick={() => setIsDeletingMode(false)}
                     className="w-full p-3 text-gray-400 hover:text-white rounded-xl text-sm font-bold transition-all"
                   >
                     Cancelar
                   </button>
                 </div>
               </div>
            </div>
          ) : viewingClase && (
            <div className="flex-1 flex flex-col overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent animate-in fade-in duration-300">
              <div className="bg-white/5 border border-white/10 rounded-xl p-5 mb-6">
                <h3 className="text-2xl font-black text-white mb-2">
                  {viewingClase.disciplina_id ? viewingClase.disciplinas?.nombre : viewingClase.nombre_clase}
                </h3>
                
                <div className="space-y-3 mt-4 text-sm font-medium">
                  <div className="flex items-center text-gray-400">
                    <Clock className="w-4 h-4 mr-3 text-[#02D7E5]" />
                    {new Date(viewingClase.fecha_hora_inicio).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })} - {formatAMPM(new Date(viewingClase.fecha_hora_inicio))}
                  </div>
                  {viewingClase.instructor_id && (
                    <div className="flex items-center text-gray-400">
                      <User className="w-4 h-4 mr-3 text-[#02D7E5]" />
                      {viewingClase.instructores?.nombre || 'Sin asignar'}
                    </div>
                  )}
                  <div className="flex items-center text-gray-400">
                    <Dumbbell className="w-4 h-4 mr-3 text-[#02D7E5]" />
                    Aforo: {viewingClase.aforo_maximo} personas
                  </div>
                </div>
              </div>

              <div className="flex-1 bg-black/30 border border-white/5 rounded-xl flex flex-col p-5">
                <h4 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-4 border-b border-white/5 pb-2">
                  Lista de Participantes
                </h4>
                <div className="flex-1 flex items-center justify-center text-gray-500 text-center">
                  <p>Lista de Participantes <br/>(En construcción)</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
