import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type OrderStatus = "pending" | "approved" | "in_route" | "delivered" | "cancelled";

interface OrderItemRow {
  product_id: string;
  quantity: number;
  price: number;
  orders?: {
    created_at: string;
    status: OrderStatus;
  };
  products?: {
    name: string;
    image_url: string | null;
  };
}

interface AggRow {
  product_id: string;
  name: string;
  image_url: string | null;
  total_qty: number;
  total_revenue: number;
  item_count: number;
}

const AdminBestSellers = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<AggRow[]>([]);
  const [sortKey, setSortKey] = useState<'qty' | 'revenue'>('qty');
  const [startDate, setStartDate] = useState<string>(() => {
    const now = new Date();
    const d = new Date(now.getFullYear(), now.getMonth(), 1);
    return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState<string>(() => {
    const now = new Date();
    const d = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return d.toISOString().slice(0, 10);
  });

  useEffect(() => {
    checkAdmin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkAdmin = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error('Faça login para acessar Finanças');
      navigate('/auth');
      return;
    }

    const { data: role } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (!role) {
      toast.error('Acesso negado');
      navigate('/');
      return;
    }

    loadData();
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const startIso = new Date(startDate + 'T00:00:00').toISOString();
      const endIso = new Date(endDate + 'T23:59:59').toISOString();

      // Carrega itens de pedido com join em orders e products
      const { data, error } = await supabase
        .from('order_items')
        .select(`
          product_id,
          quantity,
          price,
          orders!inner(created_at,status),
          products!inner(name,image_url)
        `)
        .gte('orders.created_at', startIso)
        .lte('orders.created_at', endIso)
        .in('orders.status', ['approved', 'in_route', 'delivered']);

      if (error) throw error;

      const aggMap: Record<string, AggRow> = {};
      (data || []).forEach((row: OrderItemRow) => {
        const pid = row.product_id;
        const name = row.products?.name || 'Produto';
        const image_url = row.products?.image_url ?? null;
        const qty = Number(row.quantity || 0);
        const price = Number(row.price || 0);
        const revenue = qty * price;

        if (!aggMap[pid]) {
          aggMap[pid] = {
            product_id: pid,
            name,
            image_url,
            total_qty: 0,
            total_revenue: 0,
            item_count: 0,
          };
        }
        aggMap[pid].total_qty += qty;
        aggMap[pid].total_revenue += revenue;
        aggMap[pid].item_count += 1;
      });

      setRows(Object.values(aggMap));
    } catch (err: any) {
      toast.error('Erro ao carregar itens mais vendidos');
    } finally {
      setLoading(false);
    }
  };

  const sortedRows = useMemo(() => {
    const list = [...rows];
    if (sortKey === 'qty') {
      list.sort((a, b) => b.total_qty - a.total_qty);
    } else {
      list.sort((a, b) => b.total_revenue - a.total_revenue);
    }
    return list;
  }, [rows, sortKey]);

  const maxQty = useMemo(() => Math.max(1, ...rows.map(r => r.total_qty)), [rows]);
  const maxRevenue = useMemo(() => Math.max(1, ...rows.map(r => r.total_revenue)), [rows]);

  const setQuickRange = (type: '7d' | 'month' | 'year') => {
    const now = new Date();
    if (type === '7d') {
      const end = new Date();
      const start = new Date();
      start.setDate(end.getDate() - 6);
      setStartDate(start.toISOString().slice(0, 10));
      setEndDate(end.toISOString().slice(0, 10));
    } else if (type === 'month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      setStartDate(start.toISOString().slice(0, 10));
      setEndDate(end.toISOString().slice(0, 10));
    } else {
      const start = new Date(now.getFullYear(), 0, 1);
      const end = new Date(now.getFullYear(), 11, 31);
      setStartDate(start.toISOString().slice(0, 10));
      setEndDate(end.toISOString().slice(0, 10));
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Itens mais vendidos</h1>
            <p className="text-muted-foreground">Ranking por quantidade e faturamento</p>
          </div>
          <Button variant="outline" onClick={() => navigate('/admin/financas')}>Voltar às Finanças</Button>
        </div>

        <Card className="p-6 mb-6">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Período</Label>
              <div className="flex items-center gap-2">
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                <span className="text-sm text-muted-foreground">até</span>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                <Button variant="secondary" onClick={loadData}>Aplicar</Button>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => { setQuickRange('7d'); }}>Últimos 7 dias</Button>
                <Button variant="outline" onClick={() => { setQuickRange('month'); }}>Este mês</Button>
                <Button variant="outline" onClick={() => { setQuickRange('year'); }}>Este ano</Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Ordenação</Label>
              <div className="flex gap-2">
                <Button variant={sortKey === 'qty' ? 'gold' : 'outline'} onClick={() => setSortKey('qty')}>Por quantidade</Button>
                <Button variant={sortKey === 'revenue' ? 'gold' : 'outline'} onClick={() => setSortKey('revenue')}>Por faturamento</Button>
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          {loading ? (
            <p>Carregando...</p>
          ) : rows.length === 0 ? (
            <p>Nenhum dado para o período selecionado.</p>
          ) : (
            <div className="space-y-6">
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left">
                      <th className="py-2 pr-4">Produto</th>
                      <th className="py-2 pr-4">Quantidade</th>
                      <th className="py-2 pr-4">Faturamento</th>
                      <th className="py-2 pr-4">Pedidos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedRows.map((r) => (
                      <tr key={r.product_id} className="border-t">
                        <td className="py-2 pr-4 flex items-center gap-3">
                          {r.image_url && (
                            <img src={r.image_url} alt={r.name} className="h-10 w-10 object-cover rounded" />
                          )}
                          <span className="font-medium">{r.name}</span>
                        </td>
                        <td className="py-2 pr-4">{r.total_qty}</td>
                        <td className="py-2 pr-4">{r.total_revenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                        <td className="py-2 pr-4">{r.item_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Gráficos simples (barras) */}
              <div className="grid md:grid-cols-2 gap-6">
                <Card className="p-4">
                  <h3 className="font-semibold mb-2">Top por Quantidade</h3>
                  <div className="space-y-2">
                    {sortedRows.slice(0, 10).map((r) => (
                      <div key={`qty-${r.product_id}`} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium">{r.name}</span>
                          <span>{r.total_qty}</span>
                        </div>
                        <div className="h-3 bg-muted rounded">
                          <div
                            className="h-3 bg-gradient-gold rounded"
                            style={{ width: `${Math.max(5, Math.round((r.total_qty / maxQty) * 100))}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
                <Card className="p-4">
                  <h3 className="font-semibold mb-2">Top por Faturamento</h3>
                  <div className="space-y-2">
                    {sortedRows
                      .slice()
                      .sort((a, b) => b.total_revenue - a.total_revenue)
                      .slice(0, 10)
                      .map((r) => (
                        <div key={`rev-${r.product_id}`} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-medium">{r.name}</span>
                            <span>{r.total_revenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                          </div>
                          <div className="h-3 bg-muted rounded">
                            <div
                              className="h-3 bg-gradient-gold rounded"
                              style={{ width: `${Math.max(5, Math.round((r.total_revenue / maxRevenue) * 100))}%` }}
                            />
                          </div>
                        </div>
                      ))}
                  </div>
                </Card>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default AdminBestSellers;