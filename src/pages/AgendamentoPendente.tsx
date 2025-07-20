import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function AgendamentoPendente() {
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    toast({
      title: "Pagamento pendente",
      description: "Aguardando confirmação do pagamento para finalizar o agendamento.",
    });
  }, [toast]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-background/80 flex items-center justify-center p-4">
      <Card className="max-w-md w-full bg-gradient-card border-border shadow-card">
        <CardContent className="p-8 text-center">
          <div className="mb-6">
            <Clock className="w-16 h-16 text-yellow-500 mx-auto" />
          </div>
          
          <h1 className="text-2xl font-bold mb-4">
            Pagamento Pendente
          </h1>
          
          <p className="text-muted-foreground mb-6">
            Aguardando a confirmação do seu pagamento. O agendamento será confirmado 
            assim que o pagamento for processado.
          </p>
          
          <div className="space-y-3">
            <Button 
              variant="premium" 
              className="w-full"
              onClick={() => navigate('/services')}
            >
              Ver Status dos Agendamentos
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