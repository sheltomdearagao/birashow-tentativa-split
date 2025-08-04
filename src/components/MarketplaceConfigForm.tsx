import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

interface MarketplaceConfig {
  id: string;
  default_fee_percentage: number;
  min_fee_amount: number;
  max_fee_percentage: number;
  is_active: boolean;
}

interface SellerConfig {
  id: string;
  seller_id: string;
  custom_fee_percentage: number;
  is_active: boolean;
  profiles: {
    full_name: string;
  };
}

export function MarketplaceConfigForm() {
  const [globalConfig, setGlobalConfig] = useState({
    default_fee_percentage: 4.0,
    min_fee_amount: 0.5,
    max_fee_percentage: 30.0
  });

  // Por enquanto, vamos simular a configuração sem as novas tabelas
  const mockConfig = {
    id: '1',
    default_fee_percentage: 4.0,
    min_fee_amount: 0.5,
    max_fee_percentage: 30.0,
    is_active: true
  };

  const handleGlobalConfigSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    setGlobalConfig({
      default_fee_percentage: Number(formData.get('default_fee_percentage')),
      min_fee_amount: Number(formData.get('min_fee_amount')),
      max_fee_percentage: Number(formData.get('max_fee_percentage'))
    });
    
    toast.success('Configuração atualizada! (Demo - implementar backend completo)');
  };

  return (
    <div className="space-y-6">
      {/* Configuração Global do Marketplace */}
      <Card>
        <CardHeader>
          <CardTitle>Configuração Global de Taxas</CardTitle>
          <CardDescription>
            Configure as taxas padrão aplicadas no marketplace
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleGlobalConfigSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="default_fee_percentage">Taxa Padrão (%)</Label>
                <Input
                  id="default_fee_percentage"
                  name="default_fee_percentage"
                  type="number"
                  step="0.01"
                  min="0"
                  max="30"
                  defaultValue={globalConfig.default_fee_percentage}
                  placeholder="4.0"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="min_fee_amount">Taxa Mínima (R$)</Label>
                <Input
                  id="min_fee_amount"
                  name="min_fee_amount"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={globalConfig.min_fee_amount}
                  placeholder="0.50"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="max_fee_percentage">Taxa Máxima (%)</Label>
                <Input
                  id="max_fee_percentage"
                  name="max_fee_percentage"
                  type="number"
                  step="0.01"
                  min="0"
                  max="50"
                  defaultValue={globalConfig.max_fee_percentage}
                  placeholder="30.0"
                />
              </div>
            </div>
            
            <Button type="submit">
              Salvar Configuração
            </Button>
          </form>
        </CardContent>
      </Card>

      <Separator />

      {/* Configurações Personalizadas por Vendedor */}
      <Card>
        <CardHeader>
          <CardTitle>Configurações Personalizadas por Vendedor</CardTitle>
          <CardDescription>
            Configure taxas específicas para vendedores individuais
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="p-4 border rounded-lg bg-yellow-50 dark:bg-yellow-950">
            <h4 className="font-medium text-yellow-800 dark:text-yellow-200 mb-2">
              Funcionalidade em Desenvolvimento
            </h4>
            <p className="text-sm text-yellow-700 dark:text-yellow-300">
              As configurações personalizadas por vendedor serão implementadas quando as tabelas de split payment forem criadas no banco de dados.
            </p>
          </div>
          
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Configuração Atual:</h4>
            <div className="p-3 border rounded-lg">
              <p className="text-sm text-muted-foreground">
                Taxa padrão aplicada a todos os vendedores: <strong>{globalConfig.default_fee_percentage}%</strong>
              </p>
              <p className="text-sm text-muted-foreground">
                Taxa mínima: <strong>R$ {globalConfig.min_fee_amount.toFixed(2)}</strong>
              </p>
              <p className="text-sm text-muted-foreground">
                Taxa máxima: <strong>{globalConfig.max_fee_percentage}%</strong>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}