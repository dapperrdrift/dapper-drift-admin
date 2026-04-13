import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Search } from "lucide-react";
import { AdminTablePagination } from "@/components/AdminTablePagination";

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

const PAGE_SIZE = 10;

export default function InventoryManagement() {
  const [variants, setVariants] = useState<Variant[]>([]);
  const [adjustments, setAdjustments] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterSize, setFilterSize] = useState("all");
  const [filterColor, setFilterColor] = useState("all");
  const [sortStock, setSortStock] = useState("default");
  const [sizes, setSizes] = useState<string[]>([]);
  const [colors, setColors] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);

    return () => clearTimeout(timer);
  }, [search]);

  const fetchFilterOptions = useCallback(async () => {
    const { data, error } = await supabase.from("variants").select("size, color");
    if (error) {
      toast({ title: "Failed to load filters", description: error.message, variant: "destructive" });
      return;
    }

    const uniqueSizes = [...new Set((data || []).map((item) => item.size).filter(Boolean))] as string[];
    const uniqueColors = [...new Set((data || []).map((item) => item.color).filter(Boolean))] as string[];
    setSizes(uniqueSizes);
    setColors(uniqueColors);
  }, [toast]);

  const fetchVariants = useCallback(async () => {
    let query = supabase
      .from("variants")
      .select("id, product_id, size, color, sku, stock_quantity, low_stock_threshold, products(name)", { count: "exact" });

    if (filterSize !== "all") query = query.eq("size", filterSize);
    if (filterColor !== "all") query = query.eq("color", filterColor);

    if (debouncedSearch) {
      const term = debouncedSearch.replace(/,/g, " ");
      const { data: matchingProducts } = await supabase
        .from("products")
        .select("id")
        .ilike("name", `%${term}%`)
        .limit(250);

      const matchingProductIds = (matchingProducts || []).map((product) => product.id);
      const searchConditions = [`sku.ilike.%${term}%`, `size.ilike.%${term}%`, `color.ilike.%${term}%`];

      if (matchingProductIds.length > 0) {
        searchConditions.push(`product_id.in.(${matchingProductIds.join(",")})`);
      }

      query = query.or(searchConditions.join(","));
    }

    if (sortStock === "low") query = query.order("stock_quantity", { ascending: true });
    else if (sortStock === "high") query = query.order("stock_quantity", { ascending: false });
    else query = query.order("created_at", { ascending: false });

    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data, error, count } = await query.range(from, to);
    if (error) {
      toast({ title: "Failed to load inventory", description: error.message, variant: "destructive" });
      setVariants([]);
      setTotalCount(0);
      setLoading(false);
      return;
    }

    const enriched = (data || []).map((variant: Variant & { products?: { name: string } }) => ({
      ...variant,
      product_name: variant.products?.name || "Unknown",
    }));
    setVariants(enriched);
    setTotalCount(count || 0);
    setLoading(false);
  }, [debouncedSearch, filterColor, filterSize, page, sortStock, toast]);

  useEffect(() => {
    fetchFilterOptions();
  }, [fetchFilterOptions]);

  useEffect(() => {
    fetchVariants();
  }, [fetchVariants]);

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

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

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
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="pl-9"
            placeholder="Search SKU, product, size, or color..."
          />
        </div>

        <Select
          value={filterSize}
          onValueChange={(value) => {
            setFilterSize(value);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Size" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sizes</SelectItem>
            {sizes.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select
          value={filterColor}
          onValueChange={(value) => {
            setFilterColor(value);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Color" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Colors</SelectItem>
            {colors.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select
          value={sortStock}
          onValueChange={(value) => {
            setSortStock(value);
            setPage(1);
          }}
        >
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
            {variants.map(v => (
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
            {variants.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No variants found.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>

        <AdminTablePagination page={page} totalPages={totalPages} onPageChange={setPage} />
      </div>
    </div>
  );
}
