import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { supabase } from '@/integrations/supabase/client'
import { Loader2, Store } from 'lucide-react'

interface MercadoPagoConnectProps {
  onSuccess?: () => void
}

export const MercadoPagoConnect = ({ onSuccess }: MercadoPagoConnectProps) => {
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  const handleConnect = async () => {
    try {
      setIsLoading(true)

      // Chamar edge function para iniciar OAuth
      const { data, error } = await supabase.functions.invoke('mp-oauth-authorize')

      if (error) {
        throw new Error(error.message)
      }

      // Abrir janela popup para autorização
      const popup = window.open(
        data.authorization_url,
        'mercadopago-auth',
        'width=500,height=600,scrollbars=yes,resizable=yes'
      )

      // Escutar mensagens da janela popup
      const handleMessage = (event: MessageEvent) => {
        if (event.data.type === 'MP_AUTH_SUCCESS') {
          toast({
            title: "Mercado Pago conectado!",
            description: "Sua conta foi conectada com sucesso.",
          })
          popup?.close()
          onSuccess?.()
          window.removeEventListener('message', handleMessage)
        } else if (event.data.type === 'MP_AUTH_ERROR') {
          toast({
            title: "Erro na conexão",
            description: event.data.error || "Erro ao conectar com Mercado Pago",
            variant: "destructive",
          })
          popup?.close()
          window.removeEventListener('message', handleMessage)
        }
      }

      window.addEventListener('message', handleMessage)

      // Verificar se popup foi fechado manualmente
      const checkClosed = setInterval(() => {
        if (popup?.closed) {
          clearInterval(checkClosed)
          window.removeEventListener('message', handleMessage)
          setIsLoading(false)
        }
      }, 1000)

    } catch (error) {
      console.error('Erro ao conectar MP:', error)
      toast({
        title: "Erro",
        description: "Erro ao conectar com Mercado Pago",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-4 p-6 border rounded-lg">
      <Store className="h-12 w-12 text-primary" />
      <div className="text-center">
        <h3 className="text-lg font-medium mb-2">Conectar com Mercado Pago</h3>
        <p className="text-muted-foreground text-sm mb-4">
          Conecte sua conta do Mercado Pago para receber pagamentos automaticamente
        </p>
      </div>
      
      <Button 
        onClick={handleConnect} 
        disabled={isLoading}
        className="w-full"
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Conectando...
          </>
        ) : (
          'Conectar Mercado Pago'
        )}
      </Button>
    </div>
  )
}