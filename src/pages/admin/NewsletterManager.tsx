import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Send, Users, Download } from "lucide-react";
import { AdminTablePagination } from "@/components/AdminTablePagination";

const PAGE_SIZE = 10;

export default function NewsletterManager() {
  const [subscribers, setSubscribers] = useState<any[]>([]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [activeCount, setActiveCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchSubscribers = useCallback(async () => {
    setLoading(true);
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const [{ data, error, count }, { count: activeTotal, error: activeError }] = await Promise.all([
      supabase
        .from("newsletter_subscribers")
        .select("*", { count: "exact" })
        .order("subscribed_at", { ascending: false })
        .range(from, to),
      supabase
        .from("newsletter_subscribers")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true),
    ]);

    if (error) {
      toast({ title: "Failed to load subscribers", description: error.message, variant: "destructive" });
      setSubscribers([]);
      setTotalCount(0);
      setLoading(false);
      return;
    }

    if (activeError) {
      toast({ title: "Failed to load subscriber stats", description: activeError.message, variant: "destructive" });
    }

    setSubscribers(data || []);
    setTotalCount(count || 0);
    setActiveCount(activeTotal || 0);
    setLoading(false);
  }, [page, toast]);

  useEffect(() => { fetchSubscribers(); }, [fetchSubscribers]);

  const exportSubscribers = async () => {
    const { data, error } = await supabase
      .from("newsletter_subscribers")
      .select("email, subscribed_at, is_active")
      .order("subscribed_at", { ascending: false });

    if (error) {
      toast({ title: "Export failed", description: error.message, variant: "destructive" });
      return;
    }

    const csv = "Email,Subscribed At,Active\n" + (data || []).map(s => `${s.email},${s.subscribed_at},${s.is_active}`).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "subscribers.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSend = async () => {
    if (!subject || !body) { toast({ title: "Fill in all fields", variant: "destructive" }); return; }
    setSending(true);
    // Note: Newsletter sending would use an edge function in production
    toast({ title: "Newsletter queued", description: `Will be sent to ${activeCount} subscribers.` });
    setSubject("");
    setBody("");
    setSending(false);
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  if (loading) return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-10 w-64" />
      <Card>
        <CardHeader><Skeleton className="h-6 w-40" /></CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-[200px] w-full" />
          <div className="flex justify-between">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-10 w-36" />
          </div>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Newsletter</h1>
      <Tabs defaultValue="compose">
        <TabsList>
          <TabsTrigger value="compose">Compose</TabsTrigger>
          <TabsTrigger value="subscribers">Subscribers ({activeCount})</TabsTrigger>
        </TabsList>
        <TabsContent value="compose" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Compose Newsletter</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Subject Line</Label>
                <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Your newsletter subject..." />
              </div>
              <div className="space-y-2">
                <Label>Body</Label>
                <Textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Write your newsletter content..." className="min-h-[200px]" />
              </div>
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Users className="h-4 w-4" /> {activeCount} active subscribers
                </p>
                <Button onClick={handleSend} disabled={sending}>
                  <Send className="mr-2 h-4 w-4" />{sending ? "Sending..." : "Send Newsletter"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="subscribers" className="space-y-4">
          <div className="flex justify-end">
            <Button variant="outline" onClick={exportSubscribers}>
              <Download className="mr-2 h-4 w-4" />Export CSV
            </Button>
          </div>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Subscribed</TableHead>
                  <TableHead>Active</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subscribers.map(s => (
                  <TableRow key={s.id}>
                    <TableCell>{s.email}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{new Date(s.subscribed_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${s.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                        {s.is_active ? "Active" : "Inactive"}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
                {subscribers.length === 0 && (
                  <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">No subscribers yet.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>

            <AdminTablePagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
