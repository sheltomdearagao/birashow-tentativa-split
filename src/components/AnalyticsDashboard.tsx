import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, Users, DollarSign, Calendar } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface DashboardStats {
  today: number;
  thisWeek: number;
  thisMonth: number;
  thisYear: number;
}

export function AnalyticsDashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const thisWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const thisMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
      const thisYear = new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];

      // Buscar estatísticas de agendamentos
      const { data: todayData } = await supabase
        .from('appointments')
        .select('id, booking_type')
        .gte('scheduled_time', today)
        .eq('status', 'completed');

      const { data: weekData } = await supabase
        .from('appointments')
        .select('id, booking_type')
        .gte('scheduled_time', thisWeek)
        .eq('status', 'completed');

      const { data: monthData } = await supabase
        .from('appointments')
        .select('id, booking_type')
        .gte('scheduled_time', thisMonth)
        .eq('status', 'completed');

      const { data: yearData } = await supabase
        .from('appointments')
        .select('id, booking_type')
        .gte('scheduled_time', thisYear)
        .eq('status', 'completed');

      return {
        today: {
          total: todayData?.length || 0,
          app: todayData?.filter(a => a.booking_type === 'app').length || 0,
          manual: todayData?.filter(a => a.booking_type === 'manual').length || 0
        },
        thisWeek: {
          total: weekData?.length || 0,
          app: weekData?.filter(a => a.booking_type === 'app').length || 0,
          manual: weekData?.filter(a => a.booking_type === 'manual').length || 0
        },
        thisMonth: {
          total: monthData?.length || 0,
          app: monthData?.filter(a => a.booking_type === 'app').length || 0,
          manual: monthData?.filter(a => a.booking_type === 'manual').length || 0
        },
        thisYear: {
          total: yearData?.length || 0,
          app: yearData?.filter(a => a.booking_type === 'app').length || 0,
          manual: yearData?.filter(a => a.booking_type === 'manual').length || 0
        }
      };
    }
  });

  const StatCard = ({ title, value, subtitle, icon: Icon }: {
    title: string;
    value: string | number;
    subtitle: string;
    icon: any;
  }) => (
    <Card className="bg-gradient-card border-border shadow-card">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
          </div>
          <Icon className="w-8 h-8 text-primary" />
        </div>
      </CardContent>
    </Card>
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="bg-gradient-card border-border">
              <CardContent className="p-6">
                <div className="animate-pulse">
                  <div className="h-8 bg-muted rounded mb-2"></div>
                  <div className="h-4 bg-muted rounded w-2/3"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-6">
        <TrendingUp className="w-6 h-6 text-primary" />
        <h2 className="text-2xl font-bold">Painel Analítico</h2>
      </div>

      <Tabs defaultValue="semana" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="semana">Semana</TabsTrigger>
          <TabsTrigger value="mes">Mês</TabsTrigger>
          <TabsTrigger value="ano">Ano</TabsTrigger>
        </TabsList>
        
        <TabsContent value="semana" className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <StatCard
              title="Hoje"
              value={stats?.today.total || 0}
              subtitle={`${stats?.today.app || 0} App • ${stats?.today.manual || 0} Manual`}
              icon={Calendar}
            />
            <StatCard
              title="Esta Semana"
              value={stats?.thisWeek.total || 0}
              subtitle={`${stats?.thisWeek.app || 0} App • ${stats?.thisWeek.manual || 0} Manual`}
              icon={Users}
            />
          </div>
        </TabsContent>
        
        <TabsContent value="mes" className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            <StatCard
              title="Este Mês"
              value={stats?.thisMonth.total || 0}
              subtitle={`${stats?.thisMonth.app || 0} App • ${stats?.thisMonth.manual || 0} Manual`}
              icon={DollarSign}
            />
          </div>
        </TabsContent>
        
        <TabsContent value="ano" className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            <StatCard
              title="Este Ano"
              value={stats?.thisYear.total || 0}
              subtitle={`${stats?.thisYear.app || 0} App • ${stats?.thisYear.manual || 0} Manual`}
              icon={TrendingUp}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}