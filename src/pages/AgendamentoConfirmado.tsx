import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function AgendamentoConfirmado() {
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    toast({
      title: "Pagamento aprovado!",
      description: "Seu agendamento foi confirmado com sucesso.",
    });
  }, [toast]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-background/80 flex items-center justify-center p-4">
      <Card className="max-w-md w-full bg-gradient-card border-border shadow-card">
        <CardContent className="p-8 text-center">
          <div className="mb-6">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />
          </div>
          
          <h1 className="text-2xl font-bold mb-4">
            Agendamento Confirmado!
          </h1>
          
          <p className="text-muted-foreground mb-6">
            Seu pagamento foi aprovado e seu agendamento foi confirmado com sucesso. 
            Você receberá mais detalhes em breve.
          </p>
          
          <div className="space-y-3">
            <Button 
              variant="premium" 
              className="w-full"
              onClick={() => navigate('/services')}
            >
              Ver Meus Agendamentos
            </Button>
            
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => navigate('/')}
            >
              Voltar ao Início
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}