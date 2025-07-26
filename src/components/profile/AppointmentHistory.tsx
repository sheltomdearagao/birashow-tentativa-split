
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, CheckCircle, Trash2, CreditCard } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

interface Appointment {
  id: string;
  scheduled_time: string;
  status: string;
  services?: {
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
      const { data, error } = await supabase.functions.invoke('mp-create-appointment-preference', {
        body: {
          service_ids: [appointment.services ? appointment.services.name : ''],
          scheduled_date: appointment.scheduled_time.split('T')[0],
          time_slot: 'existing', // Indicar que é um agendamento existente
          appointment_id: appointment.id
        }
      });

      if (error) throw error;

      // Redirecionar para o pagamento
      if (data?.init_point) {
        window.location.href = data.init_point;
      }
    } catch (error) {
      console.error('Erro ao processar pagamento:', error);
      toast({
        title: "Erro no pagamento",
        description: "Não foi possível processar o pagamento. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          Meus Agendamentos
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          </div>
        ) : appointments.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum agendamento encontrado</p>
            <Button variant="outline" className="mt-4" onClick={() => navigate('/')}>
              Fazer Agendamento
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {appointments.map((appointment, index) => {
              const isNext = index === 0 && appointment.status === 'scheduled' && 
                new Date(appointment.scheduled_time) > new Date();
              
              return (
                <div 
                  key={appointment.id} 
                  className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
                    isNext ? 'bg-primary/5 border-l-4 border-l-primary' : 'hover:bg-muted/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {isNext && <CheckCircle className="w-4 h-4 text-primary" />}
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className={`font-medium ${isNext ? 'text-primary' : ''}`}>
                          {appointment.services?.name}
                        </h4>
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${getStatusBadgeColor(appointment.status)}`}>
                          {getStatusText(appointment.status)}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                        <span>
                          {new Date(appointment.scheduled_time).toLocaleDateString('pt-BR')}
                        </span>
                        <span>
                          {new Date(appointment.scheduled_time).toLocaleTimeString('pt-BR', { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </span>
                        <span>{appointment.services?.duration_minutes}min</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <p className={`font-medium ${isNext ? 'text-primary' : 'text-foreground'}`}>
                        {new Intl.NumberFormat('pt-BR', {
                          style: 'currency',
                          currency: 'BRL'
                        }).format(appointment.services?.price || 0)}
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-1">
                      {canPay(appointment) && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePayment(appointment)}
                          className="h-8 w-8 p-0"
                        >
                          <CreditCard className="w-4 h-4" />
                        </Button>
                      )}
                      
                      {canDelete(appointment) && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                            >
                              <Trash2 className="w-4 h-4" />
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
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
