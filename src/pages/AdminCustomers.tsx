import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { MessageCircle } from "lucide-react";

interface ProfileRow {
  id: string;
  full_name: string | null;
  phone: string | null;
  address: string | null;
  cpf: string | null;
  rg_url: string | null;
  created_at?: string | null;
}

const formatCPF = (cpf?: string | null) => {
  if (!cpf) return "-";
  const digits = cpf.replace(/\D/g, "");
  if (digits.length !== 11) return cpf;
  return `${digits.slice(0,3)}.${digits.slice(3,6)}.${digits.slice(6,9)}-${digits.slice(9,11)}`;
};

const AdminCustomers = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    checkAdmin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkAdmin = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error('Faça login para acessar Clientes');
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
      return;
    }

    loadProfiles();
  };

  const loadProfiles = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, phone, address, cpf, rg_url')
        .order('full_name', { ascending: true });

      if (error) throw error;
      setProfiles(data || []);
    } catch (error: any) {
      toast.error('Erro ao carregar clientes');
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return profiles;
    return profiles.filter(p => {
      const name = (p.full_name || '').toLowerCase();
      const cpf = (p.cpf || '').replace(/\D/g, '');
      const phone = (p.phone || '').replace(/\D/g, '');
      return (
        name.includes(q) ||
        cpf.includes(q.replace(/\D/g, '')) ||
        phone.includes(q.replace(/\D/g, ''))
      );
    });
  }, [profiles, search]);

  const openWhatsApp = (phone?: string | null, customerName?: string | null) => {
    if (!phone) return;
    const cleanPhone = phone.replace(/\D/g, '');
    const message = `Olá${customerName ? ` ${customerName}` : ''}! Podemos ajudar?`;
    window.open(`https://wa.me/55${cleanPhone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Clientes cadastrados</h1>
          <Button variant="ghost" onClick={loadProfiles} disabled={loading}>
            Atualizar
          </Button>
        </div>

        <Card className="p-4 mb-6">
          <div className="grid md:grid-cols-3 gap-4 items-end">
            <div>
              <Label htmlFor="search">Buscar</Label>
              <Input
                id="search"
                placeholder="Nome, CPF ou telefone"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="text-sm text-muted-foreground md:text-right">
              {loading ? 'Carregando...' : `${filtered.length} cliente(s)`}
            </div>
          </div>
        </Card>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((p) => (
            <Card key={p.id} className="p-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-semibold">{p.full_name || 'Sem nome'}</p>
                  <Button variant="outline" size="sm" onClick={() => openWhatsApp(p.phone, p.full_name)}>
                    <MessageCircle className="h-4 w-4 mr-1" /> WhatsApp
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">CPF: {formatCPF(p.cpf)}</p>
                <p className="text-sm text-muted-foreground">Telefone: {p.phone || '-'}</p>
                <p className="text-sm text-muted-foreground">Endereço: {p.address || '-'}</p>
                {p.rg_url && (
                  <a
                    href={p.rg_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-primary hover:underline"
                  >
                    Ver documento RG
                  </a>
                )}
                {/* Se precisarmos exibir data de cadastro no futuro, podemos adicionar created_at via migração */}
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminCustomers;