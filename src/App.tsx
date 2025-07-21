import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Perfil from "./pages/Perfil";
import MarketplacePage from "./pages/MarketplacePage";
import AgendamentoConfirmado from "./pages/AgendamentoConfirmado";
import AgendamentoErro from "./pages/AgendamentoErro";
import AgendamentoPendente from "./pages/AgendamentoPendente";
import NotFound from "./pages/NotFound";
import PWAInstallPrompt from "./components/PWAInstallPrompt";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <PWAInstallPrompt />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/perfil" element={<Perfil />} />
          <Route path="/marketplace" element={<MarketplacePage />} />
          <Route path="/agendamento-confirmado" element={<AgendamentoConfirmado />} />
          <Route path="/agendamento-erro" element={<AgendamentoErro />} />
          <Route path="/agendamento-pendente" element={<AgendamentoPendente />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
