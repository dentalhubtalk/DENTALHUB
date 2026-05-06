import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck, Loader2, Megaphone, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PushSubscribeCard } from "@/components/admin/PushSubscribeCard";
import { useAuth } from "@/hooks/use-auth";
import { formatDateTimeBR } from "@/lib/date-format";
import { cn } from "@/lib/utils";
import {
  enviarComunicado,
  listAdminUserOptions,
  listNotificacoes,
  marcarComoLida,
} from "@/utils/notificacoes.functions";

export const Route = createFileRoute("/_authenticated/admin/notificacoes")({
  component: AdminNotificacoesPage,
});

type Notificacao = {
  id: string;
  titulo: string;
  mensagem: string;
  tipo: "info" | "sucesso" | "aviso" | "erro";
  lida: boolean;
  audiencia: "cliente" | "admin";
  created_at: string;
};

const tipoStyle: Record<Notificacao["tipo"], string> = {
  info: "bg-primary/10 text-primary",
  sucesso: "bg-accent/10 text-accent",
  aviso: "bg-secondary text-secondary-foreground",
  erro: "bg-destructive/10 text-destructive",
};

function AdminNotificacoesPage() {
  const { session } = useAuth();
  const accessToken = session?.access_token ?? "";
  const queryClient = useQueryClient();
  const [titulo, setTitulo] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [sending, setSending] = useState(false);
  const [destino, setDestino] = useState<"todos" | "um">("todos");
  const [selectedUserId, setSelectedUserId] = useState<string>("");

  const { data, isLoading } = useQuery({
    queryKey: ["notificacoes", "admin-page"],
    enabled: !!accessToken,
    queryFn: () => listNotificacoes({ data: { accessToken, limit: 100 } }),
  });

  const { data: usersData } = useQuery({
    queryKey: ["admin", "user-options"],
    enabled: !!accessToken,
    queryFn: () => listAdminUserOptions({ data: { accessToken } }),
  });
  const usuarios = usersData?.usuarios ?? [];

  const notificacoes = (data?.notificacoes ?? []) as Notificacao[];
  const naoLidas = useMemo(() => notificacoes.filter((n) => !n.lida).length, [notificacoes]);

  const markAll = async () => {
    if (!accessToken || naoLidas === 0) return;
    await marcarComoLida({ data: { accessToken } });
    await queryClient.invalidateQueries({ queryKey: ["notificacoes"] });
  };

  const sendComunicado = async () => {
    if (!accessToken || sending) return;
    if (destino === "um" && !selectedUserId) {
      toast.error("Selecione o destinatário");
      return;
    }
    setSending(true);
    try {
      const result = await enviarComunicado({
        data: {
          accessToken,
          titulo,
          mensagem,
          userIds: destino === "um" ? [selectedUserId] : undefined,
        },
      });
      setTitulo("");
      setMensagem("");
      toast.success(`Comunicado enviado para ${result.usuarios ?? 0} usuário(s)`);
      await queryClient.invalidateQueries({ queryKey: ["notificacoes"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao enviar comunicado");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Notificações</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Alertas preparados: desconexão de WhatsApp, nova assinatura e testes de push admin.
          </p>
        </div>
        <Button variant="outline" onClick={markAll} disabled={naoLidas === 0} className="gap-2 self-start sm:self-auto">
          <CheckCheck className="h-4 w-4" />
          Marcar todas como lidas
        </Button>
      </div>

      <PushSubscribeCard />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Megaphone className="h-5 w-5 text-primary" />
            Enviar comunicado aos usuários
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label className="text-sm">Destinatário</Label>
            <RadioGroup
              value={destino}
              onValueChange={(v) => setDestino(v as "todos" | "um")}
              className="flex flex-wrap gap-4"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="todos" id="dest-todos" />
                <Label htmlFor="dest-todos" className="font-normal">Todos os usuários</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="um" id="dest-um" />
                <Label htmlFor="dest-um" className="font-normal">Usuário específico</Label>
              </div>
            </RadioGroup>
            {destino === "um" && (
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um usuário" />
                </SelectTrigger>
                <SelectContent>
                  {usuarios.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.nome} {u.email ? `· ${u.email}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título do comunicado" maxLength={120} />
          <Textarea value={mensagem} onChange={(e) => setMensagem(e.target.value)} placeholder="Mensagem" rows={4} maxLength={1000} />
          <Button onClick={sendComunicado} disabled={sending || titulo.trim().length < 3 || mensagem.trim().length < 3} className="gap-2">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Enviar comunicado
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Bell className="h-5 w-5 text-primary" />
            Histórico de notificações
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : notificacoes.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Nenhuma notificação registrada ainda.</p>
          ) : (
            <div className="space-y-3">
              {notificacoes.map((n) => (
                <div key={n.id} className={cn("rounded-lg border p-4", !n.lida && "bg-primary/5")}>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className={tipoStyle[n.tipo]}>{n.tipo}</Badge>
                        {!n.lida && <Badge variant="secondary">nova</Badge>}
                      </div>
                      <p className="mt-2 font-medium text-foreground">{n.titulo}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{n.mensagem}</p>
                    </div>
                    <p className="shrink-0 text-xs text-muted-foreground">{formatDateTimeBR(n.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}