
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User, Edit2, Check, X } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { User as SupabaseUser } from "@supabase/supabase-js";

interface ProfileInfoProps {
  user: SupabaseUser;
  profile: any;
}

export function ProfileInfo({ user, profile }: ProfileInfoProps) {
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileData, setProfileData] = useState({
    full_name: profile?.full_name || '',
    phone: profile?.phone || ''
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const updateProfileMutation = useMutation({
    mutationFn: async (data: { full_name: string; phone: string }) => {
      if (!user?.id) throw new Error('Usuário não autenticado');
      
      // Try to update existing profile first
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ 
          full_name: data.full_name, 
          phone: data.phone 
        })
        .eq('user_id', user.id);
      
      // If no rows were updated, create the profile
      if (updateError) {
        const { error: insertError } = await supabase
          .from('profiles')
          .insert({ 
            user_id: user.id, 
            full_name: data.full_name, 
            phone: data.phone 
          });
        
        if (insertError) throw insertError;
      }
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

  const handleSaveProfile = () => {
    updateProfileMutation.mutate(profileData);
  };

  return (
    <div className="space-y-6">
      {/* Avatar e Info Principal */}
      <Card className="bg-gradient-card border-border/50">
        <CardContent className="p-6">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center">
              <User className="w-10 h-10 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">
                {profile?.full_name || 'Usuário'}
              </h2>
              <p className="text-muted-foreground text-sm">{user.email}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Informações Editáveis */}
      <Card className="bg-gradient-card border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Edit2 className="w-5 h-5" />
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
          <div className="space-y-4">
            <div>
              <Label htmlFor="full_name" className="text-sm font-medium text-muted-foreground">
                Nome Completo
              </Label>
              <Input 
                id="full_name" 
                value={profileData.full_name}
                onChange={(e) => setProfileData(prev => ({ ...prev, full_name: e.target.value }))}
                disabled={!editingProfile}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="phone" className="text-sm font-medium text-muted-foreground">
                Telefone
              </Label>
              <Input 
                id="phone" 
                value={profileData.phone}
                onChange={(e) => setProfileData(prev => ({ ...prev, phone: e.target.value }))}
                disabled={!editingProfile}
                placeholder="(11) 99999-9999"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="email" className="text-sm font-medium text-muted-foreground">
                E-mail
              </Label>
              <Input 
                id="email" 
                value={user.email || ''} 
                disabled 
                className="bg-muted/50 mt-1"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
