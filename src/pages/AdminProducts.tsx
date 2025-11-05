import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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

const AdminProducts = () => {
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAdmin();
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

  const loadProducts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setProducts((data || []) as Product[]);
    } catch (error: any) {
      toast.error('Erro ao carregar produtos');
    } finally {
      setLoading(false);
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

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">Produtos</h1>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate('/admin')}>Voltar ao Admin</Button>
            <Button variant="gold" onClick={() => navigate('/admin/produtos/novo')}>Cadastrar Produto</Button>
          </div>
        </div>

        <Card className="p-6">
          {loading ? (
            <p>Carregando produtos...</p>
          ) : products.length === 0 ? (
            <p>Nenhum produto cadastrado.</p>
          ) : (
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
                  {products.map((p) => (
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
          )}
        </Card>
      </div>
    </div>
  );
};

export default AdminProducts;