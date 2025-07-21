import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Calendar, Clock, User, Phone, Mail, Edit2, Check, X, CheckCircle } from "lucide-react";
import MapView from "@/components/MapView";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import type { User as SupabaseUser } from "@supabase/supabase-js";

const Perfil = () => {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileData, setProfileData] = useState({ full_name: '', phone: '' });
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Buscar perfil do usuário
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Buscar agendamentos do usuário
  const { data: appointments = [], isLoading: appointmentsLoading } = useQuery({
    queryKey: ['appointments', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data: profileData } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();
      
      if (!profileData) return [];

      const { data, error } = await supabase
        .from('appointments')
        .select(`
          *,
          services:service_id (name, price, duration_minutes)
        `)
        .eq('customer_id', profileData.id)
        .order('scheduled_time', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Mutation para atualizar perfil
  const updateProfileMutation = useMutation({
    mutationFn: async (data: { full_name: string; phone: string }) => {
      if (!user?.id) throw new Error('Usuário não autenticado');
      
      const { error } = await supabase
        .from('profiles')
        .upsert({ 
          user_id: user.id, 
          full_name: data.full_name, 
          phone: data.phone 
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      setEditingProfile(false);
      toast({
        title: "Perfil atualizado",
        description: "Suas informações foram salvas com sucesso."
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao atualizar perfil",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  useEffect(() => {
    if (profile) {
      setProfileData({
        full_name: profile.full_name || '',
        phone: profile.phone || ''
      });
    }
  }, [profile]);

  const handleSaveProfile = () => {
    updateProfileMutation.mutate(profileData);
  };

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

  if (loading || profileLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-gradient-background">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>;
  }

  if (!user) {
    navigate('/');
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-background">
      {/* Header */}
      <div className="bg-gradient-card border-b border-border p-3">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-lg font-bold">Meu Perfil</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 space-y-4">
        {/* Perfil do Usuário */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <User className="w-5 h-5" />
                Informações Pessoais
              </CardTitle>
              {!editingProfile ? (
                <Button variant="ghost" size="sm" onClick={() => setEditingProfile(true)}>
                  <Edit2 className="w-4 h-4" />
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setEditingProfile(false)}>
                    <X className="w-4 h-4" />
                  </Button>
                  <Button size="sm" onClick={handleSaveProfile} disabled={updateProfileMutation.isPending}>
                    <Check className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="email">E-mail</Label>
                <Input 
                  id="email" 
                  value={user.email || ''} 
                  disabled 
                  className="bg-muted"
                />
              </div>
              <div>
                <Label htmlFor="full_name">Nome Completo</Label>
                <Input 
                  id="full_name" 
                  value={profileData.full_name}
                  onChange={(e) => setProfileData(prev => ({ ...prev, full_name: e.target.value }))}
                  disabled={!editingProfile}
                />
              </div>
              <div>
                <Label htmlFor="phone">Telefone</Label>
                <Input 
                  id="phone" 
                  value={profileData.phone}
                  onChange={(e) => setProfileData(prev => ({ ...prev, phone: e.target.value }))}
                  disabled={!editingProfile}
                  placeholder="(11) 99999-9999"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Mapa da Barbearia */}
        <MapView />

        {/* Histórico de Agendamentos */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Meus Agendamentos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {appointmentsLoading ? (
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
      </div>
    </div>
  );
};

export default Perfil;