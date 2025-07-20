import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ServiceCard } from "@/components/ServiceCard";
import { ArrowLeft, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ServicesProps {
  onBack: () => void;
  onProceedToScheduling: (serviceIds: string[]) => void;
  user: any;
}

export function Services({ onBack, onProceedToScheduling, user }: ServicesProps) {
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
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

  const handleServiceToggle = (serviceId: string) => {
    setSelectedServices(prev => {
      if (prev.includes(serviceId)) {
        return prev.filter(id => id !== serviceId);
      } else {
        return [...prev, serviceId];
      }
    });
  };

  const getTotalPrice = () => {
    if (!services) return 0;
    return selectedServices.reduce((total, serviceId) => {
      const service = services.find(s => s.id === serviceId);
      return total + (service?.price || 0);
    }, 0);
  };

  const handleProceedToScheduling = () => {
    if (selectedServices.length === 0) {
      toast({
        title: "Selecione pelo menos um serviço",
        description: "Escolha os serviços que deseja agendar.",
        variant: "destructive"
      });
      return;
    }
    onProceedToScheduling(selectedServices);
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
              onSelect={handleServiceToggle}
              isSelected={selectedServices.includes(service.id)}
            />
          ))}
        </div>

        {/* Total and Proceed Section */}
        <div className="bg-gradient-card p-6 rounded-lg border border-border shadow-card">
          <div className="text-center mb-4">
            <h3 className="font-semibold text-lg mb-2">Valor Total dos Serviços</h3>
            <div className="text-3xl font-bold text-primary">
              {new Intl.NumberFormat('pt-BR', {
                style: 'currency',
                currency: 'BRL'
              }).format(getTotalPrice())}
            </div>
          </div>
          
          <Button 
            variant={selectedServices.length > 0 ? "premium" : "outline"} 
            className="w-full" 
            size="lg"
            onClick={handleProceedToScheduling}
            disabled={selectedServices.length === 0}
          >
            <Calendar className="w-5 h-5 mr-2" />
            {selectedServices.length > 0 ? "PROSSEGUIR PARA AGENDAMENTO" : "SELECIONE UM SERVIÇO"}
          </Button>
        </div>
      </div>
    </div>
  );
}