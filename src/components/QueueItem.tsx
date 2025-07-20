import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Clock, User, Phone } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface QueueItemProps {
  appointment: {
    id: string;
    scheduled_time: string;
    booking_type: string;
    status: string;
    service: {
      name: string;
      price: number;
    };
    customer: {
      full_name: string;
      phone?: string;
    };
  };
  onStart?: (appointmentId: string) => void;
  canStart?: boolean;
}

export function QueueItem({ appointment, onStart, canStart }: QueueItemProps) {
  const formatTime = (timeString: string) => {
    return new Date(timeString).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(price);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled':
        return 'default';
      case 'in_progress':
        return 'secondary';
      case 'completed':
        return 'outline';
      default:
        return 'default';
    }
  };

  const getBookingTypeLabel = (type: string) => {
    return type === 'app' ? 'App' : 'Manual';
  };

  return (
    <Card className="bg-gradient-card border-border shadow-card">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            <span className="font-semibold">{formatTime(appointment.scheduled_time)}</span>
          </div>
          <Badge variant={getStatusColor(appointment.booking_type as any)}>
            {getBookingTypeLabel(appointment.booking_type)}
          </Badge>
        </div>

        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-muted-foreground" />
            <span className="font-medium">{appointment.customer.full_name}</span>
          </div>
          
          {appointment.customer.phone && (
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">{appointment.customer.phone}</span>
            </div>
          )}
        </div>

        <div className="space-y-2 mb-4">
          <div className="font-medium">{appointment.service.name}</div>
          <div className="text-lg font-bold text-primary">
            {formatPrice(appointment.service.price)}
          </div>
        </div>

        {canStart && onStart && appointment.status === 'scheduled' && (
          <Button 
            variant="premium" 
            className="w-full"
            onClick={() => onStart(appointment.id)}
          >
            Iniciar
          </Button>
        )}
      </CardContent>
    </Card>
  );
}