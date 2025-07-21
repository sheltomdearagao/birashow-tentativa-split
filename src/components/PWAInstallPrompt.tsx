import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { X, Download, Smartphone } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

const PWAInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Detectar iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(iOS);

    // Verificar se já foi instalado ou se o usuário já recusou
    const hasDeclined = localStorage.getItem('pwa-install-declined');
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    
    if (hasDeclined || isStandalone) {
      return;
    }

    // Listener para Android/Chrome
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      
      // Delay para mostrar o prompt após a página carregar
      setTimeout(() => {
        setShowInstallPrompt(true);
      }, 2000);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Para iOS, mostrar prompt customizado
    if (iOS && !isStandalone) {
      setTimeout(() => {
        setShowInstallPrompt(true);
      }, 2000);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
        setShowInstallPrompt(false);
      }
    }
  };

  const handleClose = () => {
    setShowInstallPrompt(false);
    localStorage.setItem('pwa-install-declined', 'true');
  };

  if (!showInstallPrompt) return null;

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-sm mx-auto relative">
        <CardContent className="p-6 text-center">
          <button
            onClick={handleClose}
            className="absolute top-2 right-2 p-1 rounded-full hover:bg-muted"
          >
            <X className="w-4 h-4" />
          </button>
          
          <div className="mb-4">
            <img 
              src="/lovable-uploads/4a4b38e3-1a5f-479e-b498-84fc34790acf.png" 
              alt="BIRASHOW Logo" 
              className="w-16 h-16 mx-auto mb-3"
            />
            <h3 className="font-bold text-lg mb-2">Instalar BIRASHOW</h3>
            <p className="text-muted-foreground text-sm mb-4">
              Adicione nosso app à sua tela inicial para acesso rápido e notificações.
            </p>
          </div>

          <div className="space-y-3">
            {!isIOS ? (
              <Button 
                onClick={handleInstallClick}
                className="w-full"
                size="lg"
              >
                <Download className="w-4 h-4 mr-2" />
                Instalar App
              </Button>
            ) : (
              <div className="text-left space-y-2">
                <p className="text-sm font-medium flex items-center">
                  <Smartphone className="w-4 h-4 mr-2" />
                  Como instalar:
                </p>
                <ol className="text-xs text-muted-foreground space-y-1">
                  <li>1. Toque no ícone de compartilhar ⬆️</li>
                  <li>2. Role para baixo e toque em "Adicionar à Tela de Início"</li>
                  <li>3. Toque em "Adicionar" no canto superior direito</li>
                </ol>
              </div>
            )}
            
            <Button 
              onClick={handleClose}
              variant="outline" 
              className="w-full"
            >
              Agora não
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PWAInstallPrompt;