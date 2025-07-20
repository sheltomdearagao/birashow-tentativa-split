import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { CalendarIcon, Clock, Users } from "lucide-react";
import { format, addDays, isMonday, isSunday } from "date-fns";
import { pt } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface SchedulingCalendarProps {
  selectedServices: string[];
  user: any;
  onBack: () => void;
  onScheduled: () => void;
}

interface TimeSlot {
  id: string;
  label: string;
  startTime: string;
  endTime: string;
  maxSlots: number;
}

const TIME_SLOTS: TimeSlot[] = [
  { id: "morning", label: "Manhã", startTime: "09:00", endTime: "12:00", maxSlots: 5 },
  { id: "afternoon", label: "Tarde", startTime: "14:00", endTime: "18:00", maxSlots: 5 },
  { id: "evening", label: "Noite", startTime: "18:00", endTime: "21:00", maxSlots: 5 }
];

export function SchedulingCalendar({ selectedServices, user, onBack, onScheduled }: SchedulingCalendarProps) {
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedSlot, setSelectedSlot] = useState<string>();
  const [isBooking, setIsBooking] = useState(false);
  const { toast } = useToast();

  const { data: services } = useQuery({
    queryKey: ['services'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .in('id', selectedServices);
      
      if (error) throw error;
      return data;
    }
  });

  const { data: profile } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!user
  });

  const { data: queueData } = useQuery({
    queryKey: ['queue', selectedDate],
    queryFn: async () => {
      if (!selectedDate) return [];
      
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const { data, error } = await supabase
        .from('daily_queue')
        .select(`
          *,
          appointments!inner(
            scheduled_time,
            service_id
          )
        `)
        .eq('queue_date', dateStr)
        .eq('is_active', true);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedDate
  });

  const getTotalPrice = () => {
    if (!services) return 0;
    return services.reduce((total, service) => total + service.price, 0);
  };

  const getTotalDuration = () => {
    if (!services) return 0;
    return services.reduce((total, service) => total + service.duration_minutes, 0);
  };

  const getSlotOccupancy = (slotId: string) => {
    if (!queueData || !selectedDate) return 0;
    
    const slot = TIME_SLOTS.find(s => s.id === slotId);
    if (!slot) return 0;

    const slotStart = new Date(`${format(selectedDate, 'yyyy-MM-dd')} ${slot.startTime}`);
    const slotEnd = new Date(`${format(selectedDate, 'yyyy-MM-dd')} ${slot.endTime}`);

    return queueData.filter(item => {
      const appointmentTime = new Date(item.appointments.scheduled_time);
      return appointmentTime >= slotStart && appointmentTime <= slotEnd;
    }).length;
  };

  const isDateDisabled = (date: Date) => {
    return isMonday(date) || isSunday(date) || date < new Date();
  };

  const handleSchedule = async () => {
    if (!selectedDate || !selectedSlot || !profile) return;
    
    setIsBooking(true);
    
    try {
      // Get slot details
      const slot = TIME_SLOTS.find(s => s.id === selectedSlot);
      if (!slot) throw new Error("Turno inválido");

      // Check if slot is available
      const occupancy = getSlotOccupancy(selectedSlot);
      if (occupancy >= slot.maxSlots) {
        throw new Error("Este turno está lotado. Escolha outro horário.");
      }

      // Calculate scheduled time (start of slot + occupancy * average service time)
      const slotStartTime = new Date(`${format(selectedDate, 'yyyy-MM-dd')} ${slot.startTime}`);
      const avgServiceTime = 30; // 30 minutes average per service
      const scheduledTime = new Date(slotStartTime.getTime() + (occupancy * avgServiceTime * 60000));

      // Create appointments for each service
      const appointmentPromises = selectedServices.map(async (serviceId) => {
        const { data: appointment, error } = await supabase
          .from('appointments')
          .insert({
            customer_id: profile.id,
            service_id: serviceId,
            scheduled_time: scheduledTime.toISOString(),
            status: 'scheduled',
            booking_type: 'app'
          })
          .select()
          .single();

        if (error) throw error;

        // Add to daily queue
        const { error: queueError } = await supabase
          .from('daily_queue')
          .insert({
            appointment_id: appointment.id,
            queue_position: occupancy + 1,
            queue_date: format(selectedDate, 'yyyy-MM-dd')
          });

        if (queueError) throw queueError;
        
        return appointment;
      });

      await Promise.all(appointmentPromises);

      toast({
        title: "Agendamento realizado!",
        description: `Seus serviços foram agendados para ${format(selectedDate, "dd 'de' MMMM", { locale: pt })} no turno da ${slot.label.toLowerCase()}.`
      });
      
      onScheduled();
    } catch (error: any) {
      toast({
        title: "Erro ao agendar",
        description: error.message || "Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setIsBooking(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onBack}>
          Voltar
        </Button>
        <h1 className="text-2xl font-bold">Agendamento</h1>
        <div></div>
      </div>

      {/* Services Summary */}
      <Card className="bg-gradient-card border-border shadow-card">
        <CardContent className="p-6">
          <h3 className="font-semibold text-lg mb-4">Serviços Selecionados</h3>
          <div className="space-y-2 mb-4">
            {services?.map((service) => (
              <div key={service.id} className="flex justify-between items-center">
                <span>{service.name}</span>
                <span className="font-medium">
                  {new Intl.NumberFormat('pt-BR', {
                    style: 'currency',
                    currency: 'BRL'
                  }).format(service.price)}
                </span>
              </div>
            ))}
          </div>
          <div className="border-t pt-4 flex justify-between items-center">
            <div>
              <span className="font-semibold">Total: </span>
              <span className="text-xl font-bold text-primary">
                {new Intl.NumberFormat('pt-BR', {
                  style: 'currency',
                  currency: 'BRL'
                }).format(getTotalPrice())}
              </span>
            </div>
            <div className="flex items-center gap-1 text-muted-foreground">
              <Clock className="w-4 h-4" />
              <span>{getTotalDuration()}min</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Calendar */}
        <Card className="bg-gradient-card border-border shadow-card">
          <CardContent className="p-6">
            <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
              <CalendarIcon className="w-5 h-5" />
              Escolha a Data
            </h3>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              disabled={isDateDisabled}
              className="w-full"
            />
            <div className="mt-4 text-sm text-muted-foreground">
              <p>• Não atendemos às segundas-feiras</p>
              <p>• Não atendemos aos domingos</p>
            </div>
          </CardContent>
        </Card>

        {/* Time Slots */}
        <Card className="bg-gradient-card border-border shadow-card">
          <CardContent className="p-6">
            <h3 className="font-semibold text-lg mb-4">Escolha o Turno</h3>
            {!selectedDate ? (
              <p className="text-muted-foreground text-center py-8">
                Selecione uma data primeiro
              </p>
            ) : (
              <div className="space-y-3">
                {TIME_SLOTS.map((slot) => {
                  const occupancy = getSlotOccupancy(slot.id);
                  const isAvailable = occupancy < slot.maxSlots;
                  
                  return (
                    <div
                      key={slot.id}
                      className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                        selectedSlot === slot.id
                          ? 'border-primary bg-primary/10'
                          : isAvailable
                          ? 'border-border hover:border-primary/50'
                          : 'border-destructive/20 bg-destructive/5 cursor-not-allowed'
                      }`}
                      onClick={() => isAvailable && setSelectedSlot(slot.id)}
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <h4 className="font-medium">{slot.label}</h4>
                          <p className="text-sm text-muted-foreground">
                            {slot.startTime} às {slot.endTime}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center gap-1 mb-1">
                            <Users className="w-4 h-4" />
                            <span className="text-sm">
                              {occupancy}/{slot.maxSlots}
                            </span>
                          </div>
                          <Badge 
                            variant={isAvailable ? "default" : "destructive"}
                            className="text-xs"
                          >
                            {isAvailable ? "Disponível" : "Lotado"}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Schedule Button */}
      {selectedDate && selectedSlot && (
        <Card className="bg-gradient-card border-border shadow-card">
          <CardContent className="p-6">
            <Button
              variant="premium"
              size="lg"
              className="w-full"
              onClick={handleSchedule}
              disabled={isBooking}
            >
              {isBooking ? "Agendando..." : "CONFIRMAR AGENDAMENTO"}
            </Button>
            <p className="text-center text-sm text-muted-foreground mt-2">
              Agendamento para {format(selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: pt })} 
              {" no turno da "}{TIME_SLOTS.find(s => s.id === selectedSlot)?.label.toLowerCase()}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}