import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function AgendamentoErro() {
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    toast({
      title: "Pagamento não aprovado",
      description: "Seu agendamento não foi confirmado. Tente novamente.",
      variant: "destructive"
    });
  }, [toast]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-background/80 flex items-center justify-center p-4">
      <Card className="max-w-md w-full bg-gradient-card border-border shadow-card">
        <CardContent className="p-8 text-center">
          <div className="mb-6">
            <XCircle className="w-16 h-16 text-red-500 mx-auto" />
          </div>
          
          <h1 className="text-2xl font-bold mb-4">
            Pagamento não aprovado
          </h1>
          
          <p className="text-muted-foreground mb-6">
            Houve um problema com o seu pagamento e o agendamento não foi confirmado. 
            Você pode tentar novamente.
          </p>
          
          <div className="space-y-3">
            <Button 
              variant="premium" 
              className="w-full"
              onClick={() => navigate('/services')}
            >
              Tentar Novamente
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