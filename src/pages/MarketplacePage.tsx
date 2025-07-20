import { useState, useEffect } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Marketplace } from '@/components/Marketplace'
import { ProductForm } from '@/components/ProductForm'
import { MercadoPagoConnect } from '@/components/MercadoPagoConnect'
import { SellerDashboard } from '@/components/SellerDashboard'
import { AuthForm } from '@/components/AuthForm'
import { supabase } from '@/integrations/supabase/client'
import { useToast } from '@/hooks/use-toast'
import { Store, ShoppingBag, Plus, BarChart3 } from 'lucide-react'

export default function MarketplacePage() {
  const [user, setUser] = useState<any>(null)
  const [isSeller, setIsSeller] = useState(false)
  const [isSellerConnected, setIsSellerConnected] = useState(false)
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    checkUser()
    
    // Escutar mudanças na autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          setUser(session.user)
          await checkSellerStatus(session.user.id)
        } else if (event === 'SIGNED_OUT') {
          setUser(null)
          setIsSeller(false)
          setIsSellerConnected(false)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const checkUser = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (session?.user) {
        setUser(session.user)
        await checkSellerStatus(session.user.id)
      }
    } catch (error) {
      console.error('Erro ao verificar usuário:', error)
    } finally {
      setLoading(false)
    }
  }

  const checkSellerStatus = async (userId: string) => {
    try {
      // Verificar se é vendedor
      const { data: seller } = await supabase
        .from('sellers')
        .select('id')
        .eq('user_id', userId)
        .single()

      setIsSeller(!!seller)

      if (seller) {
        // Verificar se tem tokens do MP
        const { data: tokens } = await supabase
          .from('mp_oauth_tokens')
          .select('id')
          .eq('seller_id', seller.id)
          .single()

        setIsSellerConnected(!!tokens)
      }
    } catch (error) {
      console.error('Erro ao verificar status do vendedor:', error)
    }
  }

  const becomeSeller = async () => {
    if (!user) return

    try {
      // Buscar perfil do usuário
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('user_id', user.id)
        .single()

      if (!profile) {
        toast({
          title: "Erro",
          description: "Perfil não encontrado. Tente fazer login novamente.",
          variant: "destructive"
        })
        return
      }

      // Criar vendedor
      const { error } = await supabase
        .from('sellers')
        .insert([{
          user_id: user.id,
          profile_id: profile.id,
          business_name: profile.full_name || 'Minha Loja'
        }])

      if (error) throw error

      setIsSeller(true)
      toast({
        title: "Parabéns!",
        description: "Você agora é um vendedor no marketplace!",
      })

    } catch (error: any) {
      console.error('Erro ao se tornar vendedor:', error)
      toast({
        title: "Erro",
        description: error.message || "Erro ao se tornar vendedor",
        variant: "destructive"
      })
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Carregando...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/10 to-secondary/10 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <Card>
            <CardHeader className="text-center">
              <Store className="h-12 w-12 mx-auto text-primary mb-4" />
              <CardTitle className="text-2xl">Marketplace</CardTitle>
              <CardDescription>
                Faça login para acessar o marketplace
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AuthForm onSuccess={() => {}} />
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold flex items-center gap-2 mb-2">
            <Store className="h-8 w-8 text-primary" />
            Marketplace
          </h1>
          <p className="text-muted-foreground">
            {isSeller 
              ? 'Gerencie seus produtos e vendas'
              : 'Descubra produtos incríveis ou torne-se um vendedor'
            }
          </p>
        </div>

        <Tabs defaultValue="marketplace" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4">
            <TabsTrigger value="marketplace" className="flex items-center gap-2">
              <ShoppingBag className="h-4 w-4" />
              Comprar
            </TabsTrigger>
            
            {isSeller && (
              <>
                <TabsTrigger value="dashboard" className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Dashboard
                </TabsTrigger>
                <TabsTrigger value="products" className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Produtos
                </TabsTrigger>
                <TabsTrigger value="settings" className="flex items-center gap-2">
                  <Store className="h-4 w-4" />
                  Configurações
                </TabsTrigger>
              </>
            )}
            
            {!isSeller && (
              <TabsTrigger value="seller" className="flex items-center gap-2">
                <Store className="h-4 w-4" />
                Vender
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="marketplace">
            <Marketplace currentUser={user} />
          </TabsContent>

          {isSeller && (
            <>
              <TabsContent value="dashboard">
                <SellerDashboard user={user} />
              </TabsContent>

              <TabsContent value="products">
                {isSellerConnected ? (
                  <ProductForm onSuccess={() => {
                    toast({
                      title: "Produto criado!",
                      description: "Produto adicionado com sucesso"
                    })
                  }} />
                ) : (
                  <Card>
                    <CardHeader>
                      <CardTitle>Conecte-se ao Mercado Pago</CardTitle>
                      <CardDescription>
                        Para vender produtos, você precisa conectar sua conta do Mercado Pago
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <MercadoPagoConnect onSuccess={() => setIsSellerConnected(true)} />
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="settings">
                <Card>
                  <CardHeader>
                    <CardTitle>Configurações do Vendedor</CardTitle>
                    <CardDescription>
                      Gerencie suas configurações de vendedor
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium">Status da Conta Mercado Pago</h4>
                          <p className="text-sm text-muted-foreground">
                            {isSellerConnected 
                              ? 'Conta conectada com sucesso'
                              : 'Conecte sua conta para receber pagamentos'
                            }
                          </p>
                        </div>
                        {!isSellerConnected && (
                          <MercadoPagoConnect onSuccess={() => setIsSellerConnected(true)} />
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </>
          )}

          {!isSeller && (
            <TabsContent value="seller">
              <Card>
                <CardHeader>
                  <CardTitle>Torne-se um Vendedor</CardTitle>
                  <CardDescription>
                    Comece a vender seus produtos no nosso marketplace
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4">
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-bold">
                        1
                      </div>
                      <div>
                        <h4 className="font-medium">Crie sua conta de vendedor</h4>
                        <p className="text-sm text-muted-foreground">
                          Configure seu perfil de vendedor no marketplace
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-bold">
                        2
                      </div>
                      <div>
                        <h4 className="font-medium">Conecte com Mercado Pago</h4>
                        <p className="text-sm text-muted-foreground">
                          Conecte sua conta para receber pagamentos automaticamente
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-bold">
                        3
                      </div>
                      <div>
                        <h4 className="font-medium">Adicione seus produtos</h4>
                        <p className="text-sm text-muted-foreground">
                          Cadastre produtos e comece a vender
                        </p>
                      </div>
                    </div>
                  </div>

                  <Button onClick={becomeSeller} className="w-full">
                    Tornar-se Vendedor
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  )
}