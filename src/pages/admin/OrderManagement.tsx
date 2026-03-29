import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Eye } from "lucide-react";

const STATUSES = ["placed", "confirmed", "processing", "shipped", "out_for_delivery", "delivered", "cancelled"] as const;

export default function OrderManagement() {
  const [orders, setOrders] = useState<any[]>([]);
  const [filterStatus, setFilterStatus] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [trackingId, setTrackingId] = useState("");
  const [carrierName, setCarrierName] = useState("");
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchOrders = async () => {
    let query = supabase.from("orders").select("*");
    if (filterStatus !== "all") query = query.eq("status", filterStatus as any);
    if (sortBy === "price_asc") query = query.order("total_amount", { ascending: true });
    else if (sortBy === "price_desc") query = query.order("total_amount", { ascending: false });
    else query = query.order("created_at", { ascending: false });
    const { data } = await query;
    setOrders(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchOrders(); }, [filterStatus, sortBy]);

  const updateStatus = async (orderId: string, newStatus: string) => {
    const payload: any = { status: newStatus, updated_at: new Date().toISOString() };
    if (newStatus === "shipped") {
      payload.tracking_id = trackingId;
      payload.carrier_name = carrierName;
    }
    const { error } = await supabase.from("orders").update(payload).eq("id", orderId);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: `Order status updated to ${newStatus}` });
    fetchOrders();
    setSelectedOrder(null);
  };

  if (loading) return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-28" />
      <div className="flex flex-wrap gap-3">
        <Skeleton className="h-10 w-[180px]" />
        <Skeleton className="h-10 w-[180px]" />
      </div>
      <div className="rounded-md border p-4 space-y-3">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="flex items-center gap-4">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-8 w-8 ml-auto" />
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Orders</h1>
      <div className="flex flex-wrap gap-3">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {STATUSES.map(s => <SelectItem key={s} value={s} className="capitalize">{s.replace("_", " ")}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Sort" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest First</SelectItem>
            <SelectItem value="price_asc">Price: Low to High</SelectItem>
            <SelectItem value="price_desc">Price: High to Low</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order ID</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map(o => (
              <TableRow key={o.id}>
                <TableCell className="font-mono text-xs">{o.id.slice(0, 8)}</TableCell>
                <TableCell className="text-sm">{new Date(o.created_at).toLocaleDateString()}</TableCell>
                <TableCell>₹{Number(o.total_amount).toLocaleString()}</TableCell>
                <TableCell>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary capitalize">
                    {o.status.replace("_", " ")}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => setSelectedOrder(o)}>
                    <Eye className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {orders.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No orders found.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Order Details</DialogTitle></DialogHeader>
          {selectedOrder && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-muted-foreground">ID:</span> {selectedOrder.id.slice(0, 8)}</div>
                <div><span className="text-muted-foreground">Amount:</span> ₹{Number(selectedOrder.total_amount).toLocaleString()}</div>
                <div><span className="text-muted-foreground">Discount:</span> ₹{Number(selectedOrder.discount_amount).toLocaleString()}</div>
                <div><span className="text-muted-foreground">Shipping:</span> ₹{Number(selectedOrder.shipping_fee).toLocaleString()}</div>
                <div className="col-span-2"><span className="text-muted-foreground">Status:</span> <span className="capitalize">{selectedOrder.status.replace("_", " ")}</span></div>
                {selectedOrder.tracking_id && <div className="col-span-2"><span className="text-muted-foreground">Tracking:</span> {selectedOrder.tracking_id} ({selectedOrder.carrier_name})</div>}
              </div>
              {selectedOrder.status !== "delivered" && selectedOrder.status !== "cancelled" && (
                <div className="space-y-3 pt-2 border-t">
                  <Label>Update Status</Label>
                  {selectedOrder.status === "processing" || selectedOrder.status === "confirmed" ? (
                    <div className="space-y-2">
                      <Input placeholder="Tracking ID" value={trackingId} onChange={e => setTrackingId(e.target.value)} />
                      <Input placeholder="Carrier Name" value={carrierName} onChange={e => setCarrierName(e.target.value)} />
                    </div>
                  ) : null}
                  <div className="flex gap-2 flex-wrap">
                    {STATUSES.filter(s => s !== "cancelled").map((s, i) => {
                      const currentIdx = STATUSES.indexOf(selectedOrder.status as typeof STATUSES[number]);
                      if (i !== currentIdx + 1) return null;
                      return (
                        <Button key={s} size="sm" onClick={() => updateStatus(selectedOrder.id, s)} className="capitalize">
                          Mark as {s.replace("_", " ")}
                        </Button>
                      );
                    })}
                    {(selectedOrder.status === "confirmed" || selectedOrder.status === "processing") && (
                      <Button size="sm" variant="destructive" onClick={() => updateStatus(selectedOrder.id, "cancelled")}>
                        Cancel Order
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
