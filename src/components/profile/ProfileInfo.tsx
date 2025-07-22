
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

  const handleSaveProfile = () => {
    updateProfileMutation.mutate(profileData);
  };

  return (
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
  );
}
