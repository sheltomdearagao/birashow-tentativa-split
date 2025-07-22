
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function ProfileHeader() {
  const navigate = useNavigate();

  return (
    <div className="bg-gradient-card border-b border-border p-3">
      <div className="max-w-4xl mx-auto flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h1 className="text-lg font-bold">Meu Perfil</h1>
      </div>
    </div>
  );
}
