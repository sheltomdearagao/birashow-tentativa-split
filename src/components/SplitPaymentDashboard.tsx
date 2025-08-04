import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface SplitPayment {
  id: string;
  order_id: string;
  payment_id: string;
  total_amount: number;
  seller_amount: number;
  marketplace_fee: number;
  status: string;
  processed_at: string | null;
  created_at: string;
  orders: {
    id: string;
    buyer_id: string;
    seller_id: string;
    order_items: Array<{
      quantity: number;
      unit_price: number;
      products: {
        name: string;
      };
    }>;
  };
}

interface MarketplaceStats {
  total_revenue: number;
  total_fees: number;
  total_orders: number;
  approved_payments: number;
}

export function SplitPaymentDashboard() {
  const { data: splitPayments, isLoading } = useQuery({
    queryKey: ['orders-split-view'],
    queryFn: async () => {
      const { data: orders, error } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            quantity,
            unit_price,
            products (name)
          )
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      return orders?.map(order => ({
        id: order.id,
        order_id: order.id,
        payment_id: order.mp_preference_id || `mp_${order.id.slice(0, 8)}`,
        total_amount: order.total_amount,
        seller_amount: order.total_amount - (order.marketplace_fee || 0),
        marketplace_fee: order.marketplace_fee || 0,
        status: order.status === 'paid' ? 'approved' : order.status,
        processed_at: order.status === 'paid' ? order.updated_at : null,
        created_at: order.created_at,
        orders: order
      })) || [];
    }
  });

  const { data: stats } = useQuery({
    queryKey: ['marketplace-stats'],
    queryFn: async () => {
      const { data: orders, error } = await supabase
        .from('orders')
        .select('total_amount, marketplace_fee, status');
      
      if (error) throw error;
      
      const paidOrders = orders?.filter(o => o.status === 'paid') || [];
      
      const stats: MarketplaceStats = {
        total_revenue: orders?.reduce((sum, item) => sum + Number(item.total_amount), 0) || 0,
        total_fees: orders?.reduce((sum, item) => sum + Number(item.marketplace_fee || 0), 0) || 0,
        total_orders: orders?.length || 0,
        approved_payments: paidOrders.length
      };
      
      return stats;
    }
  });

  const getStatusBadge = (status: string) => {
    const variants = {
      approved: "default",
      pending: "secondary", 
      rejected: "destructive"
    } as const;
    
    const labels = {
      approved: "Aprovado",
      pending: "Pendente",
      rejected: "Rejeitado"
    };
    
    return (
      <Badge variant={variants[status as keyof typeof variants] || "secondary"}>
        {labels[status as keyof typeof labels] || status}
      </Badge>
    );
  };

  if (isLoading) {
    return <div>Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receita Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(stats?.total_revenue || 0)}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa Marketplace</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(stats?.total_fees || 0)}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Pedidos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total_orders || 0}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pagamentos Aprovados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.approved_payments || 0}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">Todos os Pagamentos</TabsTrigger>
          <TabsTrigger value="approved">Aprovados</TabsTrigger>
          <TabsTrigger value="pending">Pendentes</TabsTrigger>
        </TabsList>
        
        <TabsContent value="all">
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Split Payments</CardTitle>
              <CardDescription>
                Todos os pagamentos processados com divisão de valores
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID do Pagamento</TableHead>
                    <TableHead>Valor Total</TableHead>
                    <TableHead>Valor Vendedor</TableHead>
                    <TableHead>Taxa Marketplace</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {splitPayments?.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell className="font-mono text-sm">
                        {payment.payment_id}
                      </TableCell>
                      <TableCell>{formatCurrency(payment.total_amount)}</TableCell>
                      <TableCell>{formatCurrency(payment.seller_amount)}</TableCell>
                      <TableCell>{formatCurrency(payment.marketplace_fee)}</TableCell>
                      <TableCell>{getStatusBadge(payment.status)}</TableCell>
                      <TableCell>
                        {format(new Date(payment.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="approved">
          <Card>
            <CardHeader>
              <CardTitle>Pagamentos Aprovados</CardTitle>
              <CardDescription>
                Pagamentos processados com sucesso
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID do Pagamento</TableHead>
                    <TableHead>Valor Total</TableHead>
                    <TableHead>Valor Vendedor</TableHead>
                    <TableHead>Taxa Marketplace</TableHead>
                    <TableHead>Data de Processamento</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {splitPayments?.filter(p => p.status === 'approved').map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell className="font-mono text-sm">
                        {payment.payment_id}
                      </TableCell>
                      <TableCell>{formatCurrency(payment.total_amount)}</TableCell>
                      <TableCell>{formatCurrency(payment.seller_amount)}</TableCell>
                      <TableCell>{formatCurrency(payment.marketplace_fee)}</TableCell>
                      <TableCell>
                        {payment.processed_at && format(new Date(payment.processed_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="pending">
          <Card>
            <CardHeader>
              <CardTitle>Pagamentos Pendentes</CardTitle>
              <CardDescription>
                Pagamentos aguardando confirmação
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID do Pagamento</TableHead>
                    <TableHead>Valor Total</TableHead>
                    <TableHead>Valor Vendedor</TableHead>
                    <TableHead>Taxa Marketplace</TableHead>
                    <TableHead>Data de Criação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {splitPayments?.filter(p => p.status === 'pending').map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell className="font-mono text-sm">
                        {payment.payment_id}
                      </TableCell>
                      <TableCell>{formatCurrency(payment.total_amount)}</TableCell>
                      <TableCell>{formatCurrency(payment.seller_amount)}</TableCell>
                      <TableCell>{formatCurrency(payment.marketplace_fee)}</TableCell>
                      <TableCell>
                        {format(new Date(payment.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Função utilitária para formatação de moeda - adicionar ao utils se não existir
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
}