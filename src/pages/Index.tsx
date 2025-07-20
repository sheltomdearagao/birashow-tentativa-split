import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AuthForm } from "@/components/AuthForm";
import { Services } from "@/pages/Services";
import { Queue } from "@/pages/Queue";
import { AnalyticsDashboard } from "@/components/AnalyticsDashboard";
import { Scissors, Calendar, BarChart3, Menu, LogOut, MapPin, Clock, Phone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { User } from "@supabase/supabase-js";

type PageView = 'home' | 'services' | 'queue' | 'analytics';

const Index = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState<PageView>('home');
  const { toast } = useToast();

  useEffect(() => {
    // Verificar sessão existente
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Escutar mudanças de autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({
        title: "Erro ao sair",
        description: error.message,
        variant: "destructive"
      });
    } else {
      setCurrentPage('home');
      toast({
        title: "Logout realizado",
        description: "Você foi desconectado com sucesso."
      });
    }
  };

  const handleAuthSuccess = () => {
    setCurrentPage('home');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-background">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <AuthForm onSuccess={handleAuthSuccess} />;
  }

  if (currentPage === 'services') {
    return (
      <Services 
        onBack={() => setCurrentPage('home')} 
        onServiceSelected={() => setCurrentPage('queue')}
        user={user}
      />
    );
  }

  if (currentPage === 'queue') {
    return <Queue onBack={() => setCurrentPage('home')} user={user} />;
  }

  if (currentPage === 'analytics') {
    return (
      <div className="min-h-screen bg-gradient-background p-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <Button variant="ghost" onClick={() => setCurrentPage('home')}>
              Voltar
            </Button>
            <Button variant="ghost" onClick={handleSignOut}>
              <LogOut className="w-4 h-4 mr-2" />
              Sair
            </Button>
          </div>
          <AnalyticsDashboard />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-background">
      {/* Header */}
      <div className="bg-gradient-card border-b border-border p-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-primary p-2 rounded-lg">
              <Scissors className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold">BiraShow</h1>
              <p className="text-sm text-muted-foreground">Tradição, Estilo e Modernidade</p>
            </div>
          </div>
          <Button variant="ghost" onClick={handleSignOut}>
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 space-y-6">
        {/* Welcome Section */}
        <Card className="bg-gradient-card border-border shadow-card">
          <CardContent className="p-6 text-center">
            <h2 className="text-2xl font-bold mb-2">Bem-vindo à Barbearia</h2>
            <p className="text-muted-foreground mb-6">
              Há mais de 20 anos oferecendo o melhor em cortes masculinos, barba e cuidados pessoais.
              Agende online de forma prática e rápida.
            </p>
            <Button variant="premium" size="lg" onClick={() => setCurrentPage('services')}>
              Agendar Agora
            </Button>
          </CardContent>
        </Card>

        {/* Action Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card 
            className="bg-gradient-card border-border shadow-card cursor-pointer hover:scale-105 transition-transform duration-300"
            onClick={() => setCurrentPage('services')}
          >
            <CardContent className="p-6 text-center">
              <Scissors className="w-12 h-12 mx-auto text-primary mb-4" />
              <h3 className="font-semibold text-lg mb-2">Nossos Serviços</h3>
              <p className="text-sm text-muted-foreground">
                Escolha os serviços desejados e agende seu horário
              </p>
            </CardContent>
          </Card>

          <Card 
            className="bg-gradient-card border-border shadow-card cursor-pointer hover:scale-105 transition-transform duration-300"
            onClick={() => setCurrentPage('queue')}
          >
            <CardContent className="p-6 text-center">
              <Calendar className="w-12 h-12 mx-auto text-primary mb-4" />
              <h3 className="font-semibold text-lg mb-2">Fila de Hoje</h3>
              <p className="text-sm text-muted-foreground">
                Acompanhe sua posição na fila de atendimento
              </p>
            </CardContent>
          </Card>

          <Card 
            className="bg-gradient-card border-border shadow-card cursor-pointer hover:scale-105 transition-transform duration-300"
            onClick={() => setCurrentPage('analytics')}
          >
            <CardContent className="p-6 text-center">
              <BarChart3 className="w-12 h-12 mx-auto text-primary mb-4" />
              <h3 className="font-semibold text-lg mb-2">Painel Analítico</h3>
              <p className="text-sm text-muted-foreground">
                Visualize estatísticas e relatórios
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Business Hours */}
        <Card className="bg-gradient-card border-border shadow-card">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-5 h-5 text-primary" />
              <h3 className="font-semibold text-lg">Horário de Funcionamento</h3>
            </div>
            
            <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 mb-4">
              <div className="text-center">
                <h4 className="font-semibold text-lg mb-2">Terça a Domingo</h4>
                <div className="text-xl font-bold mb-1">9:00 às 12:00</div>
                <div className="text-xl font-bold">14:00 às 21:00</div>
              </div>
            </div>
            
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-center">
              <span className="text-destructive font-medium">🚫 Fechado às Segundas-feiras</span>
            </div>
          </CardContent>
        </Card>

        {/* Contact & Location */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="bg-gradient-card border-border shadow-card">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <Phone className="w-5 h-5 text-primary" />
                <h3 className="font-semibold">Contato</h3>
              </div>
              <p className="text-lg font-medium">(71) 99274-1864</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-card border-border shadow-card">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <MapPin className="w-5 h-5 text-primary" />
                <h3 className="font-semibold">Localização</h3>
              </div>
              <div className="space-y-1">
                <p className="font-medium">Barbearia BiraShow</p>
                <p className="text-sm text-muted-foreground">R. Heide Carneiro, 50 - Trobogy</p>
                <p className="text-sm text-muted-foreground">Salvador - BA, 41745-135</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Footer */}
        <div className="text-center py-6 border-t border-border">
          <p className="text-sm text-muted-foreground">
            © 2025 Barbearia Birashow - Por Salvador Conecta. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Index;
