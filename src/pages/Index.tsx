import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AuthForm } from "@/components/AuthForm";
import { SchedulingCalendar } from "@/components/SchedulingCalendar";
import { Scissors, User, MapPin, Clock, Phone, Navigation } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import type { User as SupabaseUser } from "@supabase/supabase-js";

const Index = () => {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [showScheduling, setShowScheduling] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  // Buscar serviços
  const { data: services = [], isLoading: servicesLoading } = useQuery({
    queryKey: ['services'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('is_active', true)
        .order('price');
      
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    // Verificar sessão existente
    supabase.auth.getSession().then(({
      data: {
        session
      }
    }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Escutar mudanças de autenticação
    const {
      data: {
        subscription
      }
    } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);
  const handleSignOut = async () => {
    const {
      error
    } = await supabase.auth.signOut();
    if (error) {
      toast({
        title: "Erro ao sair",
        description: error.message,
        variant: "destructive"
      });
    } else {
      setSelectedServices([]);
      setShowScheduling(false);
      toast({
        title: "Logout realizado",
        description: "Você foi desconectado com sucesso."
      });
    }
  };

  const handleServiceToggle = (serviceId: string) => {
    setSelectedServices(prev => 
      prev.includes(serviceId) 
        ? prev.filter(id => id !== serviceId)
        : [...prev, serviceId]
    );
  };

  const openDirections = () => {
    const googleMapsUrl = 'https://www.google.com/maps/dir//R.+Heide+Carneiro,+50+-+Trobogy,+Salvador+-+BA,+41745-135';
    window.open(googleMapsUrl, '_blank');
  };

  const handleProceedToScheduling = () => {
    if (selectedServices.length === 0) {
      toast({
        title: "Selecione um serviço",
        description: "Escolha pelo menos um serviço para continuar.",
        variant: "destructive"
      });
      return;
    }
    setShowScheduling(true);
  };

  const getTotalPrice = () => {
    return selectedServices.reduce((total, serviceId) => {
      const service = services.find(s => s.id === serviceId);
      return total + (service?.price || 0);
    }, 0);
  };
  if (loading || servicesLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-gradient-background">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>;
  }
  
  if (!user) {
    return <AuthForm onSuccess={() => {}} />;
  }

  if (showScheduling) {
    return <div className="min-h-screen bg-gradient-background p-4">
        <SchedulingCalendar 
          selectedServices={selectedServices} 
          user={user} 
          onBack={() => setShowScheduling(false)} 
          onScheduled={() => {
            setSelectedServices([]);
            setShowScheduling(false);
          }} 
        />
      </div>;
  }
  return <div className="min-h-screen bg-gradient-background">
      {/* Header */}
      <div className="bg-gradient-card border-b border-border p-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-primary p-2 rounded-lg">
              <Scissors className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold">BIRASHOW</h1>
              <p className="text-xs text-muted-foreground">Tradição, Estilo e Modernidade</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate('/perfil')}>
              <User className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              Sair
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-4">
        {/* Serviços Grid */}
        <div className="mb-6">
          <h2 className="text-xl font-bold mb-4">Escolha seus serviços</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {services.map((service) => (
              <div key={service.id} className={`p-4 border rounded-lg cursor-pointer transition-all hover:scale-105 ${
                selectedServices.includes(service.id) 
                  ? 'border-primary bg-primary/10' 
                  : 'border-border bg-gradient-card'
              }`} onClick={() => handleServiceToggle(service.id)}>
                <div className="text-center">
                  <Scissors className="w-6 h-6 mx-auto text-primary mb-2" />
                  <h3 className="font-medium text-sm mb-1">{service.name}</h3>
                  <p className="text-lg font-bold text-primary">
                    {new Intl.NumberFormat('pt-BR', {
                      style: 'currency',
                      currency: 'BRL'
                    }).format(service.price)}
                  </p>
                  <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mt-1">
                    <Clock className="w-3 h-3" />
                    <span>{service.duration_minutes}min</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Total e Botão de Agendamento */}
        {selectedServices.length > 0 && (
          <div className="bg-gradient-card border border-border rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  {selectedServices.length} serviço{selectedServices.length > 1 ? 's' : ''} selecionado{selectedServices.length > 1 ? 's' : ''}
                </p>
                <p className="text-xl font-bold text-primary">
                  Total: {new Intl.NumberFormat('pt-BR', {
                    style: 'currency',
                    currency: 'BRL'
                  }).format(getTotalPrice())}
                </p>
              </div>
              <Button onClick={handleProceedToScheduling} size="lg">
                Escolher Horário
              </Button>
            </div>
          </div>
        )}

        {/* Localização da Barbearia */}
        <div className="mb-6">
          <Card>
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <MapPin className="w-5 h-5" />
                  Nossa Localização
                </h3>
                <Button onClick={openDirections} size="sm">
                  <Navigation className="w-4 h-4 mr-2" />
                  Como Chegar
                </Button>
              </div>
              <div className="w-full h-64 rounded-lg overflow-hidden">
                <iframe 
                  src="https://www.google.com/maps/embed?pb=!1m14!1m8!1m3!1d1169.6372364937565!2d-38.4057596!3d-12.9293001!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x71610b41b2a5cc1%3A0x82a85e5736a1f597!2sR.%20Heide%20Carneiro%2C%2050%20-%20Trobogy%2C%20Salvador%20-%20BA%2C%2041745-135!5e1!3m2!1spt-BR!2sbr!4v1753121176658!5m2!1spt-BR!2sbr" 
                  width="100%" 
                  height="100%" 
                  style={{border:0}} 
                  allowFullScreen={true}
                  loading="lazy" 
                  referrerPolicy="no-referrer-when-downgrade"
                  title="Localização da Barbearia"
                />
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                R. Heide Carneiro, 50 - Trobogy, Salvador - BA
              </p>
            </div>
          </Card>
        </div>

        {/* Informações da Barbearia */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-center">
          <div className="bg-gradient-card border border-border rounded-lg p-4">
            <h3 className="font-semibold mb-2">Horário de Funcionamento</h3>
            <div className="text-sm space-y-1">
              <p><span className="font-medium">Ter - Dom:</span> 9h às 12h • 14h às 21h</p>
              <p className="text-destructive">🚫 Fechado às Segundas</p>
            </div>
          </div>
          <div className="bg-gradient-card border border-border rounded-lg p-4">
            <h3 className="font-semibold mb-2">Contato & Localização</h3>
            <div className="text-sm space-y-1">
              <p className="flex items-center justify-center gap-1">
                <Phone className="w-3 h-3" /> (71) 99274-1864
              </p>
              <p className="flex items-center justify-center gap-1">
                <MapPin className="w-3 h-3" /> R. Heide Carneiro, 50 - Trobogy
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>;
};
export default Index;