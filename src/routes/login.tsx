import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Stethoscope } from "lucide-react";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { signIn, signUp, isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const [submitting, setSubmitting] = useState(false);

  // Sign in
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Sign up
  const [suEmail, setSuEmail] = useState("");
  const [suPassword, setSuPassword] = useState("");
  const [suNome, setSuNome] = useState("");
  const [suCognome, setSuCognome] = useState("");

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      void navigate({ to: "/dashboard" });
    }
  }, [isAuthenticated, isLoading, navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await signIn(email, password);
      toast.success("Accesso effettuato");
      void navigate({ to: "/dashboard" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Errore accesso";
      toast.error(
        msg.includes("Invalid login credentials") ? "Email o password non validi" : msg,
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await signUp(suEmail, suPassword, suNome, suCognome);
      toast.success("Account creato. Controlla la tua email per confermare.");
      setTab("signin");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Errore registrazione";
      toast.error(
        msg.includes("already registered") ? "Email già registrata" : msg,
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-6 flex items-center justify-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Stethoscope className="h-5 w-5" />
          </div>
          <span className="font-display text-xl font-semibold tracking-tight">
            Aesthetic Clinic Hub
          </span>
        </Link>

        <Card>
          <CardHeader>
            <CardTitle className="font-display text-2xl">Area riservata</CardTitle>
            <CardDescription>
              Accesso riservato al personale autorizzato dello studio.
              L'account amministratore viene creato dal medico responsabile in
              fase di attivazione.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={tab} onValueChange={(v) => setTab(v as "signin" | "signup")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Accedi</TabsTrigger>
                <TabsTrigger value="signup">Registrati</TabsTrigger>
              </TabsList>

              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="mt-4 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoComplete="email"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={submitting}>
                    {submitting ? "Accesso..." : "Accedi"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="mt-4 space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="su-nome">Nome</Label>
                      <Input
                        id="su-nome"
                        value={suNome}
                        onChange={(e) => setSuNome(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="su-cognome">Cognome</Label>
                      <Input
                        id="su-cognome"
                        value={suCognome}
                        onChange={(e) => setSuCognome(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="su-email">Email</Label>
                    <Input
                      id="su-email"
                      type="email"
                      value={suEmail}
                      onChange={(e) => setSuEmail(e.target.value)}
                      required
                      autoComplete="email"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="su-password">Password</Label>
                    <Input
                      id="su-password"
                      type="password"
                      value={suPassword}
                      onChange={(e) => setSuPassword(e.target.value)}
                      required
                      minLength={8}
                      autoComplete="new-password"
                    />
                    <p className="text-xs text-muted-foreground">
                      Minimo 8 caratteri.
                    </p>
                  </div>
                  <Button type="submit" className="w-full" disabled={submitting}>
                    {submitting ? "Registrazione..." : "Crea account"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
