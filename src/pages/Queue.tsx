import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { QueueItem } from "@/components/QueueItem";
import { ArrowLeft, Calendar, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface QueueProps {
  onBack: () => void;
  user: any;
}

export function Queue({ onBack, user }: QueueProps) {
  const [addingCustomer, setAddingCustomer] = useState(false);
  const { toast } = useToast();

  const { data: queueData, isLoading, refetch } = useQuery({
    queryKey: ['daily-queue'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('daily_queue')
        .select(`
          *,
          appointment:appointments!daily_queue_appointment_id_fkey (
            id,
            scheduled_time,
            status,
            booking_type,
            service:services!appointments_service_id_fkey (
              name,
              price
            ),
            customer:profiles!appointments_customer_id_fkey (
              full_name,
              phone
            )
          )
        `)
        .eq('queue_date', today)
        .eq('is_active', true)
        .order('queue_position');
      
      if (error) throw error;
      return data;
    },
    refetchInterval: 30000 // Atualiza a cada 30 segundos
  });

  const handleStartAppointment = async (appointmentId: string) => {
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status: 'in_progress' })
        .eq('id', appointmentId);

      if (error) throw error;
      
      toast({
        title: "Atendimento iniciado!",
        description: "O cliente foi chamado para atendimento."
      });
      
      refetch();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao iniciar atendimento.",
        variant: "destructive"
      });
    }
  };

  const handleCompleteAppointment = async (appointmentId: string) => {
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status: 'completed' })
        .eq('id', appointmentId);

      if (error) throw error;
      
      toast({
        title: "Atendimento finalizado!",
        description: "Cliente atendido com sucesso."
      });
      
      refetch();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao finalizar atendimento.",
        variant: "destructive"
      });
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
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-32 bg-card rounded-lg animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const nextInQueue = queueData?.find(item => item.appointment.status === 'scheduled');

  return (
    <div className="min-h-screen bg-gradient-background p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={onBack}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar
            </Button>
            <div className="flex items-center gap-2">
              <Calendar className="w-6 h-6 text-primary" />
              <h1 className="text-2xl font-bold">Fila de Hoje</h1>
            </div>
          </div>
        </div>

        {queueData && queueData.length > 0 ? (
          <div className="space-y-4">
            {queueData.map((item, index) => (
              <div key={item.id} className="relative">
                {item.appointment.status === 'scheduled' && item === nextInQueue && (
                  <div className="absolute -top-2 -left-2 bg-primary text-primary-foreground text-xs px-2 py-1 rounded-full font-medium z-10">
                    Próximo
                  </div>
                )}
                <QueueItem
                  appointment={item.appointment}
                  onStart={handleStartAppointment}
                  canStart={item === nextInQueue}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <Calendar className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhum cliente na fila</h3>
            <p className="text-muted-foreground">
              A fila está vazia. Aguarde novos agendamentos.
            </p>
          </div>
        )}

        <div className="mt-8 bg-gradient-card p-4 rounded-lg border border-border shadow-card">
          <h3 className="font-semibold text-lg mb-2">Adicionar Cliente</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Adicione clientes que chegaram sem agendamento
          </p>
          <div className="grid grid-cols-2 gap-4">
            <Button variant="outline" size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Corte de Cabelo
            </Button>
            <Button variant="outline" size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Barba
            </Button>
            <Button variant="outline" size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Corte + Barba
            </Button>
            <Button variant="outline" size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Sobrancelha
            </Button>
          </div>
        </div>

        {queueData && queueData.length > 0 && (
          <div className="mt-6 bg-gradient-card p-4 rounded-lg border border-border">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">Receita do Dia:</h4>
                <p className="text-xs text-muted-foreground">Clientes atendidos hoje</p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-green-400">R$ 0,00</div>
                <div className="text-xs text-muted-foreground">0 clientes</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}