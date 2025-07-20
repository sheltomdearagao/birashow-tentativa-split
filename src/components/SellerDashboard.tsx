import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { supabase } from '@/integrations/supabase/client'
import { Package, DollarSign, ShoppingBag, TrendingUp } from 'lucide-react'

interface SellerDashboardProps {
  user: any
}

interface SellerStats {
  totalProducts: number
  totalOrders: number
  totalRevenue: number
  pendingOrders: number
}

interface Order {
  id: string
  status: string
  total_amount: number
  marketplace_fee: number
  created_at: string
  profiles?: {
    full_name: string
  }
  order_items?: {
    quantity: number
    products?: {
      name: string
    }
  }[]
}

export const SellerDashboard = ({ user }: SellerDashboardProps) => {
  const [stats, setStats] = useState<SellerStats>({
    totalProducts: 0,
    totalOrders: 0,
    totalRevenue: 0,
    pendingOrders: 0
  })
  const [recentOrders, setRecentOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    fetchDashboardData()
  }, [user])

  const fetchDashboardData = async () => {
    try {
      // Buscar vendedor
      const { data: seller } = await supabase
        .from('sellers')
        .select('id')
        .eq('user_id', user.id)
        .single()

      if (!seller) {
        setLoading(false)
        return
      }

      // Buscar estatísticas de produtos
      const { data: products } = await supabase
        .from('products')
        .select('id')
        .eq('seller_id', seller.id)
        .eq('is_active', true)

      // Buscar pedidos
      const { data: orders } = await supabase
        .from('orders')
        .select(`
          id,
          status,
          total_amount,
          marketplace_fee,
          created_at,
          profiles!orders_buyer_id_fkey(full_name),
          order_items(
            quantity,
            products(name)
          )
        `)
        .eq('seller_id', seller.id)
        .order('created_at', { ascending: false })

      if (orders) {
        const totalRevenue = orders
          .filter(order => order.status === 'paid')
          .reduce((sum, order) => sum + (order.total_amount - order.marketplace_fee), 0)

        const pendingOrders = orders.filter(order => order.status === 'pending').length

        setStats({
          totalProducts: products?.length || 0,
          totalOrders: orders.length,
          totalRevenue,
          pendingOrders
        })

        setRecentOrders(orders.slice(0, 5) as Order[])
      }

    } catch (error: any) {
      console.error('Erro ao buscar dados do dashboard:', error)
      toast({
        title: "Erro",
        description: "Erro ao carregar dados do dashboard",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const statusMap = {
      pending: { label: 'Pendente', variant: 'secondary' as const },
      paid: { label: 'Pago', variant: 'default' as const },
      shipped: { label: 'Enviado', variant: 'outline' as const },
      delivered: { label: 'Entregue', variant: 'default' as const },
      cancelled: { label: 'Cancelado', variant: 'destructive' as const }
    }

    const statusInfo = statusMap[status as keyof typeof statusMap] || statusMap.pending
    return (
      <Badge variant={statusInfo.variant}>
        {statusInfo.label}
      </Badge>
    )
  }

  if (loading) {
    return <div>Carregando dashboard...</div>
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Dashboard do Vendedor</h2>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Produtos Ativos</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalProducts}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Pedidos</CardTitle>
            <ShoppingBag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalOrders}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receita Total</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ {stats.totalRevenue.toFixed(2)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pedidos Pendentes</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingOrders}</div>
          </CardContent>
        </Card>
      </div>

      {/* Pedidos Recentes */}
      <Card>
        <CardHeader>
          <CardTitle>Pedidos Recentes</CardTitle>
        </CardHeader>
        <CardContent>
          {recentOrders.length > 0 ? (
            <div className="space-y-4">
              {recentOrders.map((order) => (
                <div key={order.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">#{order.id.slice(0, 8)}</span>
                      {getStatusBadge(order.status)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Cliente: {order.profiles?.full_name || 'N/A'}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {order.order_items?.map(item => 
                        `${item.quantity}x ${item.products?.name || 'Produto'}`
                      ).join(', ') || 'Sem itens'}
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="font-bold">
                      R$ {(order.total_amount - order.marketplace_fee).toFixed(2)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {new Date(order.created_at).toLocaleDateString('pt-BR')}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <ShoppingBag className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Nenhum pedido ainda
              </h3>
              <p className="text-gray-500">
                Seus pedidos aparecerão aqui quando você fizer suas primeiras vendas.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}