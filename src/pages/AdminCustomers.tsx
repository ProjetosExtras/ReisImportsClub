import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
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
  const [editOpen, setEditOpen] = useState(false);
  const [editProfile, setEditProfile] = useState<ProfileRow | null>(null);
  const [editFullName, setEditFullName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editCpf, setEditCpf] = useState("");
  const [editRgUrl, setEditRgUrl] = useState("");
  const safeRgUrl = useMemo(() => {
    const v = editRgUrl.trim();
    if (!v) return "";
    return /^https?:\/\//i.test(v) ? v : `https://${v}`;
  }, [editRgUrl]);
  const rgIsPdf = useMemo(() => /\.pdf($|\?)/i.test(editRgUrl.trim()), [editRgUrl]);
  const rgIsImage = useMemo(() => /\.(png|jpe?g|gif|webp)($|\?)/i.test(editRgUrl.trim()), [editRgUrl]);

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
      const msg = error?.message || 'Erro ao carregar clientes';
      toast.error(msg);
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

  const openEdit = async (p: ProfileRow) => {
    setEditProfile(p);
    setEditFullName(p.full_name || "");
    setEditPhone(p.phone || "");
    setEditAddress(p.address || "");
    setEditCpf(p.cpf || "");
    setEditRgUrl(p.rg_url || "");
    setEditOpen(true);

    // Caso o endereço do perfil esteja vazio, tenta recuperar do último pedido
    if (!p.address) {
      try {
        const { data, error } = await supabase
          .from('orders')
          .select('delivery_address, created_at')
          .eq('user_id', p.id)
          .order('created_at', { ascending: false })
          .limit(1);
        if (!error && data && data.length > 0) {
          const addr = data[0]?.delivery_address || '';
          if (addr) setEditAddress(addr);
        }
      } catch (e) {
        // silencioso; não precisa bloquear o modal
      }
    }
  };

  const handleEditSave = async () => {
    if (!editProfile) return;
    const name = editFullName.trim();
    const phone = editPhone.replace(/\D/g, "");
    const address = editAddress.trim();
    const cpf = editCpf.replace(/\D/g, "");
    const rgUrl = editRgUrl.trim();

    if (!name) {
      toast.error("Nome é obrigatório");
      return;
    }
    if (!phone) {
      toast.error("Telefone é obrigatório");
      return;
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: name,
          phone: phone,
          address: address || null,
          cpf: cpf || null,
          rg_url: rgUrl || null,
        })
        .eq('id', editProfile.id);

      if (error) throw error;
      toast.success("Cliente atualizado");
      setEditOpen(false);
      await loadProfiles();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao salvar alterações");
    }
  };

  const handleOpenRg = () => {
    const url = editRgUrl.trim();
    if (!url) {
      toast.info('Nenhum documento anexado');
      return;
    }
    const safeUrl = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    window.open(safeUrl, '_blank');
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

        {filtered.length === 0 && !loading ? (
          <Card className="p-6 text-center text-sm text-muted-foreground">
            Nenhum cliente encontrado ou acesso restrito. Se você é admin, garanta que a política RLS de leitura para
            admins em `profiles` esteja aplicada no banco.
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((p) => (
              <Card key={p.id} className="p-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold">{p.full_name || 'Sem nome'}</p>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(p)}>Editar</Button>
                      <Button variant="outline" size="sm" onClick={() => openWhatsApp(p.phone, p.full_name)}>
                        <MessageCircle className="h-4 w-4 mr-1" /> WhatsApp
                      </Button>
                    </div>
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
        )}
        {/* Editar cliente modal */}
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar cliente</DialogTitle>
              <DialogDescription>Atualize os dados do cliente e salve.</DialogDescription>
            </DialogHeader>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit_full_name">Nome</Label>
                <Input id="edit_full_name" value={editFullName} onChange={(e) => setEditFullName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_phone">Telefone</Label>
                <Input id="edit_phone" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} placeholder="Ex.: 11999999999" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="edit_address">Endereço</Label>
                <Input id="edit_address" value={editAddress} onChange={(e) => setEditAddress(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_cpf">CPF</Label>
                <Input id="edit_cpf" value={editCpf} onChange={(e) => setEditCpf(e.target.value)} placeholder="Ex.: 00000000000" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_rg_url">URL do RG (opcional)</Label>
                <div className="flex gap-2">
                  <Input id="edit_rg_url" value={editRgUrl} onChange={(e) => setEditRgUrl(e.target.value)} placeholder="https://..." />
                  <Button type="button" variant="outline" onClick={handleOpenRg} disabled={!editRgUrl}>Visualizar</Button>
                </div>
              </div>
              {editRgUrl && (
                <div className="space-y-2 md:col-span-2">
                  <Label>Pré-visualização do documento</Label>
                  {rgIsPdf ? (
                    <iframe src={safeRgUrl} className="w-full h-72 rounded border" title="Pré-visualização RG" />
                  ) : rgIsImage ? (
                    <img src={safeRgUrl} alt="Documento RG" className="max-h-72 rounded border" />
                  ) : (
                    <a href={safeRgUrl} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline">
                      Abrir documento em nova aba
                    </a>
                  )}
                  <p className="text-xs text-muted-foreground">Se não renderizar aqui, use o botão Visualizar.</p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
              <Button variant="gold" onClick={handleEditSave}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default AdminCustomers;