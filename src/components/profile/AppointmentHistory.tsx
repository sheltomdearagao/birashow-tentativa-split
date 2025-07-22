
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, CheckCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";

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
}

export function AppointmentHistory({ appointments, isLoading }: AppointmentHistoryProps) {
  const navigate = useNavigate();

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
                  <div className="text-right">
                    <p className={`font-medium ${isNext ? 'text-primary' : 'text-foreground'}`}>
                      {new Intl.NumberFormat('pt-BR', {
                        style: 'currency',
                        currency: 'BRL'
                      }).format(appointment.services?.price || 0)}
                    </p>
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
