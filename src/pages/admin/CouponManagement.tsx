import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { AdminTablePagination } from "@/components/AdminTablePagination";

interface Coupon {
  id: string;
  code: string;
  discount_type: string;
  discount_value: number;
  min_order_value: number;
  expiry_date: string | null;
  usage_limit: number;
  times_used: number;
  is_active: boolean;
}

const PAGE_SIZE = 10;

export default function CouponManagement() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Coupon | null>(null);
  const [form, setForm] = useState({ code: "", discount_type: "flat", discount_value: 0, min_order_value: 0, expiry_date: "", usage_limit: 0 });
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchCoupons = useCallback(async () => {
    setLoading(true);
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data, error, count } = await supabase
      .from("coupons")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) {
      toast({ title: "Failed to load coupons", description: error.message, variant: "destructive" });
      setCoupons([]);
      setTotalCount(0);
      setLoading(false);
      return;
    }

    setCoupons(data || []);
    setTotalCount(count || 0);
    setLoading(false);
  }, [page, toast]);

  useEffect(() => { fetchCoupons(); }, [fetchCoupons]);

  const openCreate = () => {
    setEditing(null);
    setForm({ code: "", discount_type: "flat", discount_value: 0, min_order_value: 0, expiry_date: "", usage_limit: 0 });
    setDialogOpen(true);
  };

  const openEdit = (c: Coupon) => {
    setEditing(c);
    setForm({
      code: c.code,
      discount_type: c.discount_type,
      discount_value: c.discount_value,
      min_order_value: c.min_order_value,
      expiry_date: c.expiry_date ? c.expiry_date.split("T")[0] : "",
      usage_limit: c.usage_limit,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const payload = {
      code: form.code.toUpperCase(),
      discount_type: form.discount_type,
      discount_value: form.discount_value,
      min_order_value: form.min_order_value,
      expiry_date: form.expiry_date || null,
      usage_limit: form.usage_limit,
    };
    if (editing) {
      await supabase.from("coupons").update(payload).eq("id", editing.id);
      toast({ title: "Coupon updated" });
    } else {
      await supabase.from("coupons").insert(payload);
      toast({ title: "Coupon created" });
    }
    setDialogOpen(false);
    fetchCoupons();
  };

  const toggleActive = async (c: Coupon) => {
    await supabase.from("coupons").update({ is_active: !c.is_active }).eq("id", c.id);
    fetchCoupons();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("coupons").delete().eq("id", id);
    toast({ title: "Coupon deleted" });
    if (coupons.length === 1 && page > 1) {
      setPage((prev) => prev - 1);
    } else {
      fetchCoupons();
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  if (loading) return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="rounded-md border p-4 space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex items-center gap-4">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-5 w-12" />
            <Skeleton className="h-6 w-10" />
            <Skeleton className="h-8 w-20 ml-auto" />
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Coupons</h1>
        <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Add Coupon</Button>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Discount</TableHead>
              <TableHead>Min Order</TableHead>
              <TableHead>Usage</TableHead>
              <TableHead>Active</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {coupons.map(c => (
              <TableRow key={c.id}>
                <TableCell className="font-mono font-bold">{c.code}</TableCell>
                <TableCell>{c.discount_type === "percentage" ? `${c.discount_value}%` : `₹${c.discount_value}`}</TableCell>
                <TableCell>₹{c.min_order_value}</TableCell>
                <TableCell>{c.times_used}/{c.usage_limit || "∞"}</TableCell>
                <TableCell><Switch checked={c.is_active} onCheckedChange={() => toggleActive(c)} /></TableCell>
                <TableCell className="text-right space-x-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild><Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive" /></Button></AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete coupon?</AlertDialogTitle>
                        <AlertDialogDescription>This will permanently delete coupon "{c.code}".</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(c.id)}>Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </TableCell>
              </TableRow>
            ))}
            {coupons.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No coupons found.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>

        <AdminTablePagination page={page} totalPages={totalPages} onPageChange={setPage} />
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit Coupon" : "Add Coupon"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Code</Label><Input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <select className="w-full border rounded-md p-2 text-sm" value={form.discount_type} onChange={e => setForm({ ...form, discount_type: e.target.value })}>
                  <option value="flat">Flat (₹)</option>
                  <option value="percentage">Percentage (%)</option>
                </select>
              </div>
              <div className="space-y-2"><Label>Value</Label><Input type="number" value={form.discount_value} onChange={e => setForm({ ...form, discount_value: Number(e.target.value) })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Min Order (₹)</Label><Input type="number" value={form.min_order_value} onChange={e => setForm({ ...form, min_order_value: Number(e.target.value) })} /></div>
              <div className="space-y-2"><Label>Usage Limit</Label><Input type="number" value={form.usage_limit} onChange={e => setForm({ ...form, usage_limit: Number(e.target.value) })} /></div>
            </div>
            <div className="space-y-2"><Label>Expiry Date</Label><Input type="date" value={form.expiry_date} onChange={e => setForm({ ...form, expiry_date: e.target.value })} /></div>
            <Button className="w-full" onClick={handleSave}>{editing ? "Update" : "Create"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
