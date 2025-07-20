import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ServiceCard } from "@/components/ServiceCard";
import { ArrowLeft, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ServicesProps {
  onBack: () => void;
  onServiceSelected: (serviceId: string) => void;
  user: any;
}

export function Services({ onBack, onServiceSelected, user }: ServicesProps) {
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [isBooking, setIsBooking] = useState(false);
  const { toast } = useToast();

  const { data: services, isLoading } = useQuery({
    queryKey: ['services'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('is_active', true)
        .order('price');
      
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

  const handleSchedule = async () => {
    if (!selectedService || !profile) return;
    
    setIsBooking(true);
    
    try {
      // Criar agendamento
      const scheduledTime = new Date();
      scheduledTime.setHours(scheduledTime.getHours() + 1); // Agendar para 1 hora a partir de agora
      
      const { data: appointment, error: appointmentError } = await supabase
        .from('appointments')
        .insert({
          customer_id: profile.id,
          service_id: selectedService,
          scheduled_time: scheduledTime.toISOString(),
          status: 'scheduled',
          booking_type: 'app'
        })
        .select()
        .single();

      if (appointmentError) throw appointmentError;

      // Adicionar à fila do dia
      const { data: queueData, error: queueError } = await supabase
        .from('daily_queue')
        .select('queue_position')
        .eq('queue_date', new Date().toISOString().split('T')[0])
        .order('queue_position', { ascending: false })
        .limit(1);

      const nextPosition = queueData?.[0]?.queue_position ? queueData[0].queue_position + 1 : 1;

      const { error: queueInsertError } = await supabase
        .from('daily_queue')
        .insert({
          appointment_id: appointment.id,
          queue_position: nextPosition,
          queue_date: new Date().toISOString().split('T')[0]
        });

      if (queueInsertError) throw queueInsertError;

      toast({
        title: "Agendamento realizado!",
        description: `Você está na posição ${nextPosition} da fila.`
      });
      
      onServiceSelected(selectedService);
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-background p-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <Button variant="ghost" onClick={onBack}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-48 bg-card rounded-lg animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-background p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
          <h1 className="text-2xl font-bold">Nossos Serviços</h1>
        </div>

        <p className="text-center text-muted-foreground mb-8">
          Escolha os serviços desejados e agende seu horário de forma prática e rápida
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {services?.map((service) => (
            <ServiceCard
              key={service.id}
              service={service}
              onSelect={setSelectedService}
              isSelected={selectedService === service.id}
            />
          ))}
        </div>

        {selectedService && (
          <div className="fixed bottom-4 left-4 right-4 md:relative md:bottom-auto md:left-auto md:right-auto">
            <div className="bg-gradient-card p-4 rounded-lg border border-border shadow-card">
              <div className="text-center mb-4">
                <h3 className="font-semibold text-lg mb-2">Valor Total dos Serviços</h3>
                <div className="text-3xl font-bold text-primary">
                  {services?.find(s => s.id === selectedService) && 
                    new Intl.NumberFormat('pt-BR', {
                      style: 'currency',
                      currency: 'BRL'
                    }).format(services.find(s => s.id === selectedService)!.price)
                  }
                </div>
              </div>
              
              <Button 
                variant="premium" 
                className="w-full" 
                size="lg"
                onClick={handleSchedule}
                disabled={isBooking}
              >
                <Calendar className="w-5 h-5 mr-2" />
                {isBooking ? "Agendando..." : "Agendar Agora"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}