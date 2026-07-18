import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { AdminTablePagination } from "@/components/AdminTablePagination";
import { Plus, Search, Pencil, Archive, Trash2, Package, Tag, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Product {
  id: string;
  name: string;
  description: string | null;
  category_id: string | null;
  base_price: number;
  images: string[] | null;
  is_active: boolean;
  brand: string | null;
  tags: string[] | null;
  status: string | null;
  created_at: string;
}

interface Category { id: string; name: string }

const PAGE_SIZE = 15;

function StatusBadge({ product }: { product: Product }) {
  const status = product.status || (product.is_active ? "active" : "draft");
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full",
      status === "active" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
        : status === "archived" ? "bg-orange-100 text-orange-700"
        : "bg-muted text-muted-foreground"
    )}>
      <span className={cn("w-1.5 h-1.5 rounded-full",
        status === "active" ? "bg-emerald-500" : status === "archived" ? "bg-orange-400" : "bg-muted-foreground/50"
      )} />
      {status === "active" ? "Active" : status === "archived" ? "Archived" : "Draft"}
    </span>
  );
}

export default function ProductManagement() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [variantCounts, setVariantCounts] = useState<Record<string, number>>({});

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkActing, setBulkActing] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search.trim()); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    supabase.from("categories").select("id, name").then(({ data }) => setCategories(data || []));
  }, []);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    let query = supabase.from("products").select("*", { count: "exact" });

    if (filterCategory !== "all") query = query.eq("category_id", filterCategory);
    if (filterStatus === "active") query = query.eq("is_active", true);
    else if (filterStatus === "draft") query = query.eq("is_active", false);

    if (debouncedSearch) query = query.ilike("name", `%${debouncedSearch}%`);
    if (sortBy === "price_asc") query = query.order("base_price", { ascending: true });
    else if (sortBy === "price_desc") query = query.order("base_price", { ascending: false });
    else if (sortBy === "name") query = query.order("name", { ascending: true });
    else query = query.order("created_at", { ascending: false });
    query = query.order("id", { ascending: true });

    const from = (page - 1) * PAGE_SIZE;
    const { data, error, count } = await query.range(from, from + PAGE_SIZE - 1);

    if (error) {
      toast({ title: "Failed to load products", description: error.message, variant: "destructive" });
      setProducts([]); setTotalCount(0); setLoading(false); return;
    }

    setProducts((data || []) as Product[]);
    setTotalCount(count || 0);

    // Fetch variant counts
    if (data && data.length > 0) {
      const ids = data.map(p => p.id);
      const { data: varData } = await supabase
        .from("variants")
        .select("product_id")
        .in("product_id", ids);
      const counts: Record<string, number> = {};
      for (const id of ids) counts[id] = 0;
      for (const v of varData || []) counts[v.product_id] = (counts[v.product_id] || 0) + 1;
      setVariantCounts(counts);
    }

    setLoading(false);
  }, [debouncedSearch, filterCategory, filterStatus, page, sortBy, toast]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);
  useEffect(() => { setSelectedIds(new Set()); }, [page, filterCategory, filterStatus, sortBy, debouncedSearch]);

  const handleArchive = async (id: string, name: string) => {
    const { error } = await supabase.from("products").update({ is_active: false, status: "archived" }).eq("id", id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: `"${name}" archived` });
    fetchProducts();
  };

  const handleHardDelete = async (id: string, name: string) => {
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: `"${name}" deleted permanently` });
    setSelectedIds(prev => { const next = new Set(prev); next.delete(id); return next; });
    fetchProducts();
  };

  const toggleSelected = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds(prev =>
      prev.size === products.length ? new Set() : new Set(products.map(p => p.id))
    );
  };

  const handleBulkArchive = async () => {
    setBulkActing(true);
    const ids = Array.from(selectedIds);
    const { error } = await supabase.from("products").update({ is_active: false, status: "archived" }).in("id", ids);
    setBulkActing(false);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: `${ids.length} product${ids.length !== 1 ? "s" : ""} archived` });
    setSelectedIds(new Set());
    fetchProducts();
  };

  const handleBulkDelete = async () => {
    setBulkActing(true);
    const ids = Array.from(selectedIds);
    const { error } = await supabase.from("products").delete().in("id", ids);
    setBulkActing(false);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: `${ids.length} product${ids.length !== 1 ? "s" : ""} deleted permanently` });
    setSelectedIds(new Set());
    fetchProducts();
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Products</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {loading ? "Loading..." : `${totalCount.toLocaleString()} product${totalCount !== 1 ? "s" : ""}`}
          </p>
        </div>
        <Button onClick={() => navigate("/admin/products/new")} className="gap-2 shrink-0">
          <Plus className="h-4 w-4" />
          Add product
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2.5">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search products..." className="pl-9 h-9" />
        </div>
        <Select value={filterCategory} onValueChange={v => { setFilterCategory(v); setPage(1); }}>
          <SelectTrigger className="w-[160px] h-9"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={v => { setFilterStatus(v); setPage(1); }}>
          <SelectTrigger className="w-[140px] h-9"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={v => { setSortBy(v); setPage(1); }}>
          <SelectTrigger className="w-[160px] h-9"><SelectValue placeholder="Sort" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest first</SelectItem>
            <SelectItem value="name">Name A–Z</SelectItem>
            <SelectItem value="price_asc">Price: Low to high</SelectItem>
            <SelectItem value="price_desc">Price: High to low</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 rounded-xl border bg-muted/40 px-4 py-2.5">
          <span className="text-sm font-medium">{selectedIds.size} selected</span>
          <div className="flex items-center gap-2 ml-auto">
            <Button variant="outline" size="sm" className="gap-1.5 h-8" disabled={bulkActing} onClick={handleBulkArchive}>
              <Archive className="h-3.5 w-3.5" /> Archive
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 h-8 text-destructive hover:text-destructive" disabled={bulkActing}>
                  <Trash2 className="h-3.5 w-3.5" /> Delete permanently
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete {selectedIds.size} product{selectedIds.size !== 1 ? "s" : ""} permanently?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This cannot be undone. All variants and images for the selected products will be permanently removed.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleBulkDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Delete permanently
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedIds(new Set())}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
        {/* Table header */}
        <div className="grid items-center px-5 py-2.5 border-b bg-muted/30 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground select-none"
          style={{ gridTemplateColumns: "1.75rem 2.5rem 1fr 9rem 6rem 7rem 6rem 5rem" }}>
          <Checkbox
            checked={products.length > 0 && selectedIds.size === products.length}
            onCheckedChange={toggleSelectAll}
            aria-label="Select all"
          />
          <span />
          <span>Product</span>
          <span>Category</span>
          <span>Price</span>
          <span>Variants</span>
          <span>Status</span>
          <span className="text-right">Actions</span>
        </div>

        {loading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-10 w-10 rounded-lg shrink-0" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-7 w-16 rounded-lg" />
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="py-16 flex flex-col items-center gap-3 text-center">
            <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
              <Package className="h-6 w-6 text-muted-foreground/50" />
            </div>
            <div>
              <p className="font-medium text-sm">No products found</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {debouncedSearch ? `No results for "${debouncedSearch}"` : "Get started by adding your first product"}
              </p>
            </div>
            {!debouncedSearch && (
              <Button size="sm" onClick={() => navigate("/admin/products/new")} className="gap-1.5 mt-1">
                <Plus className="h-3.5 w-3.5" /> Add product
              </Button>
            )}
          </div>
        ) : (
          <>
            {products.map(p => {
              const catName = categories.find(c => c.id === p.category_id)?.name;
              const varCount = variantCounts[p.id] ?? 0;
              return (
                <div key={p.id}
                  className="grid items-center px-5 py-3 border-b last:border-b-0 hover:bg-muted/20 transition-colors group"
                  style={{ gridTemplateColumns: "1.75rem 2.5rem 1fr 9rem 6rem 7rem 6rem 5rem" }}>
                  <Checkbox
                    checked={selectedIds.has(p.id)}
                    onCheckedChange={() => toggleSelected(p.id)}
                    aria-label={`Select ${p.name}`}
                  />
                  {/* Thumbnail */}
                  <div className="w-9 h-9 rounded-lg overflow-hidden border bg-muted/30 shrink-0">
                    {p.images?.[0]
                      ? <img src={p.images[0]} alt="" className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center"><Package className="h-4 w-4 text-muted-foreground/30" /></div>
                    }
                  </div>

                  {/* Name + brand + tags */}
                  <div className="min-w-0 pr-3">
                    <button
                      type="button"
                      onClick={() => navigate(`/admin/products/${p.id}`)}
                      className="font-medium text-sm text-foreground hover:text-primary transition-colors truncate block max-w-full text-left"
                    >
                      {p.name}
                    </button>
                    <div className="flex items-center gap-2 mt-0.5">
                      {p.brand && <span className="text-xs text-muted-foreground truncate">{p.brand}</span>}
                      {p.tags && p.tags.length > 0 && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground/70">
                          <Tag className="h-2.5 w-2.5" />{p.tags.slice(0, 2).join(", ")}{p.tags.length > 2 ? ` +${p.tags.length - 2}` : ""}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Category */}
                  <span className="text-xs text-muted-foreground truncate pr-2">{catName ?? <span className="opacity-40">—</span>}</span>

                  {/* Price */}
                  <span className="text-sm font-medium tabular-nums">₹{Number(p.base_price).toLocaleString("en-IN")}</span>

                  {/* Variant count */}
                  <span>
                    {varCount > 0
                      ? <span className="inline-flex items-center gap-1 text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full font-medium">
                          {varCount} variant{varCount !== 1 ? "s" : ""}
                        </span>
                      : <span className="text-xs text-muted-foreground/40">—</span>
                    }
                  </span>

                  {/* Status */}
                  <StatusBadge product={p} />

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => navigate(`/admin/products/${p.id}`)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    {p.status !== "archived" && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                            title="Archive">
                            <Archive className="h-3.5 w-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Archive "{p.name}"?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will hide the product from your store. You can reactivate it anytime from the product editor.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleArchive(p.id, p.name)}>Archive</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                          title="Delete permanently">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete "{p.name}" permanently?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This cannot be undone. All variants and images for this product will be permanently removed.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleHardDelete(p.id, p.name)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Delete permanently
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              );
            })}
          </>
        )}

        <AdminTablePagination page={page} totalPages={totalPages} onPageChange={setPage} />
      </div>
    </div>
  );
}
