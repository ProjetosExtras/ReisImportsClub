import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const AdminProductEdit = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [loading, setLoading] = useState(false);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  interface ProductImage {
    id: string;
    image_url: string;
    position: number;
  }
  const [existingImages, setExistingImages] = useState<ProductImage[]>([]);
  const [loadingImages, setLoadingImages] = useState(false);
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

  // Utilitários para máscara e parsing em Real brasileiro (pt-BR)
  const formatCurrencyBRLInput = (raw: string) => {
    const digits = raw.replace(/\D/g, "");
    const number = Number(digits || "0") / 100;
    return number.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const parseCurrencyBRLToNumber = (masked: string) => {
    const normalized = masked.replace(/\./g, "").replace(/,/g, ".").replace(/[^0-9.]/g, "");
    const n = Number(normalized);
    return n;
  };

  useEffect(() => {
    checkAdmin();
    loadProduct();
    loadProductImages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Pré-visualização dos arquivos selecionados (não enviados ainda)
  useEffect(() => {
    const urls = imageFiles.map((file) => URL.createObjectURL(file));
    setPreviewUrls(urls);
    return () => {
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [imageFiles]);

  const removeSelectedFile = (index: number) => {
    setImageFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const clearSelectedFiles = () => {
    setImageFiles([]);
  };

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

  const loadProduct = async () => {
    if (!id) return;
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      if (data) {
        setForm({
          name: data.name || "",
          description: data.description || "",
          price: data.price != null ? Number(data.price).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "",
          stock: String(data.stock ?? "0"),
          image_url: data.image_url || "",
          is_active: Boolean(data.is_active),
          cpf_limit_per_cpf: String((data as any).cpf_limit_per_cpf ?? ""),
          category: (data as any).category ?? "exclusivos",
        });
      }
    } catch (err: any) {
      toast.error('Erro ao carregar produto');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === "price") {
      const masked = formatCurrencyBRLInput(value);
      setForm((prev) => ({ ...prev, price: masked }));
      return;
    }
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleUploadImages = async () => {
    try {
      if (!id) {
        toast.error('Produto inválido');
        return;
      }

      if (imageFiles.length === 0) {
        toast.info('Selecione uma ou mais imagens para enviar');
        return;
      }

      setLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id || 'admin';
      const uploadedUrls: string[] = [];

      for (const file of imageFiles) {
        const path = `${userId}/${Date.now()}_${file.name}`;
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

      if (uploadedUrls.length === 0) {
        toast.error('Não foi possível obter as URLs públicas das imagens');
        setLoading(false);
        return;
      }

      // Define a primeira imagem como principal
      setForm((prev) => ({ ...prev, image_url: uploadedUrls[0] }));
      // Persistir imediatamente a imagem principal no produto
      try {
        const { error: upErr } = await supabase
          .from('products')
          .update({ image_url: uploadedUrls[0] })
          .eq('id', id);
        if (upErr) {
          // não bloquear fluxo; apenas informar
          toast.info('Imagem principal atualizada localmente. Salve para persistir se necessário.');
        }
      } catch (_) {
        // silencioso
      }

      // Salva imagens extras em product_images (além da principal)
      if (uploadedUrls.length > 1) {
        const extraImages = uploadedUrls.slice(1).map((url, idx) => ({
          product_id: id,
          image_url: url,
          position: idx + 1,
        }));

        const insertImages = await (supabase as any)
          .from('product_images')
          .insert(extraImages);

        if (insertImages.error) {
          toast.error('Imagens principais atualizadas, mas houve erro ao salvar imagens extras');
        }
      }

      toast.success('Upload concluído! Imagem principal atualizada.');
      await loadProductImages();
    } catch (err: any) {
      toast.error('Erro ao enviar imagens');
    } finally {
      setLoading(false);
    }
  };

  const loadProductImages = async () => {
    if (!id) return;
    try {
      setLoadingImages(true);
      const { data, error } = await (supabase as any)
        .from('product_images')
        .select('id, image_url, position')
        .eq('product_id', id)
        .order('position', { ascending: true });

      if (error) throw error;
      setExistingImages((data || []) as ProductImage[]);
    } catch (err) {
      // silencioso
    } finally {
      setLoadingImages(false);
    }
  };

  const getStoragePathFromPublicUrl = (url: string): string | null => {
    try {
      const match = url.match(/\/object\/public\/products\/(.+)$/);
      return match && match[1] ? match[1] : null;
    } catch {
      return null;
    }
  };

  const handleRemoveMainImage = async () => {
    if (!id) return;
    if (!form.image_url) return;
    try {
      setLoadingImages(true);
      const path = getStoragePathFromPublicUrl(form.image_url);
      if (path) {
        await supabase.storage.from('products').remove([path]);
      }
      const { error } = await supabase
        .from('products')
        .update({ image_url: null })
        .eq('id', id);
      if (error) throw error;
      setForm((prev) => ({ ...prev, image_url: "" }));
      toast.success('Imagem principal removida');
    } catch (err: any) {
      toast.error('Erro ao remover imagem principal');
    } finally {
      setLoadingImages(false);
    }
  };

  const handleRemoveAdditionalImage = async (img: ProductImage) => {
    if (!id) return;
    try {
      setLoadingImages(true);
      const { error } = await (supabase as any)
        .from('product_images')
        .delete()
        .eq('id', img.id);
      if (error) throw error;
      const path = getStoragePathFromPublicUrl(img.image_url);
      if (path) {
        await supabase.storage.from('products').remove([path]);
      }
      setExistingImages((prev) => prev.filter((i) => i.id !== img.id));
      toast.success('Imagem removida');
    } catch (err: any) {
      toast.error('Erro ao remover imagem');
    } finally {
      setLoadingImages(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!id) {
      toast.error('Produto inválido');
      return;
    }

    // Validações básicas
    if (!form.name.trim()) {
      toast.error('Informe o nome do produto');
      return;
    }
    const priceNum = parseCurrencyBRLToNumber(form.price);
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
      // Primeiro tenta com cpf_limit_per_cpf; se a coluna não existir, faz fallback sem ela
      let updateRes = await supabase
        .from('products')
        .update({
          name: form.name.trim(),
          description: form.description.trim() || null,
          price: priceNum,
          stock: stockNum,
          image_url: form.image_url.trim() || null,
          is_active: form.is_active,
          cpf_limit_per_cpf: cpfLimitNum,
          category: form.category,
        })
        .eq('id', id);

      if (updateRes.error) {
        const msg = String(updateRes.error.message || '').toLowerCase();

        // If only category is missing, retry keeping cpf_limit_per_cpf
        if (msg.includes('category')) {
          const retryRes = await supabase
            .from('products')
            .update({
              name: form.name.trim(),
              description: form.description.trim() || null,
              price: priceNum,
              stock: stockNum,
              image_url: form.image_url.trim() || null,
              is_active: form.is_active,
              cpf_limit_per_cpf: cpfLimitNum,
            })
            .eq('id', id);
          if (!retryRes.error) {
            updateRes = retryRes;
            toast.info('Categoria não aplicada (coluna ausente). Limite por CPF mantido.');
          }
        }

        // If cpf_limit_per_cpf is missing, retry keeping category
        if (updateRes.error) {
          const newMsg = String(updateRes.error.message || '').toLowerCase();
          if (newMsg.includes('cpf_limit_per_cpf')) {
            const retryRes2 = await supabase
              .from('products')
              .update({
                name: form.name.trim(),
                description: form.description.trim() || null,
                price: priceNum,
                stock: stockNum,
                image_url: form.image_url.trim() || null,
                is_active: form.is_active,
                category: form.category,
              })
              .eq('id', id);
            if (!retryRes2.error) {
              updateRes = retryRes2;
              toast.info('Limite por CPF não aplicado (coluna ausente). Categoria mantida.');
            }
          }
        }

        // Generic column errors: try excluding category first, then cpf limit, then both
        if (updateRes.error) {
          if (msg.includes('column') || msg.includes('coluna')) {
            const retryA = await supabase
              .from('products')
              .update({
                name: form.name.trim(),
                description: form.description.trim() || null,
                price: priceNum,
                stock: stockNum,
                image_url: form.image_url.trim() || null,
                is_active: form.is_active,
                cpf_limit_per_cpf: cpfLimitNum,
              })
              .eq('id', id);
            if (!retryA.error) {
              updateRes = retryA;
              toast.info('Categoria não aplicada (coluna ausente). Limite por CPF mantido.');
            }
            if (updateRes.error) {
              const retryB = await supabase
                .from('products')
                .update({
                  name: form.name.trim(),
                  description: form.description.trim() || null,
                  price: priceNum,
                  stock: stockNum,
                  image_url: form.image_url.trim() || null,
                  is_active: form.is_active,
                  category: form.category,
                })
                .eq('id', id);
              if (!retryB.error) {
                updateRes = retryB;
                toast.info('Limite por CPF não aplicado (coluna ausente). Categoria mantida.');
              }
            }
            if (updateRes.error) {
              const retryC = await supabase
                .from('products')
                .update({
                  name: form.name.trim(),
                  description: form.description.trim() || null,
                  price: priceNum,
                  stock: stockNum,
                  image_url: form.image_url.trim() || null,
                  is_active: form.is_active,
                })
                .eq('id', id);
              if (!retryC.error) {
                updateRes = retryC;
                toast.info('Produto atualizado sem categoria/limite (aplique migrações para habilitar).');
              }
            }
          }
        }
      }

      if (updateRes.error) throw updateRes.error;

      toast.success('Produto atualizado com sucesso!');
      navigate('/admin/produtos');
    } catch (err: any) {
      toast.error('Erro ao atualizar produto');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">Editar Produto</h1>
        <div className="max-w-3xl mx-auto">
          <Card className="p-6 md:p-8 rounded-xl border border-muted shadow-lg bg-card/80 backdrop-blur-sm">
          <form onSubmit={handleSubmit} className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <Input id="name" name="name" value={form.name} onChange={handleChange} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="price">Preço (R$)</Label>
              <Input id="price" name="price" type="text" inputMode="decimal" autoComplete="off" placeholder="Ex: 1.299,90" value={form.price} onChange={handleChange} />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea id="description" name="description" value={form.description} onChange={handleChange} />
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
              <Input id="image_url" name="image_url" value={form.image_url} onChange={handleChange} />
            </div>

            {/* Upload de fotos do produto */}
            <div className="space-y-2 md:col-span-2">
              <Label>Fotos do produto</Label>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => setImageFiles(Array.from(e.target.files || []))}
                className="block text-sm rounded-md border border-dashed border-input px-3 py-2 bg-background"
              />
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" onClick={handleUploadImages} disabled={loading || imageFiles.length === 0}>
                  Enviar fotos
                </Button>
                {imageFiles.length > 0 && (
                  <Button type="button" variant="outline" onClick={clearSelectedFiles} disabled={loading}>
                    Limpar seleção
                  </Button>
                )}
                <span className="text-xs text-muted-foreground">
                  {imageFiles.length > 0 ? `${imageFiles.length} selecionada(s)` : 'Nenhum arquivo selecionado'}
                </span>
              </div>

              {/* Pré-visualização dos arquivos selecionados */}
              <div className="mt-2">
                {previewUrls.length === 0 ? (
                  <span className="text-xs text-muted-foreground">Nenhuma pré-visualização</span>
                ) : (
                  <div className="flex flex-wrap gap-3">
                    {previewUrls.map((url, idx) => (
                      <div key={idx} className="flex flex-col items-start gap-2">
                        <img src={url} alt="Pré-visualização" className="h-20 w-20 object-cover rounded border" />
                        <Button type="button" variant="outline" size="sm" onClick={() => removeSelectedFile(idx)}>
                          Remover seleção
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-4 space-y-3">
                <p className="text-sm font-medium">Imagem principal</p>
                {form.image_url ? (
                  <div className="flex items-center gap-3">
                    <img src={form.image_url} alt="Imagem principal" className="h-24 w-24 object-cover rounded border" />
                    <Button type="button" variant="outline" size="sm" onClick={handleRemoveMainImage} disabled={loadingImages || loading}>
                      Remover imagem principal
                    </Button>
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">Sem imagem principal</span>
                )}

                <p className="text-sm font-medium mt-2">Imagens adicionais</p>
                {loadingImages ? (
                  <span className="text-xs text-muted-foreground">Carregando imagens...</span>
                ) : existingImages.length === 0 ? (
                  <span className="text-xs text-muted-foreground">Nenhuma imagem adicional</span>
                ) : (
                  <div className="flex flex-wrap gap-3">
                    {existingImages.map((img) => (
                      <div key={img.id} className="flex flex-col items-start gap-2">
                        <img src={img.image_url} alt="Foto do produto" className="h-20 w-20 object-cover rounded border" />
                        <Button type="button" variant="outline" size="sm" onClick={() => handleRemoveAdditionalImage(img)} disabled={loadingImages}>
                          Remover
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 md:col-span-2">
              <Checkbox id="is_active" checked={form.is_active} onCheckedChange={(checked) => setForm((prev) => ({ ...prev, is_active: Boolean(checked) }))} />
              <Label htmlFor="is_active">Produto ativo</Label>
            </div>

            <div className="md:col-span-2 flex gap-3 justify-end">
              <Button type="button" variant="secondary" onClick={() => navigate('/admin/produtos')}>Cancelar</Button>
              <Button type="submit" variant="gold" disabled={loading}>{loading ? 'Salvando...' : 'Salvar Alterações'}</Button>
            </div>
          </form>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AdminProductEdit;