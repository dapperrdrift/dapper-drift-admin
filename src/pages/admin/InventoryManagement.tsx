import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

interface Variant {
  id: string;
  product_id: string;
  size: string;
  color: string;
  sku: string;
  stock_quantity: number;
  low_stock_threshold: number;
  product_name?: string;
}

export default function InventoryManagement() {
  const [variants, setVariants] = useState<Variant[]>([]);
  const [adjustments, setAdjustments] = useState<Record<string, string>>({});
  const [filterSize, setFilterSize] = useState("all");
  const [filterColor, setFilterColor] = useState("all");
  const [sortStock, setSortStock] = useState("default");
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();

  const fetchVariants = async () => {
    const { data: variantsData } = await supabase.from("variants").select("*");
    const { data: productsData } = await supabase.from("products").select("id, name");
    const productMap = Object.fromEntries((productsData || []).map(p => [p.id, p.name]));
    const enriched = (variantsData || []).map(v => ({ ...v, product_name: productMap[v.product_id] || "Unknown" }));
    setVariants(enriched);
    setLoading(false);
  };

  useEffect(() => { fetchVariants(); }, []);

  const adjustStock = async (v: Variant) => {
    const adj = parseInt(adjustments[v.id] || "0");
    if (isNaN(adj) || adj === 0) return;
    const newQty = v.stock_quantity + adj;
    if (newQty < 0) { toast({ title: "Cannot go below 0", variant: "destructive" }); return; }
    await supabase.from("variants").update({ stock_quantity: newQty }).eq("id", v.id);
    await supabase.from("stock_audit_log").insert({
      variant_id: v.id,
      admin_id: user?.id,
      prev_qty: v.stock_quantity,
      new_qty: newQty,
      reason: adj > 0 ? "Manual increase" : "Manual decrease",
    });
    setAdjustments(prev => ({ ...prev, [v.id]: "" }));
    toast({ title: `Stock updated to ${newQty}` });
    fetchVariants();
  };

  let filtered = variants;
  if (filterSize !== "all") filtered = filtered.filter(v => v.size === filterSize);
  if (filterColor !== "all") filtered = filtered.filter(v => v.color === filterColor);
  if (sortStock === "low") filtered = [...filtered].sort((a, b) => a.stock_quantity - b.stock_quantity);
  if (sortStock === "high") filtered = [...filtered].sort((a, b) => b.stock_quantity - a.stock_quantity);

  const sizes = [...new Set(variants.map(v => v.size))];
  const colors = [...new Set(variants.map(v => v.color))];

  if (loading) return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-32" />
      <div className="flex flex-wrap gap-3">
        <Skeleton className="h-10 w-[150px]" />
        <Skeleton className="h-10 w-[150px]" />
        <Skeleton className="h-10 w-[180px]" />
      </div>
      <div className="rounded-md border p-4 space-y-3">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="flex items-center gap-4">
            <Skeleton className="h-5 flex-1" />
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-5 w-12" />
            <Skeleton className="h-5 w-12" />
            <Skeleton className="h-5 w-10" />
            <Skeleton className="h-8 w-28" />
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Inventory</h1>
      <div className="flex flex-wrap gap-3">
        <Select value={filterSize} onValueChange={setFilterSize}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Size" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sizes</SelectItem>
            {sizes.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterColor} onValueChange={setFilterColor}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Color" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Colors</SelectItem>
            {colors.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={sortStock} onValueChange={setSortStock}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Sort by stock" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="default">Default</SelectItem>
            <SelectItem value="low">Stock: Low to High</SelectItem>
            <SelectItem value="high">Stock: High to Low</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>Color</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead>Adjust</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(v => (
              <TableRow key={v.id} className={v.stock_quantity <= v.low_stock_threshold ? "bg-destructive/5" : ""}>
                <TableCell className="font-medium">{v.product_name}</TableCell>
                <TableCell className="text-muted-foreground text-xs">{v.sku}</TableCell>
                <TableCell>{v.size}</TableCell>
                <TableCell>{v.color}</TableCell>
                <TableCell>
                  <span className={v.stock_quantity <= v.low_stock_threshold ? "text-destructive font-bold" : ""}>
                    {v.stock_quantity}
                  </span>
                  {v.stock_quantity <= v.low_stock_threshold && <span className="ml-1 text-xs text-destructive">(Low)</span>}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      placeholder="+/-"
                      className="w-20 h-8 text-sm"
                      value={adjustments[v.id] || ""}
                      onChange={e => setAdjustments(prev => ({ ...prev, [v.id]: e.target.value }))}
                    />
                    <Button size="sm" variant="outline" onClick={() => adjustStock(v)}>Apply</Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No variants found.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
