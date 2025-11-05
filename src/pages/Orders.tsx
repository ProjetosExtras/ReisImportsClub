import { useEffect, useState } from "react";
import jsPDF from "jspdf";
import { useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Package, Clock, Truck, CheckCircle, XCircle } from "lucide-react";

interface Order {
  id: string;
  total: number;
  payment_method: string;
  status: string;
  delivery_address: string;
  phone: string;
  notes: string;
  created_at: string;
  cpf?: string | null;
}

const Orders = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    checkAuth();
    loadOrders();
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error('Faça login para ver seus pedidos');
      navigate('/auth');
    }
    if (user) {
      const { data: p } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      setProfile(p);
    }
  };

  const loadOrders = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setOrders(data || []);
    } catch (error: any) {
      toast.error('Erro ao carregar pedidos');
    } finally {
      setLoading(false);
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
    doc.setFillColor(255, 215, 0); // barra dourada
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
    const nomeCliente = profile?.full_name || 'Cliente';
    const cpfCliente = order.cpf ? order.cpf : '—';
    sectionTitle('Destinatário');
    labelValue('Nome', nomeCliente);
    labelValue('CPF', cpfCliente);
    labelValue('Telefone', order.phone || '—');
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

    // Buscar itens do pedido (join com products para nome)
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

    // Cabeçalho da tabela
    doc.setFillColor(245);
    doc.rect(margin, y - 10, contentWidth, 24, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(40);
    doc.setFontSize(11);
    tableCols.forEach(col => doc.text(col.label, col.x, y));
    y += 16;

    const formatBRL = (n: number) => `R$ ${n.toFixed(2)}`;

    (items || []).forEach((it) => {
      // Quebra de página se necessário
      if (y > pageHeight - 80) {
        doc.addPage();
        y = 90; // início da área principal na nova página
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

    // Rodapé discreto
    doc.setTextColor(150);
    doc.setFontSize(9);
    doc.text('Documento gerado automaticamente. Válido como declaração de conteúdo.', margin, pageHeight - 30);

    const fileName = `Declaracao_Conteudo_${order.id.slice(0,8)}.pdf`;
    doc.save(fileName);
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

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending':
        return 'Pendente';
      case 'approved':
        return 'Aprovado';
      case 'in_route':
        return 'Em Rota';
      case 'delivered':
        return 'Entregue';
      case 'cancelled':
        return 'Cancelado';
      default:
        return status;
    }
  };

  const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case 'pending':
        return 'secondary';
      case 'approved':
        return 'default';
      case 'in_route':
        return 'default';
      case 'delivered':
        return 'outline';
      case 'cancelled':
        return 'destructive';
      default:
        return 'secondary';
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
        <h1 className="text-4xl font-bold mb-8">Meus Pedidos</h1>

        {orders.length === 0 ? (
          <Card className="p-12 text-center">
            <p className="text-muted-foreground mb-4">Você ainda não tem pedidos</p>
          </Card>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <Card key={order.id} className="p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {getStatusIcon(order.status)}
                      <Badge variant={getStatusVariant(order.status)}>
                        {getStatusText(order.status)}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-1">
                      Pedido #{order.id.slice(0, 8)}
                    </p>
                    <p className="text-sm text-muted-foreground mb-1">
                      {new Date(order.created_at).toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: 'long',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                    <p className="text-sm text-muted-foreground mb-1">
                      Pagamento: {getPaymentMethodText(order.payment_method)} na entrega
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Endereço: {order.delivery_address}
                    </p>
                    {order.notes && (
                      <p className="text-sm text-muted-foreground mt-2">
                        Obs: {order.notes}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold bg-gradient-gold bg-clip-text text-transparent">
                      R$ {Number(order.total).toFixed(2)}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Orders;
