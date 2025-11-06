import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ProfileData {
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

const normalizeUrl = (url?: string | null) => {
  if (!url) return null;
  const u = url.trim();
  if (!u) return null;
  if (/^https?:\/\//i.test(u)) return u;
  return `https://${u}`;
};

const Profile = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [rgOpen, setRgOpen] = useState(false);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Faça login para ver seu cadastro');
        navigate('/auth');
        return;
      }
      setEmail(user.email ?? null);

      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, phone, address, cpf, rg_url, created_at')
        .eq('id', user.id)
        .single();

      if (error) {
        toast.error(error.message || 'Erro ao carregar cadastro');
      }
      setProfile(data || null);
      setLoading(false);
    };
    init();
  }, [navigate]);

  const rgUrl = useMemo(() => normalizeUrl(profile?.rg_url), [profile?.rg_url]);
  const isPdf = useMemo(() => (rgUrl ? /\.pdf($|\?)/i.test(rgUrl) : false), [rgUrl]);

  return (
    <div>
      <Navbar />
      <div className="container mx-auto px-4 py-6">
        <h2 className="text-2xl font-bold mb-4">Meu Cadastro</h2>
        <Card className="p-4 space-y-4">
          {loading && <p>Carregando...</p>}
          {!loading && !profile && (
            <div>
              <p className="text-muted-foreground">Cadastro não encontrado.</p>
              <Button className="mt-2" onClick={() => navigate('/auth')}>Ir para Login</Button>
            </div>
          )}
          {!loading && profile && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Nome</p>
                <p className="text-base">{profile.full_name || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="text-base">{email || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Telefone</p>
                <p className="text-base">{profile.phone || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Endereço</p>
                <p className="text-base">{profile.address || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">CPF</p>
                <p className="text-base">{formatCPF(profile.cpf)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Documento RG</p>
                <div className="flex items-center gap-2 mb-2">
                  <Button variant="secondary" onClick={() => setRgOpen(true)} disabled={!rgUrl}>Visualizar</Button>
                  {!rgUrl && <span className="text-base">Nenhum documento anexado.</span>}
                </div>
                {rgUrl && (
                  <div className="space-y-2">
                    {isPdf ? (
                      <iframe src={rgUrl} title="RG" className="w-full h-64 rounded border" />
                    ) : (
                      <img src={rgUrl} alt="RG" className="max-h-64 rounded border" />
                    )}
                    <div>
                      <a
                        href={rgUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        Abrir em nova aba
                      </a>
                    </div>
                  </div>
                )}
                <Dialog open={rgOpen} onOpenChange={setRgOpen}>
                  <DialogContent className="max-w-3xl">
                    <DialogHeader>
                      <DialogTitle>Documento RG</DialogTitle>
                      <DialogDescription>Visualize o documento anexado (imagem ou PDF).</DialogDescription>
                    </DialogHeader>
                    {rgUrl ? (
                      isPdf ? (
                        <iframe src={rgUrl} title="RG" className="w-full h-[70vh] rounded border" />
                      ) : (
                        <img src={rgUrl} alt="RG" className="max-h-[70vh] rounded border mx-auto" />
                      )
                    ) : (
                      <p>Documento não disponível.</p>
                    )}
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default Profile;