import { Link, useNavigate } from "react-router-dom";
import { Button } from "./ui/button";
import { ShoppingCart, User, LogOut, Menu } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User as SupabaseUser } from "@supabase/supabase-js";
import { Sheet, SheetContent, SheetTrigger } from "./ui/sheet";

interface NavbarProps {
  cartItemsCount?: number;
}

export const Navbar = ({ cartItemsCount = 0 }: NavbarProps) => {
  const navigate = useNavigate();
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        checkAdminRole(session.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        checkAdminRole(session.user.id);
      } else {
        setIsAdmin(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkAdminRole = async (userId: string) => {
    const { data } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'admin')
      .single();
    
    setIsAdmin(!!data);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  return (
    <nav className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center space-x-2">
            <h1 className="text-2xl font-bold bg-gradient-gold bg-clip-text text-transparent">
              ReisImportsClub
            </h1>
          </Link>

          {/* Desktop actions */}
          <div className="hidden md:flex items-center gap-4">
            {user ? (
              <>
                {isAdmin && (
                  <>
                    <div className="relative group">
                      <Button variant="ghost" onClick={() => navigate('/admin')}>
                        Admin
                      </Button>
                      <div className="absolute right-0 top-full min-w-[220px] rounded-md border bg-popover text-popover-foreground shadow-md z-50 hidden group-hover:block">
                        <Link to="/admin" className="block px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground">
                          Painel
                        </Link>
                        <Link to="/admin/clientes" className="block px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground">
                          Clientes
                        </Link>
                        <Link to="/admin/produtos" className="block px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground">
                          Produtos
                        </Link>
                        <Link to="/admin/financas" className="block px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground">
                          Finanças
                        </Link>
                      </div>
                    </div>
                    <div className="relative group">
                      <Button variant="ghost" onClick={() => navigate('/admin/financas')}>
                        Finanças
                      </Button>
                      <div className="absolute right-0 top-full min-w-[220px] rounded-md border bg-popover text-popover-foreground shadow-md z-50 hidden group-hover:block">
                        <Link to="/admin/financas" className="block px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground">
                          Resumo
                        </Link>
                        <Link to="/admin/financas/itens-mais-vendidos" className="block px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground">
                          Itens mais vendidos
                        </Link>
                      </div>
                    </div>
                  </>
                )}
                <Button variant="ghost" onClick={() => navigate('/orders')}>
                  Meus Pedidos
                </Button>
                <Button variant="ghost" onClick={() => navigate('/cart')} className="relative">
                  <ShoppingCart className="h-5 w-5 text-black" />
                  {cartItemsCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-accent text-accent-foreground rounded-full w-5 h-5 text-xs flex items-center justify-center">
                      {cartItemsCount}
                    </span>
                  )}
                </Button>
                <Button variant="ghost" onClick={handleLogout}>
                  <LogOut className="h-5 w-5 mr-2" />
                  Sair
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" onClick={() => navigate('/cart')} className="relative">
                  <ShoppingCart className="h-5 w-5 text-black" />
                  {cartItemsCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-accent text-accent-foreground rounded-full w-5 h-5 text-xs flex items-center justify-center">
                      {cartItemsCount}
                    </span>
                  )}
                </Button>
                <Button variant="premium" onClick={() => navigate('/auth')}>
                  <User className="h-5 w-5 mr-2" />
                  Entrar
                </Button>
              </>
            )}
          </div>

          {/* Mobile menu */}
          <div className="md:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Abrir menu">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right">
                <div className="space-y-4">
                  <Link to="/" className="block text-lg font-bold">ReisImportsClub</Link>
                  {user ? (
                    <>
                      {isAdmin && (
                        <div className="space-y-2">
                          <Button variant="ghost" className="w-full justify-start" onClick={() => navigate('/admin')}>Admin</Button>
                          <Button variant="ghost" className="w-full justify-start" onClick={() => navigate('/admin/financas')}>Finanças</Button>
                          <Link to="/admin/financas" className="block text-sm text-muted-foreground">Resumo</Link>
                          <Link to="/admin/financas/itens-mais-vendidos" className="block text-sm text-muted-foreground">Itens mais vendidos</Link>
                          <Button variant="ghost" className="w-full justify-start" onClick={() => navigate('/admin/clientes')}>Clientes</Button>
                        </div>
                      )}
                      <Button variant="ghost" className="w-full justify-start" onClick={() => navigate('/orders')}>Meus Pedidos</Button>
                      <Button variant="ghost" className="w-full justify-start relative" onClick={() => navigate('/cart')}>
                        <ShoppingCart className="h-5 w-5 mr-2" /> Carrinho
                        {cartItemsCount > 0 && (
                          <span className="absolute top-1 right-2 bg-accent text-accent-foreground rounded-full w-5 h-5 text-xs flex items-center justify-center">
                            {cartItemsCount}
                          </span>
                        )}
                      </Button>
                      <Button variant="ghost" className="w-full justify-start" onClick={handleLogout}>
                        <LogOut className="h-5 w-5 mr-2" /> Sair
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button variant="ghost" className="w-full justify-start relative" onClick={() => navigate('/cart')}>
                        <ShoppingCart className="h-5 w-5 mr-2" /> Carrinho
                        {cartItemsCount > 0 && (
                          <span className="absolute top-1 right-2 bg-accent text-accent-foreground rounded-full w-5 h-5 text-xs flex items-center justify-center">
                            {cartItemsCount}
                          </span>
                        )}
                      </Button>
                      <Button variant="premium" className="w-full justify-start" onClick={() => navigate('/auth')}>
                        <User className="h-5 w-5 mr-2" /> Entrar
                      </Button>
                    </>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </nav>
  );
};
