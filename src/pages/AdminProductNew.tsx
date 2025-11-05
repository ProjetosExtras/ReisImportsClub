import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const AdminProductNew = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [form, setForm] = useState({
    name: "",
    description: "",
    price: "",
    stock: "0",
    image_url: "",
    is_active: true,
    cpf_limit_per_cpf: "",
    category: "exclusivos" as "exclusivos" | "decor",
  });

  useEffect(() => {
    checkAdmin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkAdmin = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error('Faça login para acessar o painel');
      navigate('/auth');
      return;
    }
    setUserId(user.id);

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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
      .filter((f) => f.type.startsWith('image/'))
      .slice(0, 3);

    setImageFiles(files);
    setImagePreviews(files.map((f) => URL.createObjectURL(f)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validações básicas
    if (!form.name.trim()) {
      toast.error('Informe o nome do produto');
      return;
    }
    const priceNum = Number(form.price);
    if (isNaN(priceNum) || priceNum <= 0) {
      toast.error('Preço inválido');
      return;
    }
    const stockNum = Number(form.stock);
    if (isNaN(stockNum) || stockNum < 0) {
      toast.error('Estoque inválido');
      return;
    }

    // Limite por CPF (opcional)
    const cpfLimitNum = form.cpf_limit_per_cpf.trim() === "" ? null : Number(form.cpf_limit_per_cpf);
    if (cpfLimitNum !== null && (isNaN(cpfLimitNum) || cpfLimitNum < 0)) {
      toast.error('Limite por CPF inválido');
      return;
    }

    try {
      setLoading(true);
      let finalImageUrl: string | null = form.image_url.trim() || null;
      let uploadedUrls: string[] = [];

      if (imageFiles.length > 0) {
        for (const file of imageFiles) {
          const path = `${userId || 'admin'}/${Date.now()}_${file.name}`;
          const uploadRes = await supabase.storage
            .from('products')
            .upload(path, file, { upsert: true, contentType: file.type || 'image/*' });

          if (uploadRes.error) {
            if ((uploadRes.error as any).statusCode === 404) {
              toast.error("Bucket 'products' não encontrado. Crie-o no Supabase Storage com leitura pública.");
            } else {
              toast.error('Falha no upload da imagem');
            }
            setLoading(false);
            return;
          }

          const { data: publicUrlData } = supabase.storage
            .from('products')
            .getPublicUrl(path);
          if (publicUrlData.publicUrl) uploadedUrls.push(publicUrlData.publicUrl);
        }

        // Usa a primeira imagem como principal
        finalImageUrl = uploadedUrls[0] || finalImageUrl;
      }

      // Primeiro tenta com cpf_limit_per_cpf e category; se a coluna não existir, faz fallback sem elas
      let insertRes = await supabase
        .from('products')
        .insert({
          name: form.name.trim(),
          description: form.description.trim() || null,
          price: priceNum,
          stock: stockNum,
          image_url: finalImageUrl,
          is_active: form.is_active,
          cpf_limit_per_cpf: cpfLimitNum,
          category: form.category,
        })
        .select()
        .single();

      if (insertRes.error) {
        const msg = String(insertRes.error.message || '').toLowerCase();
        if (msg.includes('cpf_limit_per_cpf') || msg.includes('category') || msg.includes('column') || msg.includes('coluna')) {
          insertRes = await supabase
            .from('products')
            .insert({
              name: form.name.trim(),
              description: form.description.trim() || null,
              price: priceNum,
              stock: stockNum,
              image_url: finalImageUrl,
              is_active: form.is_active,
            })
            .select()
            .single();
          if (!insertRes.error) {
            toast.info('Produto salvo sem limite por CPF/categoria (aplique as migrações para habilitar).');
          }
        }
      }

      if (insertRes.error) throw insertRes.error;
      const productData = insertRes.data;

      // Persistir imagens adicionais (além da principal) em product_images
      if (productData && uploadedUrls.length > 1) {
        const extraImages = uploadedUrls.slice(1).map((url, idx) => ({
          product_id: productData.id,
          image_url: url,
          position: idx + 1,
        }));

        const insertImages = await (supabase as any)
          .from('product_images')
          .insert(extraImages);

        if (insertImages.error) {
          toast.error('Produto salvo, mas houve erro ao salvar imagens extras');
        }
      }
      toast.success('Produto cadastrado com sucesso!');
      navigate('/admin');
    } catch (err: any) {
      toast.error('Erro ao cadastrar produto');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">Cadastrar Produto</h1>
        <Card className="p-6">
          <form onSubmit={handleSubmit} className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <Input id="name" name="name" value={form.name} onChange={handleChange} placeholder="Ex: Relógio Luxury Gold" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="price">Preço (R$)</Label>
              <Input id="price" name="price" type="number" step="0.01" min="0" value={form.price} onChange={handleChange} placeholder="Ex: 1299.90" />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea id="description" name="description" value={form.description} onChange={handleChange} placeholder="Detalhes do produto" />
            </div>

          <div className="space-y-2">
            <Label htmlFor="stock">Estoque</Label>
            <Input id="stock" name="stock" type="number" min="0" value={form.stock} onChange={handleChange} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cpf_limit_per_cpf">Limite por CPF</Label>
            <Input
              id="cpf_limit_per_cpf"
              name="cpf_limit_per_cpf"
              type="number"
              min="0"
              value={form.cpf_limit_per_cpf}
              onChange={handleChange}
              placeholder="Ex: 1 (opcional)"
            />
          </div>

            <div className="space-y-2">
              <Label htmlFor="category">Categoria</Label>
              <select
                id="category"
                name="category"
                value={form.category}
                onChange={handleChange}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
              >
                <option value="exclusivos">Produtos Exclusivos</option>
                <option value="decor">Produtos Decoração de casa</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="image_url">Imagem (URL)</Label>
              <Input id="image_url" name="image_url" value={form.image_url} onChange={handleChange} placeholder="https://..." />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="image_file">Upload de Imagens (máx. 3)</Label>
              <Input id="image_file" name="image_file" type="file" multiple accept="image/*" onChange={handleFileChange} />
              {imagePreviews.length > 0 && (
                <div className="mt-2 flex gap-3 flex-wrap">
                  {imagePreviews.map((src, idx) => (
                    <img key={idx} src={src} alt={`Pré-visualização ${idx + 1}`} className="h-24 w-24 object-cover rounded" />
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 md:col-span-2">
              <Checkbox id="is_active" checked={form.is_active} onCheckedChange={(checked) => setForm((prev) => ({ ...prev, is_active: Boolean(checked) }))} />
              <Label htmlFor="is_active">Produto ativo</Label>
            </div>

            <div className="md:col-span-2 flex gap-3 justify-end">
              <Button type="button" variant="secondary" onClick={() => navigate('/admin')}>Cancelar</Button>
              <Button type="submit" variant="gold" disabled={loading}>{loading ? 'Salvando...' : 'Salvar Produto'}</Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default AdminProductNew;