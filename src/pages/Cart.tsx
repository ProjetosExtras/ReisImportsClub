import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Trash2, Minus, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  image_url: string;
  stock: number;
  cpf_limit_per_cpf?: number;
}

interface CartItem {
  product: Product;
  quantity: number;
}

const Cart = () => {
  const navigate = useNavigate();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'pix' | 'card'>('cash');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [cpf, setCpf] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [minOrderOpen, setMinOrderOpen] = useState(false);

  useEffect(() => {
    loadCart();
    loadUserData();
  }, []);

  const loadCart = () => {
    const savedCart = localStorage.getItem('cart');
    if (savedCart) {
      setCart(JSON.parse(savedCart));
    }
  };

  const loadUserData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);

    if (user) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileData) {
        setProfile(profileData);
        setDeliveryAddress(profileData.address || '');
        setPhone(profileData.phone || '');
      }
    }
  };

  const updateQuantity = (productId: string, change: number) => {
    const newCart = cart.map(item => {
      if (item.product.id === productId) {
        const newQuantity = Math.max(1, item.quantity + change);
        return { ...item, quantity: newQuantity };
      }
      return item;
    });
    setCart(newCart);
    localStorage.setItem('cart', JSON.stringify(newCart));
  };

  const removeItem = (productId: string) => {
    const newCart = cart.filter(item => item.product.id !== productId);
    setCart(newCart);
    localStorage.setItem('cart', JSON.stringify(newCart));
    toast.success('Item removido do carrinho');
  };

  const total = cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const handleCheckout = async () => {
    if (!user) {
      toast.error('Faça login para finalizar o pedido');
      navigate('/auth');
      return;
    }

    if (!deliveryAddress || !phone) {
      toast.error('Preencha endereço e telefone');
      return;
    }

    // Require CPF for per-CPF daily limit enforcement
    const normalizedCpf = (cpf || '').replace(/\D/g, '');
    if (!normalizedCpf || normalizedCpf.length !== 11) {
      toast.error('Informe um CPF válido (11 dígitos)');
      return;
    }

    if (cart.length === 0) {
      toast.error('Carrinho vazio');
      return;
    }

    setLoading(true);

    try {
      // Enforce per-CPF daily limit before creating the order
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);

      // Load product limits fresh from DB to ensure accuracy
      const productIds = cart.map((item) => item.product.id);
      const limitsMap = new Map<string, number | null>();

      // Try selecting cpf_limit_per_cpf; if column doesn't exist, fallback to no limits
      const prodSelect = await supabase
        .from('products')
        .select('id, cpf_limit_per_cpf')
        .in('id', productIds);

      if (prodSelect.error) {
        const msg = String(prodSelect.error.message || '').toLowerCase();
        if (msg.includes('cpf_limit_per_cpf') || msg.includes('does not exist')) {
          // Column not present yet -> treat as no limit
          productIds.forEach((id) => limitsMap.set(id, null));
        } else {
          throw prodSelect.error;
        }
      } else {
        prodSelect.data?.forEach((p: any) => {
          limitsMap.set(p.id, p.cpf_limit_per_cpf ?? null);
        });
      }

      // Fetch today's orders for this CPF
      const { data: ordersToday, error: ordersError } = await supabase
        .from('orders')
        .select('id')
        .eq('cpf', normalizedCpf)
        .gte('created_at', startOfToday.toISOString())
        .in('status', ['pending', 'approved', 'in_route', 'delivered']);
      if (ordersError) throw ordersError;

      const orderIdsToday = (ordersToday || []).map((o: any) => o.id);

      // For each cart item, compute already purchased today and compare with limit
      for (const item of cart) {
        const limit = limitsMap.get(item.product.id) ?? null;
        if (limit === null) continue; // no limit
        if (limit === 0) {
          throw new Error(`Este item está bloqueado para compra por CPF hoje.`);
        }

        let alreadyQty = 0;
        if (orderIdsToday.length > 0) {
          const { data: itemsToday, error: itemsError } = await supabase
            .from('order_items')
            .select('quantity')
            .in('order_id', orderIdsToday)
            .eq('product_id', item.product.id);
          if (itemsError) throw itemsError;
          alreadyQty = (itemsToday || []).reduce((sum: number, it: any) => sum + (Number(it.quantity) || 0), 0);
        }

        const remaining = Number(limit) - alreadyQty;
        if (remaining <= 0) {
          throw new Error(`Limite diário atingido para este produto (CPF). Tente amanhã.`);
        }
        if (item.quantity > remaining) {
          throw new Error(`Quantidade acima do permitido hoje para este produto. Máximo disponível: ${remaining}.`);
        }
      }

      // Create order
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          user_id: user.id,
          total,
          payment_method: paymentMethod,
          delivery_address: deliveryAddress,
          phone,
          cpf: normalizedCpf,
          notes,
          status: 'pending',
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create order items
      const orderItems = cart.map(item => ({
        order_id: order.id,
        product_id: item.product.id,
        quantity: item.quantity,
        price: item.product.price,
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) throw itemsError;

      // Clear cart
      localStorage.removeItem('cart');
      setCart([]);

      toast.success('Pedido realizado com sucesso!');
      navigate('/orders');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao finalizar pedido');
    } finally {
      setLoading(false);
    }
  };

  const cartItemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="min-h-screen bg-background">
      <Navbar cartItemsCount={cartItemsCount} />

      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold mb-8">Carrinho</h1>

        {cart.length === 0 ? (
          <Card className="p-12 text-center">
            <p className="text-muted-foreground mb-4">Seu carrinho está vazio</p>
            <Button variant="gold" onClick={() => navigate('/')}>
              Ver Produtos
            </Button>
          </Card>
        ) : (
          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-4">
              {cart.map((item) => (
                <Card key={item.product.id} className="p-4">
                  <div className="flex flex-wrap gap-4">
                    <img
                      src={item.product.image_url}
                      alt={item.product.name}
                      className="w-24 h-24 object-cover rounded"
                    />
                    <div className="flex-1">
                      <h3 className="font-semibold">{item.product.name}</h3>
                      <p className="text-sm text-muted-foreground mb-2">
                        R$ {item.product.price.toFixed(2)}
                      </p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => updateQuantity(item.product.id, -1)}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <span className="w-12 text-center">{item.quantity}</span>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => updateQuantity(item.product.id, 1)}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="icon"
                          onClick={() => removeItem(item.product.id)}
                          className="ml-auto"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            <Card className="p-6 h-fit">
              <h2 className="text-2xl font-bold mb-6">Finalizar Pedido</h2>

              <div className="space-y-4">
              <div>
                  <Label htmlFor="cpf">CPF</Label>
                  <Input
                    id="cpf"
                    value={cpf}
                    onChange={(e) => setCpf(e.target.value)}
                    placeholder="000.000.000-00"
                  />
                </div>

                <div>
                  <Label htmlFor="phone">Telefone (WhatsApp)</Label>
                  <Input
                    id="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(11) 99999-9999"
                  />
                </div>

                <div>
                  <Label htmlFor="address">Endereço de Entrega</Label>
                  <Textarea
                    id="address"
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    placeholder="Rua, número, bairro, cidade"
                  />
                </div>

                <div>
                  <Label htmlFor="payment">Forma de Pagamento</Label>
                  <Select value={paymentMethod} onValueChange={(value: any) => setPaymentMethod(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Dinheiro na entrega</SelectItem>
                      <SelectItem value="pix">PIX na entrega</SelectItem>
                      <SelectItem value="card">Cartão na entrega</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="notes">Observações (opcional)</Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Informações adicionais sobre a entrega"
                  />
                </div>

                <div className="border-t pt-4 mt-4">
                  <div className="flex justify-between mb-2">
                    <span>Subtotal</span>
                    <span>R$ {total.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-xl mb-4">
                    <span>Total</span>
                    <span className="bg-gradient-gold bg-clip-text text-transparent">
                      R$ {total.toFixed(2)}
                    </span>
                  </div>
                  <Alert variant={total < 70 ? 'destructive' : 'default'} className="mb-4">
                    <AlertTitle>Aviso</AlertTitle>
                    <AlertDescription>
                      Compras precisam ser a partir de R$ 70,00 (Dinheiro, PIX ou Cartão na entrega).
                      {total < 70 && (
                        <span className="block mt-1">Total atual: R$ {total.toFixed(2)}</span>
                      )}
                    </AlertDescription>
                  </Alert>
                  <p className="text-sm text-muted-foreground mb-4">
                    Pagamento na entrega
                  </p>
                  {/* Modal de aviso para pedido mínimo */}
                  <AlertDialog open={minOrderOpen} onOpenChange={setMinOrderOpen}>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Valor mínimo não atingido</AlertDialogTitle>
                        <AlertDialogDescription>
                          O pedido mínimo é de {formatCurrency(70)}.
                          {total < 70 && (
                            <span className="block mt-1">
                              Faltam {formatCurrency(70 - total)} para atingir o mínimo.
                            </span>
                          )}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Fechar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => setMinOrderOpen(false)}>Entendi</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                  <Button
                    variant="gold"
                    className="w-full"
                    onClick={() => {
                      if (total < 70) {
                        setMinOrderOpen(true);
                        return;
                      }
                      handleCheckout();
                    }}
                    disabled={loading}
                  >
                    {loading ? 'Processando...' : 'Finalizar Pedido'}
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default Cart;
