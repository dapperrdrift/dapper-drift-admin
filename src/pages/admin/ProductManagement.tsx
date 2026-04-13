import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Search, Upload, X, Loader2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { uploadOptimizedImage } from "@/lib/optimizedUpload";
import { AdminTablePagination } from "@/components/AdminTablePagination";

interface Product {
  id: string;
  name: string;
  description: string | null;
  category_id: string | null;
  base_price: number;
  images: string[];
  is_active: boolean;
  created_at: string;
}

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface ProductVariantForm {
  id?: string;
  temp_id: string;
  size: string;
  color: string;
  sku: string;
  price_override: number | null;
  stock_quantity: number;
  low_stock_threshold: number;
  images: string[];
}

type VariantFieldKey = "size" | "color" | "sku" | "price_override" | "stock_quantity" | "low_stock_threshold";

const PAGE_SIZE = 10;
const VARIANT_FIELD_ORDER: VariantFieldKey[] = ["size", "color", "sku", "price_override", "stock_quantity", "low_stock_threshold"];
const SIZE_OPTIONS = ["XS", "S", "M", "L", "XL", "XXL", "Free Size", "28", "30", "32", "34", "36"];
const COLOR_OPTIONS = [
  "Black",
  "White",
  "Navy",
  "Blue",
  "Indigo",
  "Grey",
  "Brown",
  "Beige",
  "Olive",
  "Green",
  "Red",
  "Maroon",
  "Pink",
  "Purple",
  "Orange",
  "Yellow",
  "Gold",
  "Silver",
  "Multicolor",
];

function createEmptyVariant(): ProductVariantForm {
  return {
    temp_id: crypto.randomUUID(),
    size: "M",
    color: "Black",
    sku: "",
    price_override: null,
    stock_quantity: 0,
    low_stock_threshold: 5,
    images: [],
  };
}

function normalizeSkuPart(value: string, fallback: string): string {
  const normalized = value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || fallback;
}

function createVariantFromTemplate(template: ProductVariantForm, overrides?: Partial<ProductVariantForm>): ProductVariantForm {
  return {
    ...template,
    id: undefined,
    temp_id: crypto.randomUUID(),
    sku: "",
    images: [...template.images],
    ...(overrides || {}),
  };
}

function createSequentialVariant(template: ProductVariantForm): ProductVariantForm {
  return createVariantFromTemplate(template, {
    sku: "",
    images: [],
    stock_quantity: 0,
  });
}

export default function ProductManagement() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [variants, setVariants] = useState<ProductVariantForm[]>([createEmptyVariant()]);
  const [form, setForm] = useState({ name: "", description: "", category_id: "", base_price: 0, images: [] as string[] });
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dialogLoading, setDialogLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const variantFileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const variantFieldRefs = useRef<Record<string, Partial<Record<VariantFieldKey, HTMLElement | null>>>>({});
  const draggingVariantIdRef = useRef<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);

    return () => clearTimeout(timer);
  }, [search]);

  const fetchProducts = useCallback(async () => {
    let query = supabase.from("products").select("*", { count: "exact" });
    if (filterCategory !== "all") query = query.eq("category_id", filterCategory);
    if (debouncedSearch) query = query.ilike("name", `%${debouncedSearch}%`);
    if (sortBy === "price_asc") query = query.order("base_price", { ascending: true });
    else if (sortBy === "price_desc") query = query.order("base_price", { ascending: false });
    else query = query.order("created_at", { ascending: false });

    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data, error, count } = await query.range(from, to);

    if (error) {
      toast({ title: "Failed to fetch products", description: error.message, variant: "destructive" });
      setProducts([]);
      setTotalCount(0);
      setLoading(false);
      return;
    }

    setProducts(data || []);
    setTotalCount(count || 0);
    setLoading(false);
  }, [debouncedSearch, filterCategory, page, sortBy, toast]);

  useEffect(() => {
    supabase.from("categories").select("*").then(({ data }) => setCategories(data || []));
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", description: "", category_id: "", base_price: 0, images: [] });
    setVariants([createEmptyVariant()]);
    setDialogOpen(true);
  };

  const openEdit = async (p: Product) => {
    setEditing(p);
    setForm({
      name: p.name,
      description: p.description || "",
      category_id: p.category_id || "",
      base_price: p.base_price,
      images: p.images || [],
    });
    setDialogOpen(true);
    setDialogLoading(true);

    const { data, error } = await supabase
      .from("variants")
      .select("*")
      .eq("product_id", p.id)
      .order("created_at", { ascending: true });

    if (error) {
      toast({ title: "Failed to load variants", description: error.message, variant: "destructive" });
      setVariants([createEmptyVariant()]);
      setDialogLoading(false);
      return;
    }

    if (!data || data.length === 0) {
      setVariants([createEmptyVariant()]);
      setDialogLoading(false);
      return;
    }

    setVariants(
      data.map((variant) => ({
        id: variant.id,
        temp_id: variant.id,
        size: variant.size,
        color: variant.color,
        sku: variant.sku,
        price_override: variant.price_override,
        stock_quantity: variant.stock_quantity,
        low_stock_threshold: variant.low_stock_threshold,
        images: variant.images || [],
      })),
    );
    setDialogLoading(false);
  };

  const addVariant = () => {
    setVariants((prev) => [...prev, createEmptyVariant()]);
  };

  const addSequentialVariantAfter = (afterTempId: string) => {
    let insertedTempId: string | null = null;

    setVariants((prev) => {
      const index = prev.findIndex((variant) => variant.temp_id === afterTempId);
      const template = index >= 0 ? prev[index] : prev[prev.length - 1] || createEmptyVariant();
      const nextVariant = createSequentialVariant(template);
      insertedTempId = nextVariant.temp_id;

      if (index < 0) {
        return [...prev, nextVariant];
      }

      const next = [...prev];
      next.splice(index + 1, 0, nextVariant);
      return next;
    });

    if (insertedTempId) {
      setTimeout(() => {
        variantFieldRefs.current[insertedTempId!]?.size?.focus();
      }, 0);
    }
  };

  const moveVariant = (sourceTempId: string, targetTempId: string) => {
    if (sourceTempId === targetTempId) return;

    setVariants((prev) => {
      const sourceIndex = prev.findIndex((variant) => variant.temp_id === sourceTempId);
      const targetIndex = prev.findIndex((variant) => variant.temp_id === targetTempId);
      if (sourceIndex < 0 || targetIndex < 0) return prev;

      const next = [...prev];
      const [moved] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
  };

  const setVariantFieldRef = (tempId: string, key: VariantFieldKey, element: HTMLElement | null) => {
    if (!variantFieldRefs.current[tempId]) {
      variantFieldRefs.current[tempId] = {};
    }
    variantFieldRefs.current[tempId][key] = element;
  };

  const focusVariantField = (tempId: string, key: VariantFieldKey) => {
    const element = variantFieldRefs.current[tempId]?.[key];
    if (element) {
      element.focus();
    }
  };

  const focusNextVariantField = (tempId: string, currentField: VariantFieldKey) => {
    const variantIndex = variants.findIndex((variant) => variant.temp_id === tempId);
    if (variantIndex < 0) return;

    const fieldIndex = VARIANT_FIELD_ORDER.indexOf(currentField);
    if (fieldIndex < 0) return;

    const nextField = VARIANT_FIELD_ORDER[fieldIndex + 1];
    if (nextField) {
      setTimeout(() => focusVariantField(tempId, nextField), 0);
      return;
    }

    const nextVariant = variants[variantIndex + 1];
    if (nextVariant) {
      setTimeout(() => focusVariantField(nextVariant.temp_id, "size"), 0);
      return;
    }

    addSequentialVariantAfter(tempId);
  };

  const handleVariantFieldKeyDown = (
    event: React.KeyboardEvent<HTMLElement>,
    tempId: string,
    currentField: VariantFieldKey,
  ) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    focusNextVariantField(tempId, currentField);
  };

  const addVariantSizePack = (sizes: string[]) => {
    setVariants((prev) => {
      const template = prev[prev.length - 1] || createEmptyVariant();
      const existingKeys = new Set(prev.map((variant) => `${variant.size}::${variant.color}`));
      const additions = sizes
        .filter((size) => !existingKeys.has(`${size}::${template.color}`))
        .map((size) => createVariantFromTemplate(template, { size }));

      if (additions.length === 0) {
        toast({ title: "Size pack skipped", description: "All selected sizes already exist for the current color." });
        return prev;
      }

      toast({ title: `${additions.length} variants added` });
      return [...prev, ...additions];
    });
  };

  const duplicateVariant = (tempId: string) => {
    setVariants((prev) => {
      const index = prev.findIndex((variant) => variant.temp_id === tempId);
      if (index === -1) return prev;

      const source = prev[index];
      const clone = createVariantFromTemplate(source, {
        size: source.size,
        color: source.color,
      });
      const next = [...prev];
      next.splice(index + 1, 0, clone);
      return next;
    });
  };

  const autoGenerateVariantSku = (variant: ProductVariantForm, index: number): string => {
    const namePart = normalizeSkuPart(form.name, "PRODUCT").slice(0, 14);
    const sizePart = normalizeSkuPart(variant.size, "SIZE").slice(0, 6);
    const colorPart = normalizeSkuPart(variant.color, "COLOR").slice(0, 8);
    const indexPart = String(index + 1).padStart(2, "0");
    const suffix = crypto.randomUUID().slice(0, 4).toUpperCase();
    return `${namePart}-${sizePart}-${colorPart}-${indexPart}-${suffix}`;
  };

  const autoGenerateSkuForVariant = (tempId: string) => {
    setVariants((prev) =>
      prev.map((variant, index) =>
        variant.temp_id === tempId
          ? { ...variant, sku: autoGenerateVariantSku(variant, index) }
          : variant,
      ),
    );
  };

  const autoGenerateSkuForAllVariants = () => {
    setVariants((prev) => prev.map((variant, index) => ({ ...variant, sku: autoGenerateVariantSku(variant, index) })));
    toast({ title: "SKUs generated for all variants" });
  };

  const removeVariant = (tempId: string) => {
    setVariants((prev) => {
      if (prev.length === 1) return prev;
      return prev.filter((variant) => variant.temp_id !== tempId);
    });
  };

  const updateVariant = <K extends keyof ProductVariantForm>(tempId: string, key: K, value: ProductVariantForm[K]) => {
    setVariants((prev) => prev.map((variant) => (variant.temp_id === tempId ? { ...variant, [key]: value } : variant)));
  };

  const handleProductImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const remaining = 5 - form.images.length;
    if (remaining <= 0) {
      toast({ title: "Max 5 images", description: "Remove an image before adding more.", variant: "destructive" });
      return;
    }

    const filesToUpload = Array.from(files).slice(0, remaining);
    setUploading(true);
    const newUrls: string[] = [];

    for (const file of filesToUpload) {
      if (!file.type.startsWith("image/")) continue;
      if (file.size > 8 * 1024 * 1024) {
        toast({ title: "File too large", description: `${file.name} exceeds 8MB limit.`, variant: "destructive" });
        continue;
      }

      try {
        const publicUrl = await uploadOptimizedImage(file, {
          bucket: "product-images",
          folder: "products",
        });
        newUrls.push(publicUrl);
      } catch (error) {
        toast({
          title: "Upload failed",
          description: error instanceof Error ? error.message : "Unexpected error",
          variant: "destructive",
        });
        continue;
      }
    }

    setForm(prev => ({ ...prev, images: [...prev.images, ...newUrls] }));
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (newUrls.length > 0) toast({ title: `${newUrls.length} image(s) uploaded` });
  };

  const handleVariantImageUpload = async (tempId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const currentVariant = variants.find((variant) => variant.temp_id === tempId);
    if (!currentVariant) return;

    const remaining = 5 - currentVariant.images.length;
    if (remaining <= 0) {
      toast({ title: "Max 5 images", description: "Remove an image before adding more.", variant: "destructive" });
      return;
    }

    const filesToUpload = Array.from(files).slice(0, remaining);
    setUploading(true);
    const uploadedUrls: string[] = [];

    for (const file of filesToUpload) {
      if (!file.type.startsWith("image/")) continue;
      if (file.size > 8 * 1024 * 1024) {
        toast({ title: "File too large", description: `${file.name} exceeds 8MB limit.`, variant: "destructive" });
        continue;
      }

      try {
        const publicUrl = await uploadOptimizedImage(file, {
          bucket: "product-images",
          folder: "variants",
        });
        uploadedUrls.push(publicUrl);
      } catch (error) {
        toast({
          title: "Variant image upload failed",
          description: error instanceof Error ? error.message : "Unexpected error",
          variant: "destructive",
        });
      }
    }

    if (uploadedUrls.length > 0) {
      setVariants((prev) =>
        prev.map((variant) =>
          variant.temp_id === tempId
            ? { ...variant, images: [...variant.images, ...uploadedUrls] }
            : variant,
        ),
      );
      toast({ title: `${uploadedUrls.length} variant image(s) uploaded` });
    }

    setUploading(false);
    if (variantFileInputRefs.current[tempId]) {
      variantFileInputRefs.current[tempId]!.value = "";
    }
  };

  const removeProductImage = (index: number) => {
    setForm(prev => ({ ...prev, images: prev.images.filter((_, i) => i !== index) }));
  };

  const removeVariantImage = (tempId: string, imageIndex: number) => {
    setVariants((prev) =>
      prev.map((variant) =>
        variant.temp_id === tempId
          ? { ...variant, images: variant.images.filter((_, index) => index !== imageIndex) }
          : variant,
      ),
    );
  };

  const clearVariantImages = (tempId: string) => {
    setVariants((prev) =>
      prev.map((variant) => (variant.temp_id === tempId ? { ...variant, images: [] } : variant)),
    );
  };

  const handleUseProductImagesForVariant = (tempId: string) => {
    if (!form.images.length) {
      toast({ title: "No product images yet", description: "Upload product images first." });
      return;
    }

    setVariants((prev) =>
      prev.map((variant) =>
        variant.temp_id === tempId ? { ...variant, images: form.images.slice(0, 5) } : variant,
      ),
    );
  };

  const useVariantImagesForProduct = () => {
    const source = variants.find((variant) => variant.images.length > 0);
    if (!source) {
      toast({ title: "No variant images available", description: "Upload variant images first." });
      return;
    }

    setForm((prev) => ({ ...prev, images: source.images.slice(0, 5) }));
    toast({ title: "Product images replaced", description: "Copied from first variant with images." });
  };

  const handleSave = async () => {
    const name = form.name.trim();
    if (!name) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }

    if (variants.length === 0) {
      toast({ title: "At least one variant is required", variant: "destructive" });
      return;
    }

    for (const variant of variants) {
      if (!variant.sku.trim()) {
        toast({ title: "SKU is required for each variant", variant: "destructive" });
        return;
      }
      if (!variant.size.trim() || !variant.color.trim()) {
        toast({ title: "Size and color are required for each variant", variant: "destructive" });
        return;
      }
      if (variant.images.length > 5) {
        toast({ title: "Each variant supports up to 5 images", variant: "destructive" });
        return;
      }
    }

    const payload = {
      name,
      description: form.description || null,
      category_id: form.category_id || null,
      base_price: form.base_price,
      images: form.images,
    };

    if (editing) {
      const { error } = await supabase.from("products").update(payload).eq("id", editing.id);
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }

      const existingVariantIds = variants.filter((variant) => variant.id).map((variant) => variant.id as string);
      let deleteQuery = supabase.from("variants").delete().eq("product_id", editing.id);
      if (existingVariantIds.length > 0) {
        deleteQuery = deleteQuery.not("id", "in", `(${existingVariantIds.join(",")})`);
      }

      const { error: deleteError } = await deleteQuery;
      if (deleteError) { toast({ title: "Error", description: deleteError.message, variant: "destructive" }); return; }

      for (const variant of variants) {
        const variantPayload = {
          product_id: editing.id,
          size: variant.size,
          color: variant.color,
          sku: variant.sku.trim(),
          price_override: variant.price_override,
          stock_quantity: Number(variant.stock_quantity) || 0,
          low_stock_threshold: Number(variant.low_stock_threshold) || 5,
          images: variant.images,
        };

        if (variant.id) {
          const { error: updateVariantError } = await supabase
            .from("variants")
            .update(variantPayload)
            .eq("id", variant.id);

          if (updateVariantError) {
            toast({ title: "Error", description: updateVariantError.message, variant: "destructive" });
            return;
          }
        } else {
          const { error: insertVariantError } = await supabase.from("variants").insert(variantPayload);
          if (insertVariantError) {
            toast({ title: "Error", description: insertVariantError.message, variant: "destructive" });
            return;
          }
        }
      }

      toast({ title: "Product updated" });
    } else {
      const { data: createdProduct, error } = await supabase
        .from("products")
        .insert(payload)
        .select("id")
        .single();
      if (error || !createdProduct) { toast({ title: "Error", description: error?.message || "Failed to create product", variant: "destructive" }); return; }

      const variantPayload = variants.map((variant) => ({
        product_id: createdProduct.id,
        size: variant.size,
        color: variant.color,
        sku: variant.sku.trim(),
        price_override: variant.price_override,
        stock_quantity: Number(variant.stock_quantity) || 0,
        low_stock_threshold: Number(variant.low_stock_threshold) || 5,
        images: variant.images,
      }));

      const { error: variantInsertError } = await supabase.from("variants").insert(variantPayload);
      if (variantInsertError) { toast({ title: "Error", description: variantInsertError.message, variant: "destructive" }); return; }

      toast({ title: "Product created" });
    }

    setDialogOpen(false);
    fetchProducts();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Product deleted" });
    fetchProducts();
  };

  const toggleActive = async (p: Product) => {
    await supabase.from("products").update({ is_active: !p.is_active }).eq("id", p.id);
    fetchProducts();
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  if (loading) return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-10 w-36" />
      </div>
      <div className="flex flex-wrap gap-3">
        <Skeleton className="h-10 flex-1 min-w-[200px]" />
        <Skeleton className="h-10 w-[180px]" />
        <Skeleton className="h-10 w-[180px]" />
      </div>
      <div className="rounded-md border">
        <div className="p-4 space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-5 flex-1" />
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-8 w-20" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Products</h1>
        <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Add Product</Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search products..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select
          value={filterCategory}
          onValueChange={(value) => {
            setFilterCategory(value);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select
          value={sortBy}
          onValueChange={(value) => {
            setSortBy(value);
            setPage(1);
          }}
        >
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
              <TableHead>Name</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map(p => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-3">
                    {p.images?.[0] && <img src={p.images[0]} alt="" className="w-10 h-10 object-cover rounded" />}
                    {p.name}
                  </div>
                </TableCell>
                <TableCell>₹{Number(p.base_price).toLocaleString()}</TableCell>
                <TableCell>
                  <button onClick={() => toggleActive(p)} className={`text-xs px-2 py-0.5 rounded-full ${p.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                    {p.is_active ? "Active" : "Inactive"}
                  </button>
                </TableCell>
                <TableCell className="text-right space-x-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete product?</AlertDialogTitle>
                        <AlertDialogDescription>This will permanently delete "{p.name}" and all its variants.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(p.id)}>Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </TableCell>
              </TableRow>
            ))}
            {products.length === 0 && (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No products found.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>

        <AdminTablePagination page={page} totalPages={totalPages} onPageChange={setPage} />
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Edit Product" : "Add Product"}</DialogTitle></DialogHeader>
          {dialogLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-[240px] w-full" />
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h2 className="font-semibold text-lg">Base Product</h2>
                  <div className="space-y-2">
                    <Label>Name</Label>
                    <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select value={form.category_id} onValueChange={v => setForm({ ...form, category_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                      <SelectContent>
                        {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Base Price (₹)</Label>
                    <Input
                      type="number"
                      value={form.base_price}
                      onChange={e => setForm({ ...form, base_price: Number(e.target.value) || 0 })}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Label>Product Images ({form.images.length}/5)</Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={useVariantImagesForProduct}
                        disabled={uploading}
                      >
                        Use Variant Images
                      </Button>
                    </div>
                    <div className="grid grid-cols-5 gap-2">
                      {form.images.map((url, i) => (
                        <div key={i} className="relative group">
                          <img src={url} alt="" className="w-full aspect-square object-cover rounded border" />
                          <Button
                            variant="destructive"
                            size="icon"
                            className="absolute top-0.5 right-0.5 h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => removeProductImage(i)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                      {form.images.length < 5 && (
                        <button
                          type="button"
                          className="aspect-square border-2 border-dashed rounded flex items-center justify-center hover:border-primary/50 transition-colors"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          {uploading ? (
                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                          ) : (
                            <Upload className="h-5 w-5 text-muted-foreground" />
                          )}
                        </button>
                      )}
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={handleProductImageUpload}
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <h2 className="font-semibold text-lg">Variants</h2>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Button type="button" variant="outline" onClick={() => addVariantSizePack(["S", "M", "L"])}>
                        Add S/M/L
                      </Button>
                      <Button type="button" variant="outline" onClick={() => addVariantSizePack(["M", "L", "XL"])}>
                        Add M/L/XL
                      </Button>
                      <Button type="button" variant="outline" onClick={autoGenerateSkuForAllVariants}>
                        Auto SKU All
                      </Button>
                      <Button type="button" variant="outline" onClick={addVariant}>
                        <Plus className="mr-2 h-4 w-4" />
                        Add Variant
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
                    {variants.map((variant, index) => (
                      <div
                        key={variant.temp_id}
                        draggable
                        onDragStart={() => {
                          draggingVariantIdRef.current = variant.temp_id;
                        }}
                        onDragOver={(event) => {
                          event.preventDefault();
                        }}
                        onDrop={() => {
                          const source = draggingVariantIdRef.current;
                          if (source) {
                            moveVariant(source, variant.temp_id);
                          }
                        }}
                        onDragEnd={() => {
                          draggingVariantIdRef.current = null;
                        }}
                        className="border rounded-lg p-3 space-y-3 cursor-grab active:cursor-grabbing"
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium">Variant {index + 1}</p>
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => addSequentialVariantAfter(variant.temp_id)}
                            >
                              Add Next
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => duplicateVariant(variant.temp_id)}
                            >
                              Duplicate
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeVariant(variant.temp_id)}
                              disabled={variants.length === 1}
                            >
                              Remove
                            </Button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label>Size</Label>
                            <Select
                              value={variant.size}
                              onValueChange={(value) => updateVariant(variant.temp_id, "size", value)}
                            >
                              <SelectTrigger
                                ref={(element) => setVariantFieldRef(variant.temp_id, "size", element)}
                                onKeyDown={(event) => handleVariantFieldKeyDown(event, variant.temp_id, "size")}
                              >
                                <SelectValue placeholder="Select size" />
                              </SelectTrigger>
                              <SelectContent>
                                {SIZE_OPTIONS.map((size) => (
                                  <SelectItem key={size} value={size}>{size}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label>Color</Label>
                            <Select
                              value={variant.color}
                              onValueChange={(value) => updateVariant(variant.temp_id, "color", value)}
                            >
                              <SelectTrigger
                                ref={(element) => setVariantFieldRef(variant.temp_id, "color", element)}
                                onKeyDown={(event) => handleVariantFieldKeyDown(event, variant.temp_id, "color")}
                              >
                                <SelectValue placeholder="Select color" />
                              </SelectTrigger>
                              <SelectContent>
                                {COLOR_OPTIONS.map((color) => (
                                  <SelectItem key={color} value={color}>{color}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <Label>SKU</Label>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2"
                              onClick={() => autoGenerateSkuForVariant(variant.temp_id)}
                            >
                              Auto SKU
                            </Button>
                          </div>
                          <Input
                            ref={(element) => setVariantFieldRef(variant.temp_id, "sku", element)}
                            value={variant.sku}
                            onChange={(event) => updateVariant(variant.temp_id, "sku", event.target.value)}
                            onKeyDown={(event) => handleVariantFieldKeyDown(event, variant.temp_id, "sku")}
                            placeholder="Unique SKU"
                          />
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          <div className="space-y-1">
                            <Label>Price Override (₹)</Label>
                            <Input
                              ref={(element) => setVariantFieldRef(variant.temp_id, "price_override", element)}
                              type="number"
                              value={variant.price_override ?? ""}
                              onChange={(event) => {
                                const value = event.target.value;
                                updateVariant(variant.temp_id, "price_override", value ? Number(value) : null);
                              }}
                              onKeyDown={(event) => handleVariantFieldKeyDown(event, variant.temp_id, "price_override")}
                              placeholder="Optional"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label>Stock Qty</Label>
                            <Input
                              ref={(element) => setVariantFieldRef(variant.temp_id, "stock_quantity", element)}
                              type="number"
                              value={variant.stock_quantity}
                              onChange={(event) => updateVariant(variant.temp_id, "stock_quantity", Number(event.target.value) || 0)}
                              onKeyDown={(event) => handleVariantFieldKeyDown(event, variant.temp_id, "stock_quantity")}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label>Low Stock Alert</Label>
                            <Input
                              ref={(element) => setVariantFieldRef(variant.temp_id, "low_stock_threshold", element)}
                              type="number"
                              value={variant.low_stock_threshold}
                              onChange={(event) => updateVariant(variant.temp_id, "low_stock_threshold", Number(event.target.value) || 0)}
                              onKeyDown={(event) => handleVariantFieldKeyDown(event, variant.temp_id, "low_stock_threshold")}
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <Label>Variant Images ({variant.images.length}/5)</Label>
                            <div className="flex items-center gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2"
                                onClick={() => handleUseProductImagesForVariant(variant.temp_id)}
                              >
                                Use Product Images
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2"
                                onClick={() => clearVariantImages(variant.temp_id)}
                                disabled={variant.images.length === 0}
                              >
                                Clear
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-6 px-2"
                                onClick={() => variantFileInputRefs.current[variant.temp_id]?.click()}
                                disabled={variant.images.length >= 5 || uploading}
                              >
                                Upload
                              </Button>
                            </div>
                          </div>
                          <div className="grid grid-cols-5 gap-2">
                            {variant.images.map((url, imageIndex) => (
                              <div key={imageIndex} className="relative group">
                                <img src={url} alt="" className="w-full aspect-square object-cover rounded border" />
                                <Button
                                  variant="destructive"
                                  size="icon"
                                  className="absolute top-0.5 right-0.5 h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={() => removeVariantImage(variant.temp_id, imageIndex)}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            ))}

                            {variant.images.length < 5 && (
                              <button
                                type="button"
                                className="aspect-square border-2 border-dashed rounded flex items-center justify-center hover:border-primary/50 transition-colors"
                                onClick={() => variantFileInputRefs.current[variant.temp_id]?.click()}
                              >
                                {uploading ? (
                                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                                ) : (
                                  <Upload className="h-5 w-5 text-muted-foreground" />
                                )}
                              </button>
                            )}
                          </div>
                          <input
                            ref={(element) => {
                              variantFileInputRefs.current[variant.temp_id] = element;
                            }}
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            onChange={(event) => handleVariantImageUpload(variant.temp_id, event)}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                Tip: Drag variant cards to reorder. Press Enter while filling fields to jump to the next field, and Enter on the last field creates the next variant.
              </p>

              <Button className="w-full" onClick={handleSave} disabled={uploading}>
                {editing ? "Update Product" : "Create Product"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
