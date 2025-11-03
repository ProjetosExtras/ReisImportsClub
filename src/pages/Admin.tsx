import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Package, Clock, Truck, CheckCircle, XCircle, MessageCircle } from "lucide-react";

interface Order {
  id: string;
  user_id: string;
  total: number;
  payment_method: string;
  status: string;
  delivery_address: string;
  phone: string;
  notes: string;
  created_at: string;
  profiles: {
    full_name: string;
    phone: string;
  };
}

const Admin = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    pending: 0,
    approved: 0,
    in_route: 0,
    delivered: 0,
  });

  useEffect(() => {
    checkAdmin();
    loadOrders();
  }, []);

  const checkAdmin = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error('Faça login para acessar o painel');
      navigate('/auth');
      return;
    }

    const { data } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (!data) {
      toast.error('Acesso negado');
      navigate('/');
    }
  };

  const loadOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          profiles (
            full_name,
            phone
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setOrders(data || []);

      // Calculate stats
      const newStats = {
        pending: data?.filter(o => o.status === 'pending').length || 0,
        approved: data?.filter(o => o.status === 'approved').length || 0,
        in_route: data?.filter(o => o.status === 'in_route').length || 0,
        delivered: data?.filter(o => o.status === 'delivered').length || 0,
      };
      setStats(newStats);
    } catch (error: any) {
      toast.error('Erro ao carregar pedidos');
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: 'pending' | 'approved' | 'in_route' | 'delivered' | 'cancelled') => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', orderId);

      if (error) throw error;

      toast.success('Status atualizado!');
      loadOrders();
    } catch (error: any) {
      toast.error('Erro ao atualizar status');
    }
  };

  const openWhatsApp = (phone: string, customerName: string, orderId: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    const message = `Olá ${customerName}! Sobre seu pedido #${orderId.slice(0, 8)} na ReisImportsClub...`;
    window.open(`https://wa.me/55${cleanPhone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-5 w-5" />;
      case 'approved':
        return <Package className="h-5 w-5" />;
      case 'in_route':
        return <Truck className="h-5 w-5" />;
      case 'delivered':
        return <CheckCircle className="h-5 w-5" />;
      case 'cancelled':
        return <XCircle className="h-5 w-5" />;
      default:
        return <Clock className="h-5 w-5" />;
    }
  };

  const getPaymentMethodText = (method: string) => {
    switch (method) {
      case 'cash':
        return 'Dinheiro';
      case 'pix':
        return 'PIX';
      case 'card':
        return 'Cartão';
      default:
        return method;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-8">
          <p className="text-center">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold mb-8">Painel Administrativo</h1>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Clock className="h-5 w-5" />
              <span className="text-sm">Pendentes</span>
            </div>
            <p className="text-3xl font-bold">{stats.pending}</p>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Package className="h-5 w-5" />
              <span className="text-sm">Aprovados</span>
            </div>
            <p className="text-3xl font-bold">{stats.approved}</p>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Truck className="h-5 w-5" />
              <span className="text-sm">Em Rota</span>
            </div>
            <p className="text-3xl font-bold">{stats.in_route}</p>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <CheckCircle className="h-5 w-5" />
              <span className="text-sm">Entregues</span>
            </div>
            <p className="text-3xl font-bold">{stats.delivered}</p>
          </Card>
        </div>

        {/* Orders */}
        <h2 className="text-2xl font-bold mb-4">Pedidos</h2>
        <div className="space-y-4">
          {orders.map((order) => (
            <Card key={order.id} className="p-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    {getStatusIcon(order.status)}
                    <h3 className="font-semibold">Pedido #{order.id.slice(0, 8)}</h3>
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <p><strong>Cliente:</strong> {order.profiles?.full_name}</p>
                    <p><strong>Telefone:</strong> {order.profiles?.phone || order.phone}</p>
                    <p><strong>Endereço:</strong> {order.delivery_address}</p>
                    <p><strong>Pagamento:</strong> {getPaymentMethodText(order.payment_method)} na entrega</p>
                    <p><strong>Total:</strong> <span className="bg-gradient-gold bg-clip-text text-transparent font-bold">R$ {Number(order.total).toFixed(2)}</span></p>
                    <p><strong>Data:</strong> {new Date(order.created_at).toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}</p>
                    {order.notes && (
                      <p><strong>Observações:</strong> {order.notes}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Status do Pedido</label>
                    <Select
                      value={order.status}
                      onValueChange={(value: 'pending' | 'approved' | 'in_route' | 'delivered' | 'cancelled') => updateOrderStatus(order.id, value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pendente</SelectItem>
                        <SelectItem value="approved">Aprovado</SelectItem>
                        <SelectItem value="in_route">Em Rota</SelectItem>
                        <SelectItem value="delivered">Entregue</SelectItem>
                        <SelectItem value="cancelled">Cancelado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Button
                    variant="gold"
                    className="w-full"
                    onClick={() => openWhatsApp(
                      order.profiles?.phone || order.phone,
                      order.profiles?.full_name,
                      order.id
                    )}
                  >
                    <MessageCircle className="h-5 w-5 mr-2" />
                    Contatar via WhatsApp
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Admin;
