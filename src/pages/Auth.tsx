import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const Auth = () => {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    phone: '',
    address: '',
    cpf: '',
  });
  const [rgFile, setRgFile] = useState<File | null>(null);
  const rgInputRef = useRef<HTMLInputElement | null>(null);
  const [cpfError, setCpfError] = useState<string | null>(null);

  const isValidCPF = (cpf: string) => {
    const s = cpf.replace(/\D/g, "");
    if (!s || s.length !== 11) return false;
    if (/^(\d)\1{10}$/.test(s)) return false;
    let sum = 0;
    for (let i = 0; i < 9; i++) sum += parseInt(s[i]) * (10 - i);
    let d1 = (sum * 10) % 11;
    if (d1 === 10) d1 = 0;
    if (d1 !== parseInt(s[9])) return false;
    sum = 0;
    for (let i = 0; i < 10; i++) sum += parseInt(s[i]) * (11 - i);
    let d2 = (sum * 10) % 11;
    if (d2 === 10) d2 = 0;
    return d2 === parseInt(s[10]);
  };

  const validateCPF = (value: string) => {
    const valid = isValidCPF(value);
    setCpfError(valid ? null : 'CPF inválido');
    return valid;
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate('/');
      }
    });
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password,
        });

        if (error) throw error;
        
        toast.success('Login realizado com sucesso!');
        navigate('/');
      } else {
        // Validação de confirmação de senha
        if (formData.password !== formData.confirmPassword) {
          toast.error('Senhas não conferem');
          setLoading(false);
          return;
        }

        // Validação de CPF
        if (!validateCPF(formData.cpf)) {
          toast.error('CPF inválido');
          setLoading(false);
          return;
        }

        const cpfDigits = formData.cpf.replace(/\D/g, '');

        const { error } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            data: {
              full_name: formData.fullName,
              phone: formData.phone,
              cpf: cpfDigits,
            },
            emailRedirectTo: `${window.location.origin}/`,
          },
        });

        if (error) throw error;

        // Atualiza perfil com endereço e CPF, e faz upload do RG (se disponível)
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          let rgUrl: string | null = null;

          if (rgFile) {
            const path = `rg/${user.id}_${Date.now()}_${rgFile.name}`;
            const uploadRes = await supabase.storage
              .from('documents')
              .upload(path, rgFile, { upsert: true, contentType: rgFile.type || 'application/octet-stream' });

            if ((uploadRes as any).error) {
              const statusCode = (uploadRes as any).error?.statusCode;
              if (statusCode === 404) {
                toast.info("Bucket 'documents' não encontrado. Crie-o no Supabase Storage com leitura pública para armazenar o RG.");
              } else {
                toast.error('Falha no upload do RG');
              }
            } else {
              const { data: publicUrlData } = supabase.storage
                .from('documents')
                .getPublicUrl(path);
              rgUrl = publicUrlData.publicUrl || null;
            }
          }

          await supabase
            .from('profiles')
            .update({ address: formData.address || null, cpf: cpfDigits || null, rg_url: rgUrl })
            .eq('id', user.id);
        }

        toast.success('Cadastro realizado! Você já pode fazer login.');
        navigate('/');
      }
    } catch (error: any) {
      toast.error(error.message || 'Erro ao autenticar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-hero p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold bg-gradient-gold bg-clip-text text-transparent">
            ReisImportsClub
          </CardTitle>
          <CardDescription>
            {isLogin ? 'Entre na sua conta' : 'Crie sua conta premium'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="fullName">Nome Completo</Label>
                  <Input
                    id="fullName"
                    type="text"
                    required={!isLogin}
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone (WhatsApp)</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="(11) 99999-9999"
                    required={!isLogin}
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cpf">CPF</Label>
                  <Input
                    id="cpf"
                    type="text"
                    placeholder="000.000.000-00"
                    required={!isLogin}
                    value={formData.cpf}
                    onChange={(e) => {
                      const v = e.target.value;
                      setFormData({ ...formData, cpf: v });
                      if (cpfError) {
                        // Revalida dinamicamente se já havia erro
                        validateCPF(v);
                      }
                    }}
                    onBlur={(e) => validateCPF(e.target.value)}
                    className={cpfError ? 'border-red-500 focus-visible:ring-red-500' : ''}
                  />
                  {cpfError && (
                    <p className="text-red-500 text-xs">{cpfError}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">Endereço de Entrega</Label>
                  <Input
                    id="address"
                    type="text"
                    placeholder="Rua, número, bairro, cidade"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  
                </div>
                <div className="space-y-2">
                  <Label>RG (frente/verso ou PDF)</Label>
                  <input
                    ref={rgInputRef}
                    type="file"
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={(e) => setRgFile(e.target.files && e.target.files[0] ? e.target.files[0] : null)}
                  />
                  <Button type="button" variant="outline" onClick={() => rgInputRef.current?.click()} className="w-full">
                    {rgFile ? `Selecionado: ${rgFile.name}` : 'Enviar RG'}
                  </Button>
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                required
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
            </div>

            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar Senha</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  required={!isLogin}
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                />
              </div>
            )}

            <Button type="submit" variant="gold" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isLogin ? 'Entrar' : 'Criar Conta'}
            </Button>

            <div className="text-center">
              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="text-sm text-muted-foreground hover:text-accent transition-colors"
              >
                {isLogin ? 'Não tem conta? Cadastre-se' : 'Já tem conta? Faça login'}
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
