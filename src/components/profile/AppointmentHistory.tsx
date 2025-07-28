import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, CheckCircle, Trash2, CreditCard, ChevronDown, History } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useState } from "react";

interface Appointment {
  id: string;
  scheduled_time: string;
  status: string;
  services?: {
    id: string;
    name: string;
    price: number;
    duration_minutes: number;
  };
}

interface AppointmentHistoryProps {
  appointments: Appointment[];
  isLoading: boolean;
  onRefresh: () => void;
}

export function AppointmentHistory({ appointments, isLoading, onRefresh }: AppointmentHistoryProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // Separar agendamentos futuros/ativos dos passados
  const now = new Date();
  const activeAppointments = appointments.filter(appointment => {
    const scheduledDate = new Date(appointment.scheduled_time);
    return appointment.status === 'scheduled' || 
           appointment.status === 'pending_payment' || 
           (scheduledDate >= now);
  });
  
  const pastAppointments = appointments.filter(appointment => {
    const scheduledDate = new Date(appointment.scheduled_time);
    return appointment.status === 'completed' || 
           appointment.status === 'cancelled' || 
           (scheduledDate < now && appointment.status !== 'scheduled' && appointment.status !== 'pending_payment');
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'text-primary';
      case 'completed': return 'text-green-600';
      case 'cancelled': return 'text-destructive';
      case 'pending_payment': return 'text-yellow-600';
      default: return 'text-muted-foreground';
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-primary/10 text-primary';
      case 'completed': return 'bg-green-100 text-green-600';
      case 'cancelled': return 'bg-destructive/10 text-destructive';
      case 'pending_payment': return 'bg-yellow-100 text-yellow-600';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'scheduled': return 'Agendado';
      case 'completed': return 'Finalizado';
      case 'cancelled': return 'Cancelado';
      case 'pending_payment': return 'Pendente Pagamento';
      default: return status;
    }
  };

  const canDelete = (appointment: Appointment) => {
    const scheduledDate = new Date(appointment.scheduled_time);
    const now = new Date();
    
    // Pode excluir se: não confirmado (pending_payment) ou já passou da data
    return appointment.status === 'pending_payment' || scheduledDate < now;
  };

  const canPay = (appointment: Appointment) => {
    const scheduledDate = new Date(appointment.scheduled_time);
    const now = new Date();
    
    // Pode pagar se: pendente de pagamento e ainda não passou da data
    return appointment.status === 'pending_payment' && scheduledDate >= now;
  };

  const handleDelete = async (appointmentId: string) => {
    try {
      const { error } = await supabase
        .from('appointments')
        .delete()
        .eq('id', appointmentId);

      if (error) throw error;

      toast({
        title: "Agendamento excluído",
        description: "O agendamento foi removido com sucesso.",
      });

      onRefresh();
    } catch (error) {
      console.error('Erro ao excluir agendamento:', error);
      toast({
        title: "Erro ao excluir",
        description: "Não foi possível excluir o agendamento. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const handlePayment = async (appointment: Appointment) => {
    try {
      // Criar nova preferência de pagamento para este agendamento específico
      const { data, error } = await supabase.functions.invoke('mp-create-payment-preference', {
        body: {
          appointment_id: appointment.id
        }
      });

      if (error) throw error;

      // Redirecionar para o pagamento
      if (data?.init_point) {
        window.location.href = data.init_point;
      } else {
        throw new Error('URL de pagamento não recebida');
      }
    } catch (error) {
      console.error('Erro ao processar pagamento:', error);
      toast({
        title: "Erro no pagamento",
        description: error.message || "Não foi possível processar o pagamento. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const getQueuePosition = (appointment: Appointment) => {
    // Obter apenas agendamentos do mesmo dia e turno
    const appointmentDate = new Date(appointment.scheduled_time);
    const appointmentTimeStr = appointmentDate.toTimeString().slice(0, 8);
    
    const sameSlotAppointments = appointments.filter(apt => {
      const aptDate = new Date(apt.scheduled_time);
      const aptTimeStr = aptDate.toTimeString().slice(0, 8);
      const aptDateStr = aptDate.toDateString();
      
      return aptDateStr === appointmentDate.toDateString() && 
             aptTimeStr === appointmentTimeStr &&
             (apt.status === 'scheduled' || apt.status === 'pending_payment');
    }).sort((a, b) => new Date(a.scheduled_time).getTime() - new Date(b.scheduled_time).getTime());
    
    const position = sameSlotAppointments.findIndex(apt => apt.id === appointment.id) + 1;
    return position;
  };

  const getSlotName = (scheduledTime: string) => {
    const time = new Date(scheduledTime).toTimeString().slice(0, 5);
    if (time === '09:00') return 'Manhã';
    if (time === '14:00') return 'Tarde';
    if (time === '18:00') return 'Noite';
    return 'Turno';
  };

  const renderAppointmentCard = (appointment: Appointment, isNext: boolean = false) => (
    <div 
      key={appointment.id} 
      className={`p-3 rounded-lg border transition-all ${
        isNext 
          ? 'bg-primary/5 border-primary/20' 
          : 'bg-card border-border hover:bg-muted/30'
      }`}
    >
      <div className="space-y-2">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {isNext && <CheckCircle className="w-4 h-4 text-primary flex-shrink-0" />}
              <h4 className={`font-medium truncate ${isNext ? 'text-primary' : 'text-foreground'}`}>
                {appointment.services?.name}
              </h4>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${getStatusBadgeColor(appointment.status)}`}>
                {getStatusText(appointment.status)}
              </span>
            </div>
          </div>
          <div className="text-right flex-shrink-0 ml-2">
            <p className={`font-semibold text-sm ${isNext ? 'text-primary' : 'text-foreground'}`}>
              {new Intl.NumberFormat('pt-BR', {
                style: 'currency',
                currency: 'BRL'
              }).format(appointment.services?.price || 0)}
            </p>
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>{new Date(appointment.scheduled_time).toLocaleDateString('pt-BR')}</span>
            <span>{getSlotName(appointment.scheduled_time)}</span>
            {(appointment.status === 'scheduled' || appointment.status === 'pending_payment') && (
              <span className="font-medium text-primary">
                Posição na fila: {getQueuePosition(appointment)}
              </span>
            )}
            <span>{appointment.services?.duration_minutes}min</span>
          </div>
          
          <div className="flex items-center gap-1">
            {canPay(appointment) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePayment(appointment)}
                className="h-7 w-7 p-0"
              >
                <CreditCard className="w-3 h-3" />
              </Button>
            )}
            
            {canDelete(appointment) && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir agendamento</AlertDialogTitle>
                    <AlertDialogDescription>
                      Tem certeza que deseja excluir este agendamento? Esta ação não pode ser desfeita.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => handleDelete(appointment.id)}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Excluir
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Agendamentos Ativos/Futuros */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Próximos Agendamentos
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            </div>
          ) : activeAppointments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-sm mb-2">Nenhum agendamento ativo</p>
              <Button variant="outline" size="sm" onClick={() => navigate('/')}>
                Fazer Agendamento
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {activeAppointments.map((appointment, index) => {
                const isNext = index === 0 && appointment.status === 'scheduled' && 
                  new Date(appointment.scheduled_time) > new Date();
                return renderAppointmentCard(appointment, isNext);
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Histórico de Agendamentos (Colapsável - Fechado por padrão) */}
      {pastAppointments.length > 0 && (
        <Collapsible open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
          <Card>
            <CardHeader className="pb-3">
              <CollapsibleTrigger asChild>
                <div className="flex items-center justify-between cursor-pointer hover:bg-muted/30 -m-2 p-2 rounded-lg transition-colors">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <History className="w-5 h-5" />
                    Histórico de Agendamentos
                    <span className="text-sm font-normal text-muted-foreground">
                      ({pastAppointments.length})
                    </span>
                  </CardTitle>
                  <ChevronDown className={`w-4 h-4 transition-transform ${isHistoryOpen ? 'rotate-180' : ''}`} />
                </div>
              </CollapsibleTrigger>
            </CardHeader>
            <CollapsibleContent>
              <CardContent className="pt-0">
                <div className="space-y-3">
                  {pastAppointments.map((appointment) => 
                    renderAppointmentCard(appointment, false)
                  )}
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}
    </div>
  );
}
