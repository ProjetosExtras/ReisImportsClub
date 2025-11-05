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
import jsPDF from "jspdf";

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
  cpf?: string | null;
  profiles: {
    full_name: string;
    phone: string;
  };
}

interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
  is_active: boolean;
  image_url: string | null;
  created_at: string;
  updated_at: string;
}

const Admin = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [stats, setStats] = useState({
    pending: 0,
    approved: 0,
    in_route: 0,
    delivered: 0,
  });

  useEffect(() => {
    checkAdmin();
    loadOrders();
    loadProducts();
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

  const loadProducts = async () => {
    try {
      setProductsLoading(true);
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;

      setProducts((data || []) as Product[]);
    } catch (error: any) {
      toast.error('Erro ao carregar produtos');
    } finally {
      setProductsLoading(false);
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

  const deleteProduct = async (productId: string) => {
    try {
      const confirm = window.confirm('Tem certeza que deseja excluir este produto? Esta ação não pode ser desfeita.');
      if (!confirm) return;

      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', productId);

      if (error) throw error;
      toast.success('Produto excluído com sucesso');
      loadProducts();
    } catch (err: any) {
      toast.error('Erro ao excluir produto');
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

  const STORE_CNPJ = "39433448000134";
  const STORE_RAZAO = "reisimports";

  const generateDeclarationPdf = async (order: Order) => {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 48;
    const contentWidth = pageWidth - margin * 2;
    let y = 0;

    // Cabeçalho estilizado
    doc.setFillColor(255, 215, 0);
    doc.rect(0, 0, pageWidth, 70, 'F');
    doc.setTextColor(20);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('Declaração de Conteúdo', margin, 42);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`${STORE_RAZAO} • CNPJ ${STORE_CNPJ}`, margin, 62);

    // Área principal
    y = 90;
    doc.setDrawColor(235);
    doc.setLineWidth(0.6);

    const sectionTitle = (title: string) => {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(40);
      doc.setFontSize(12);
      doc.text(title, margin, y);
      y += 10;
      doc.setDrawColor(235);
      doc.line(margin, y, margin + contentWidth, y);
      y += 14;
    };

    const labelValue = (label: string, value: string) => {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(60);
      doc.setFontSize(11);
      doc.text(label, margin, y);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(50);
      doc.text(value, margin + 140, y);
      y += 18;
    };

    // Emitente / Data
    sectionTitle('Emitente');
    labelValue('Razão Social', STORE_RAZAO);
    labelValue('CNPJ', STORE_CNPJ);
    labelValue('Data', `${new Date(order.created_at).toLocaleDateString('pt-BR')} ${new Date(order.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`);

    // Destinatário
    const nomeCliente = order.profiles?.full_name || 'Cliente';
    const cpfCliente = order.cpf ? order.cpf : '—';
    sectionTitle('Destinatário');
    labelValue('Nome', nomeCliente);
    labelValue('CPF', cpfCliente);
    labelValue('Telefone', order.profiles?.phone || order.phone || '—');
    labelValue('Endereço', order.delivery_address);

    // Pedido
    sectionTitle('Pedido');
    labelValue('Número', order.id);
    labelValue('Pagamento', `${getPaymentMethodText(order.payment_method)} na entrega`);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(40);
    doc.setFontSize(12);
    doc.text('Total', margin, y);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(20);
    doc.setFontSize(14);
    doc.text(`R$ ${Number(order.total).toFixed(2)}`, margin + 140, y);
    y += 24;

    // Itens do Pedido
    sectionTitle('Itens do Pedido');
    const { data: items, error: itemsError } = await supabase
      .from('order_items')
      .select('quantity, price, product:products(name)')
      .eq('order_id', order.id);

    if (itemsError) {
      toast.error('Erro ao carregar itens do pedido');
    }

    const tableCols = [
      { label: 'Item', x: margin },
      { label: 'Qtd', x: margin + contentWidth - 220 },
      { label: 'Unitário', x: margin + contentWidth - 140 },
      { label: 'Subtotal', x: margin + contentWidth - 60 },
    ];

    doc.setFillColor(245);
    doc.rect(margin, y - 10, contentWidth, 24, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(40);
    doc.setFontSize(11);
    tableCols.forEach(col => doc.text(col.label, col.x, y));
    y += 16;

    const formatBRL = (n: number) => `R$ ${n.toFixed(2)}`;

    (items || []).forEach((it) => {
      if (y > pageHeight - 80) {
        doc.addPage();
        y = 90;
      }
      const name = (it as any).product?.name || 'Produto';
      const quantity = Number((it as any).quantity || 0);
      const unitPrice = Number((it as any).price || 0);
      const subtotal = unitPrice * quantity;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(50);
      doc.text(name, tableCols[0].x, y);
      doc.text(String(quantity), tableCols[1].x, y);
      doc.text(formatBRL(unitPrice), tableCols[2].x, y);
      doc.text(formatBRL(subtotal), tableCols[3].x, y);
      y += 16;
    });

    // Declaração
    sectionTitle('Declaração');
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(50);
    doc.setFontSize(11);
    const texto = 'Declaro, para os devidos fins, que o conteúdo desta remessa corresponde aos itens comercializados pela empresa acima identificada, destinados ao destinatário informado, sem fins de contrabando ou mercadoria proibida.';
    const lines = doc.splitTextToSize(texto, contentWidth);
    doc.text(lines, margin, y);
    y += lines.length * 14 + 26;

    // Assinatura
    doc.setTextColor(60);
    doc.setDrawColor(200);
    doc.line(margin, y, margin + 240, y);
    y += 14;
    doc.text(`${STORE_RAZAO} - CNPJ ${STORE_CNPJ}`, margin, y);

    doc.setTextColor(150);
    doc.setFontSize(9);
    doc.text('Documento gerado automaticamente. Válido como declaração de conteúdo.', margin, pageHeight - 30);

    const fileName = `Declaracao_Conteudo_${order.id.slice(0,8)}.pdf`;
    doc.save(fileName);
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

        {/* Produtos */}
        <div className="mb-8">
          <Card className="p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold">Produtos</h2>
                <p className="text-muted-foreground">Gerencie o catálogo da loja.</p>
              </div>
              <Button
                variant="gold"
                onClick={() => navigate('/admin/produtos/novo')}
              >
                Cadastrar Produto
              </Button>
            </div>
            <div className="mt-6">
              {productsLoading ? (
                <p>Carregando produtos...</p>
              ) : products.length === 0 ? (
                <p>Nenhum produto cadastrado.</p>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="text-left">
                          <th className="py-2 pr-4">Nome</th>
                          <th className="py-2 pr-4">Preço</th>
                          <th className="py-2 pr-4">Estoque</th>
                          <th className="py-2 pr-4">Ativo</th>
                          <th className="py-2 pr-4">Atualizado</th>
                          <th className="py-2 pr-4">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {products.slice(0, 5).map((p) => (
                          <tr key={p.id} className="border-t">
                            <td className="py-2 pr-4 font-medium">{p.name}</td>
                            <td className="py-2 pr-4">{(Number(p.price) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                            <td className="py-2 pr-4">{p.stock}</td>
                            <td className="py-2 pr-4">
                              <Badge variant={p.is_active ? 'default' : 'secondary'}>
                                {p.is_active ? 'Ativo' : 'Inativo'}
                              </Badge>
                            </td>
                            <td className="py-2 pr-4">{new Date(p.updated_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</td>
                            <td className="py-2 pr-4">
                              <Button variant="outline" onClick={() => navigate(`/admin/produtos/${p.id}/editar`)}>
                                Editar
                              </Button>
                              <Button variant="destructive" className="ml-2" onClick={() => deleteProduct(p.id)}>
                                Excluir
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {products.length > 5 && (
                    <div className="mt-4 flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">
                        Mostrando 5 de {products.length} produtos
                      </p>
                      <Button variant="outline" onClick={() => navigate('/admin/produtos')}>
                        Ver todos os produtos
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          </Card>
        </div>

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

                  <Button
                    variant="gold"
                    className="w-full"
                    onClick={() => generateDeclarationPdf(order)}
                  >
                    Gerar Declaração (PDF)
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
