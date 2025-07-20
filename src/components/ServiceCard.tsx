import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Scissors, Clock } from "lucide-react";

interface ServiceCardProps {
  service: {
    id: string;
    name: string;
    price: number;
    duration_minutes: number;
    description?: string;
  };
  onSelect: (serviceId: string) => void;
  isSelected?: boolean;
}

export function ServiceCard({ service, onSelect, isSelected }: ServiceCardProps) {
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(price);
  };

  const formatDuration = (minutes: number) => {
    return `${minutes}min`;
  };

  return (
    <Card className={`relative overflow-hidden transition-all duration-300 hover:scale-105 cursor-pointer ${
      isSelected ? 'ring-2 ring-primary border-primary bg-primary/10' : 'bg-gradient-card border-border'
    }`}>
      <CardContent className="p-6 text-center">
        <div className="mb-4">
          <Scissors className="w-8 h-8 mx-auto text-primary" />
        </div>
        
        <h3 className="font-semibold text-lg mb-2">{service.name}</h3>
        
        <div className="text-2xl font-bold text-primary mb-3">
          {formatPrice(service.price)}
        </div>
        
        <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground mb-4">
          <Clock className="w-4 h-4" />
          <span>{formatDuration(service.duration_minutes)}</span>
        </div>
        
        {service.description && (
          <p className="text-sm text-muted-foreground mb-4">
            {service.description}
          </p>
        )}
        
        <Button 
          variant={isSelected ? "default" : "service"}
          className="w-full"
          onClick={() => onSelect(service.id)}
        >
          {isSelected ? "Selecionado" : "Selecionar"}
        </Button>
      </CardContent>
    </Card>
  );
}