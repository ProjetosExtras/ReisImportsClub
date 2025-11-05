import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { StockUrgencyBar } from "@/components/StockUrgencyBar";

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  image_url: string | null;
  stock: number;
  cpf_limit_per_cpf?: number | null;
}

const VerifiedBadge = () => (
  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white shadow-sm ring-2 ring-blue-300" title="Verificado">
    <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
      <path fill="currentColor" d="M9 16.2l-3.5-3.5L4 14.2l5 5 10-10-1.5-1.5z" />
    </svg>
  </span>
);

const ProductDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState<number>(15 * 60); // 15 minutes in seconds
  const [quantity, setQuantity] = useState<number>(1);
  interface ProductImage { id: string; image_url: string; position: number }
  const [extraImages, setExtraImages] = useState<ProductImage[]>([]);
  const socialProof: { name: string; date: string; rating: number; comment: string }[] = [
    { name: 'Isabelle', date: '12/01/2025', rating: 3, comment: 'Gostei bastante, chegou rápido.' },
    { name: 'Letícia', date: '12/01/2025', rating: 2, comment: 'Chegou muito rápido, amei.' },
    { name: 'Raquel', date: '16/06/2024', rating: 5, comment: 'Chegou certinho e bem embalado.' },
    { name: 'Carlos', date: '08/10/2024', rating: 4, comment: 'Qualidade muito boa, recomendo.' },
    { name: 'Ana', date: '25/09/2024', rating: 5, comment: 'Atendimento excelente, tudo perfeito.' },
    { name: 'João', date: '03/08/2024', rating: 3, comment: 'Bom custo-benefício, compraria de novo.' },
    { name: 'Mariana', date: '14/07/2024', rating: 4, comment: 'Embalagem impecável, produto intacto.' },
    { name: 'Felipe', date: '11/07/2024', rating: 5, comment: 'Experiência ótima do início ao fim.' },
    { name: 'Beatriz', date: '29/06/2024', rating: 4, comment: 'Original e de excelente acabamento.' },
    { name: 'Gustavo', date: '21/06/2024', rating: 5, comment: 'Entrega rápida, superou expectativas.' },
  ];

  useEffect(() => {
    loadProduct();
    loadProductImages();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    const endAt = Date.now() + timeLeft * 1000;
    const interval = setInterval(() => {
      const diff = Math.max(0, Math.floor((endAt - Date.now()) / 1000));
      setTimeLeft(diff);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const loadProduct = async () => {
    if (!id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      toast.error('Produto não encontrado');
      navigate('/');
      return;
    }

    setProduct(data as Product);
    setLoading(false);
  };

  const loadProductImages = async () => {
    if (!id) return;
    try {
      const { data, error } = await (supabase as any)
        .from('product_images')
        .select('id, image_url, position')
        .eq('product_id', id)
        .order('position', { ascending: true });
      if (error) return; // silencioso
      setExtraImages((data || []) as ProductImage[]);
    } catch (_) {
      // silencioso
    }
  };

  const addToCart = () => {
    if (!product) return;
    // Enforce per-CPF limit on the client-side UI level
    const hasLimit = typeof product.cpf_limit_per_cpf === 'number';
    const limitVal = hasLimit ? (product.cpf_limit_per_cpf ?? null) : null;
    if (limitVal === 0) {
      toast.error('Este produto está bloqueado para compra por CPF.');
      return;
    }
    const maxAllowed = Math.min(
      product.stock,
      typeof limitVal === 'number' ? limitVal : Infinity
    );
    if (quantity > maxAllowed) {
      toast.error(`Limite de ${maxAllowed} unidade(s) por CPF para este produto.`);
      return;
    }
    const savedCart = localStorage.getItem('cart');
    const cart = savedCart ? JSON.parse(savedCart) : [];
    const existing = cart.find((item: any) => item.product.id === product.id);
    let newCart;
    if (existing) {
      newCart = cart.map((item: any) => {
        if (item.product.id !== product.id) return item;
        const nextQty = item.quantity + quantity;
        const clampedQty = Math.min(nextQty, maxAllowed);
        if (nextQty > maxAllowed) {
          toast.info(`Quantidade ajustada para ${clampedQty} devido ao limite por CPF.`);
        }
        return { ...item, quantity: clampedQty };
      });
    } else {
      newCart = [...cart, { product, quantity: Math.min(quantity, maxAllowed) }];
    }
    localStorage.setItem('cart', JSON.stringify(newCart));
    toast.success('Adicionado ao carrinho');
    navigate('/cart');
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const avgRating = Math.round(
    (socialProof.reduce((acc, r) => acc + r.rating, 0) / socialProof.length) * 10
  ) / 10;
  const fullStars = Math.floor(avgRating);
  const emptyStars = 5 - fullStars;
  const reviewsCount = socialProof.length;
  const discountPercent = 70; // estático para visual, ajuste quando houver preço original
  const installment2x = product ? product.price / 2 : 0;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        {loading ? (
          <p>Carregando produto...</p>
        ) : !product ? (
          <p>Produto não encontrado.</p>
        ) : (
          <>
            <div className="grid gap-8 md:grid-cols-2">
              <div>
                <Dialog>
                  <DialogTrigger asChild>
                    <Card className="overflow-hidden cursor-zoom-in">
                      <img
                        src={product.image_url || extraImages[0]?.image_url || '/placeholder.svg'}
                        alt={product.name}
                        className="w-full h-[420px] md:h-[480px] object-cover"
                      />
                    </Card>
                  </DialogTrigger>
                  <DialogContent className="max-w-3xl p-0 bg-transparent border-0 shadow-none">
                    <DialogTitle className="sr-only">{product.name}</DialogTitle>
                    <img
                      src={product.image_url || extraImages[0]?.image_url || '/placeholder.svg'}
                      alt={product.name}
                      className="w-full h-auto max-h-[80vh] object-contain rounded"
                    />
                  </DialogContent>
                </Dialog>
              </div>
              <div>
                <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
                  {product.name}
                  <VerifiedBadge />
                </h1>
                <div className="flex items-center gap-2 text-yellow-500 text-sm mb-2">
                  <span>{'★'.repeat(fullStars)}</span>
                  <span className="text-muted-foreground">{'☆'.repeat(emptyStars)}</span>
                  <span className="text-muted-foreground">({reviewsCount} avaliações)</span>
                </div>

                <div className="flex flex-wrap items-center gap-4 mb-2">
                  <span className="text-4xl font-extrabold text-pink-500">
                    {formatCurrency(product.price)}
                  </span>
                  <span className="text-xs bg-green-100 text-green-700 font-bold px-2 py-1 rounded">-{discountPercent}%</span>
                </div>
                <div className="text-lg text-muted-foreground mb-1">
                  2x de {formatCurrency(installment2x)}
                </div>
                <Dialog>
                  <DialogTrigger asChild>
                    <button className="text-sm text-blue-600 underline mb-4">
                      Ver opções de parcelamento
                    </button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogTitle>Parcelamento</DialogTitle>
                    <div className="space-y-3">
                      <p className="text-sm text-muted-foreground">
                        Parcelamento disponível em até 2x sem juros.
                      </p>
                      <div className="flex items-center gap-3">
                        <span className="text-xl font-semibold">2x</span>
                        <span className="text-lg">de {formatCurrency(installment2x)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Pagamento na entrega via MercadoPago (PIX, cartão ou dinheiro).
                      </p>
                    </div>
                  </DialogContent>
                </Dialog>

                <div className="flex items-center gap-2 text-lg font-semibold mb-4">
                  <span>Frete grátis</span>
                  <span className="text-green-600">⚡ FULL</span>
                </div>

                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <Card className="flex items-center justify-between w-full sm:w-[160px] p-2">
                    <button
                      className="text-xl px-3 disabled:opacity-50"
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      aria-label="Diminuir quantidade"
                      disabled={quantity <= 1}
                    >
                      −
                    </button>
                    <span className="text-lg font-semibold">{quantity}</span>
                    <button
                      className="text-xl px-3 disabled:opacity-50"
                      onClick={() => setQuantity((q) => {
                        const limit = typeof product.cpf_limit_per_cpf === 'number' ? (product.cpf_limit_per_cpf ?? null) : null;
                        const maxAllowed = Math.min(product.stock, typeof limit === 'number' ? limit : Infinity);
                        return Math.min(q + 1, maxAllowed);
                      })}
                      aria-label="Aumentar quantidade"
                      disabled={(() => {
                        const limit = typeof product.cpf_limit_per_cpf === 'number' ? (product.cpf_limit_per_cpf ?? null) : null;
                        const maxAllowed = Math.min(product.stock, typeof limit === 'number' ? limit : Infinity);
                        return quantity >= maxAllowed;
                      })()}
                    >
                      +
                    </button>
                  </Card>
                  <Button
                    size="lg"
                    className="bg-green-500 hover:bg-green-600 text-white h-12 px-10"
                    onClick={addToCart}
                    disabled={product.stock === 0 || product.cpf_limit_per_cpf === 0}
                  >
                    comprar
                  </Button>
                </div>
                {typeof product.cpf_limit_per_cpf === 'number' && product.cpf_limit_per_cpf !== null && (
                  <p className="text-xs text-muted-foreground mb-4">Limite de {product.cpf_limit_per_cpf} unidade(s) por CPF.</p>
                )}

                <div className="mb-6">
                  <p className="text-sm">PARCELE SUA COMPRA POR <span className="font-semibold">MERCADOPAGO</span> EM ATÉ:</p>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-5xl font-extrabold text-blue-400">12X</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-4">
                    {['VISA','MasterCard','American Express','Hipercard','Elo','Diners','Boleto'].map((m) => (
                      <span key={m} className="text-xs rounded border px-3 py-1 bg-background">
                        {m}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mb-6">
                  <p className="text-sm font-semibold">SIMULAR FRETE</p>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <input
                      type="text"
                      placeholder="Ex.: 00000-000"
                      className="border rounded px-3 py-2 w-full sm:w-48"
                    />
                    <Button
                      className="bg-pink-400 hover:bg-pink-500 text-white"
                      onClick={() => toast.info('Frete calculado no checkout')}
                    >
                      OK
                    </Button>
                  </div>
                </div>

                <Card className="p-4 mb-6">
                  <p className="text-sm text-muted-foreground">Oferta por tempo limitado</p>
                  <div className="text-2xl font-mono mt-2">⏳ {formatTime(timeLeft)}</div>
                </Card>

                <div className="text-sm text-muted-foreground">
                  {product.stock > 0 ? `${product.stock} disponíveis` : 'Esgotado'}
                </div>
                {/* Urgency bar under stock info */}
                <div className="mt-2 max-w-xs">
                  {/* Force show the stock bar for any positive stock */}
                  <StockUrgencyBar remaining={product.stock} threshold={product.stock} />
                </div>
              </div>
            </div>
            <div className="mt-4">
              <h2 className="text-xl font-semibold mb-2">DECRIÇÃO DO PRODUTO</h2>
              <p className="text-muted-foreground whitespace-pre-line">{product.description}</p>
              <div className="mt-6 max-w-3xl mx-auto text-center">
                <h3 className="text-xl font-semibold mb-2">Avaliações (10)</h3>
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-4 justify-items-center">
                  {socialProof.map((rev, idx) => (
                    <li key={idx}>
                      <Card className="p-4">
                        <div className="flex items-center gap-2 text-yellow-500 text-sm">
                          <span>{'★'.repeat(rev.rating)}</span>
                          <span className="text-muted-foreground">{'☆'.repeat(5 - rev.rating)}</span>
                        </div>
                        <div className="mt-2 text-sm">
                          <span className="font-semibold mr-2">{rev.name}</span>
                          <span className="text-muted-foreground">{rev.date}</span>
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">{rev.comment}</p>
                      </Card>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ProductDetail;