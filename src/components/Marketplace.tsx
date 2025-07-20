import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { supabase } from '@/integrations/supabase/client'
import { ShoppingCart, Package, Loader2 } from 'lucide-react'

interface Product {
  id: string
  name: string
  description: string
  price: number
  category: string
  image_url: string
  stock_quantity: number
  seller_id: string
  sellers: {
    business_name: string
  }
}

interface MarketplaceProps {
  currentUser?: any
}

export const Marketplace = ({ currentUser }: MarketplaceProps) => {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [cart, setCart] = useState<{[key: string]: number}>({})
  const [processingPayment, setProcessingPayment] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    fetchProducts()
  }, [])

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          sellers!inner(business_name)
        `)
        .eq('is_active', true)
        .gt('stock_quantity', 0)
        .order('created_at', { ascending: false })

      if (error) throw error
      setProducts(data || [])
    } catch (error: any) {
      console.error('Erro ao buscar produtos:', error)
      toast({
        title: "Erro",
        description: "Erro ao carregar produtos",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const addToCart = (productId: string) => {
    setCart(prev => ({
      ...prev,
      [productId]: (prev[productId] || 0) + 1
    }))
    toast({
      title: "Produto adicionado",
      description: "Produto adicionado ao carrinho",
    })
  }

  const removeFromCart = (productId: string) => {
    setCart(prev => {
      const newCart = { ...prev }
      if (newCart[productId] > 1) {
        newCart[productId]--
      } else {
        delete newCart[productId]
      }
      return newCart
    })
  }

  const getCartTotal = () => {
    return Object.entries(cart).reduce((total, [productId, quantity]) => {
      const product = products.find(p => p.id === productId)
      return total + (product?.price || 0) * quantity
    }, 0)
  }

  const processCheckout = async () => {
    if (!currentUser) {
      toast({
        title: "Login necessário",
        description: "Faça login para finalizar a compra",
        variant: "destructive"
      })
      return
    }

    if (Object.keys(cart).length === 0) {
      toast({
        title: "Carrinho vazio",
        description: "Adicione produtos ao carrinho",
        variant: "destructive"
      })
      return
    }

    try {
      setProcessingPayment(true)

      // Preparar itens do carrinho
      const items = Object.entries(cart).map(([productId, quantity]) => ({
        product_id: productId,
        quantity
      }))

      // Chamar edge function para criar preferência
      const { data, error } = await supabase.functions.invoke('mp-create-preference', {
        body: { items, marketplace_fee_percentage: 10 }
      })

      if (error) throw error

      // Redirecionar para Mercado Pago
      window.open(data.init_point, '_blank')

      // Limpar carrinho
      setCart({})
      
      toast({
        title: "Redirecionando...",
        description: "Você será redirecionado para o Mercado Pago",
      })

    } catch (error: any) {
      console.error('Erro no checkout:', error)
      toast({
        title: "Erro no checkout",
        description: error.message || "Erro ao processar pagamento",
        variant: "destructive"
      })
    } finally {
      setProcessingPayment(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Marketplace</h2>
        
        {Object.keys(cart).length > 0 && (
          <Card className="p-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                <span className="font-medium">
                  {Object.values(cart).reduce((sum, qty) => sum + qty, 0)} itens
                </span>
              </div>
              <span className="font-bold text-lg">
                R$ {getCartTotal().toFixed(2)}
              </span>
              <Button 
                onClick={processCheckout}
                disabled={processingPayment}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {processingPayment ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processando...
                  </>
                ) : (
                  'Finalizar Compra'
                )}
              </Button>
            </div>
          </Card>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {products.map((product) => (
          <Card key={product.id} className="overflow-hidden">
            {product.image_url && (
              <div className="h-48 overflow-hidden">
                <img
                  src={product.image_url}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">{product.name}</CardTitle>
              <Badge variant="outline" className="w-fit">
                {product.category}
              </Badge>
            </CardHeader>

            <CardContent className="space-y-3">
              {product.description && (
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {product.description}
                </p>
              )}

              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Package className="h-4 w-4" />
                <span>{product.stock_quantity} em estoque</span>
              </div>

              <div className="text-sm text-muted-foreground">
                Vendido por: {product.sellers.business_name}
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xl font-bold text-primary">
                  R$ {product.price.toFixed(2)}
                </span>

                <div className="flex items-center gap-2">
                  {cart[product.id] ? (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => removeFromCart(product.id)}
                      >
                        -
                      </Button>
                      <span className="font-medium">{cart[product.id]}</span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => addToCart(product.id)}
                        disabled={cart[product.id] >= product.stock_quantity}
                      >
                        +
                      </Button>
                    </div>
                  ) : (
                    <Button
                      onClick={() => addToCart(product.id)}
                      disabled={product.stock_quantity === 0}
                    >
                      <ShoppingCart className="h-4 w-4 mr-2" />
                      Adicionar
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {products.length === 0 && (
        <div className="text-center py-12">
          <Package className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Nenhum produto encontrado
          </h3>
          <p className="text-gray-500">
            Produtos aparecerão aqui quando estiverem disponíveis.
          </p>
        </div>
      )}
    </div>
  )
}