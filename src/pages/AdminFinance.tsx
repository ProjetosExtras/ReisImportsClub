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

interface OrderRow {
  total: number;
  created_at: string;
  status: OrderStatus;
}

interface GoalRow {
  goal_date: string; // YYYY-MM-DD
  target_amount: number;
}

const AdminFinance = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [ordersMonth, setOrdersMonth] = useState<OrderRow[]>([]);
  const [ordersYear, setOrdersYear] = useState<OrderRow[]>([]);
  const [goals, setGoals] = useState<Record<string, number>>({}); // key: YYYY-MM-DD

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const yearEnd = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);

  const fmtDate = (d: Date) => d.toISOString().slice(0, 10);

  useEffect(() => {
    checkAdmin();
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

    loadFinance();
  };

  const loadFinance = async () => {
    try {
      setLoading(true);
      const monthStartIso = monthStart.toISOString();
      const monthEndIso = monthEnd.toISOString();
      const yearStartIso = yearStart.toISOString();
      const yearEndIso = yearEnd.toISOString();

      const [monthRes, yearRes, goalsRes] = await Promise.all([
        supabase
          .from('orders')
          .select('total, created_at, status')
          .gte('created_at', monthStartIso)
          .lte('created_at', monthEndIso)
          .in('status', ['approved', 'in_route', 'delivered']),
        supabase
          .from('orders')
          .select('total, created_at, status')
          .gte('created_at', yearStartIso)
          .lte('created_at', yearEndIso)
          .in('status', ['approved', 'in_route', 'delivered']),
        supabase
          .from('sales_goals')
          .select('goal_date, target_amount')
          .gte('goal_date', fmtDate(monthStart))
          .lte('goal_date', fmtDate(monthEnd)),
      ]);

      if (monthRes.error) throw monthRes.error;
      if (yearRes.error) throw yearRes.error;
      if (goalsRes.error) throw goalsRes.error;

      setOrdersMonth((monthRes.data || []) as OrderRow[]);
      setOrdersYear((yearRes.data || []) as OrderRow[]);

      const goalsMap: Record<string, number> = {};
      (goalsRes.data || []).forEach((g: GoalRow) => {
        goalsMap[g.goal_date] = Number(g.target_amount) || 0;
      });
      setGoals(goalsMap);
    } catch (err: any) {
      toast.error('Erro ao carregar finanças');
    } finally {
      setLoading(false);
    }
  };

  const daysInMonth = useMemo(() => {
    const days: string[] = [];
    const d = new Date(monthStart);
    while (d <= monthEnd) {
      days.push(fmtDate(d));
      d.setDate(d.getDate() + 1);
    }
    return days;
  }, [monthStart, monthEnd]);

  const dailySales = useMemo(() => {
    const map: Record<string, number> = {};
    ordersMonth.forEach((o) => {
      const key = o.created_at.slice(0, 10);
      map[key] = (map[key] || 0) + Number(o.total || 0);
    });
    return map;
  }, [ordersMonth]);

  const monthTotal = useMemo(() => ordersMonth.reduce((sum, o) => sum + Number(o.total || 0), 0), [ordersMonth]);
  const yearTotal = useMemo(() => ordersYear.reduce((sum, o) => sum + Number(o.total || 0), 0), [ordersYear]);

  const handleGoalChange = (date: string, value: string) => {
    const num = Number(value);
    setGoals((prev) => ({ ...prev, [date]: isNaN(num) ? 0 : num }));
  };

  const saveGoals = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const rows = daysInMonth
        .filter((d) => goals[d] && goals[d] > 0)
        .map((d) => ({ goal_date: d, target_amount: goals[d], created_by: user.id }));

      if (rows.length === 0) {
        toast.info('Nada para salvar');
        return;
      }

      const { error } = await supabase
        .from('sales_goals')
        .upsert(rows, { onConflict: 'goal_date' });

      if (error) throw error;
      toast.success('Metas salvas com sucesso');
      loadFinance();
    } catch (err: any) {
      toast.error('Erro ao salvar metas');
    }
  };

  return (
    <div>
      <Navbar />
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-4">Finanças - {now.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h1>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card className="p-4">
            <h2 className="text-lg font-semibold mb-2">Total do mês</h2>
            <p className="text-2xl font-bold">R$ {monthTotal.toFixed(2)}</p>
          </Card>
          <Card className="p-4">
            <h2 className="text-lg font-semibold mb-2">Total do ano</h2>
            <p className="text-2xl font-bold">R$ {yearTotal.toFixed(2)}</p>
          </Card>
          <Card className="p-4">
            <h2 className="text-lg font-semibold mb-2">Meta do mês</h2>
            <p className="text-2xl font-bold">R$ {daysInMonth.reduce((s, d) => s + (goals[d] || 0), 0).toFixed(2)}</p>
          </Card>
        </div>

        <Card className="p-4">
          <h2 className="text-lg font-semibold mb-4">Metas e Realizado por dia</h2>
          {loading ? (
            <p>Carregando...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left">
                    <th className="py-2 pr-4">Data</th>
                    <th className="py-2 pr-4">Meta (R$)</th>
                    <th className="py-2 pr-4">Realizado (R$)</th>
                    <th className="py-2 pr-4">Progresso</th>
                  </tr>
                </thead>
                <tbody>
                  {daysInMonth.map((d) => {
                    const realized = dailySales[d] || 0;
                    const target = goals[d] || 0;
                    const progress = target > 0 ? Math.min(100, Math.round((realized / target) * 100)) : 0;
                    return (
                      <tr key={d} className="border-t">
                        <td className="py-2 pr-4">{new Date(d).toLocaleDateString()}</td>
                        <td className="py-2 pr-4">
                          <Label htmlFor={`goal-${d}`} className="sr-only">Meta</Label>
                          <Input id={`goal-${d}`} type="number" step="0.01" value={target || ''} onChange={(e) => handleGoalChange(d, e.target.value)} className="w-32" />
                        </td>
                        <td className="py-2 pr-4">R$ {realized.toFixed(2)}</td>
                        <td className="py-2 pr-4">{progress}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-4 flex gap-2">
            <Button onClick={saveGoals}>Salvar metas</Button>
            <Button variant="secondary" onClick={loadFinance}>Atualizar</Button>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default AdminFinance;