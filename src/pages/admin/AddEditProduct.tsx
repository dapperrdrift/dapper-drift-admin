import { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { uploadOptimizedImage } from "@/lib/optimizedUpload";
import { cn } from "@/lib/utils";
import {
  Plus, X, ChevronRight, Upload, Image, Loader2, ArrowLeft,
  Wand2, Trash2, Package, BarChart3, Tag, AlertCircle, Save,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Category { id: string; name: string }

interface ProductOption {
  name: string;
  values: string[];
  inputValue: string;
}

interface VariantRow {
  temp_id: string;
  id?: string;
  label: string;
  color: string;
  size: string;
  sku: string;
  price_override: number | null;
  compare_at_price: number | null;
  stock_quantity: number;
  low_stock_threshold: number;
  barcode: string;
  weight: string;
  images: string[];
  track_inventory: boolean;
  status: "active" | "draft";
  expanded: boolean;
}

interface ProductForm {
  name: string;
  description: string;
  category_id: string;
  brand: string;
  tags: string[];
  status: "draft" | "active" | "archived";
  base_price: number;
  images: string[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const COLOR_SWATCHES: Record<string, string> = {
  Black: "#1a1a1a", White: "#f0f0f0", Navy: "#001f5b", Blue: "#2563eb",
  Indigo: "#4338ca", Grey: "#6b7280", Gray: "#6b7280", Brown: "#92400e",
  Beige: "#d4b896", Olive: "#65612a", Green: "#16a34a", Red: "#dc2626",
  Maroon: "#7f1d1d", Pink: "#ec4899", Purple: "#9333ea", Orange: "#ea580c",
  Yellow: "#eab308", Gold: "#ca8a04", Silver: "#9ca3af",
};

function getColorSwatch(color: string): string | null {
  return COLOR_SWATCHES[color] ?? null;
}

function normalizeSkuPart(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "X";
}

function generateSku(productName: string, color: string, size: string, index: number): string {
  const name = normalizeSkuPart(productName).slice(0, 10);
  const c = normalizeSkuPart(color).slice(0, 6);
  const s = normalizeSkuPart(size).slice(0, 4);
  return `${name}-${c}-${s}-${String(index + 1).padStart(2, "0")}`;
}

function createEmptyVariant(color: string, size: string, label: string): VariantRow {
  return {
    temp_id: crypto.randomUUID(),
    label, color, size,
    sku: "", price_override: null, compare_at_price: null,
    stock_quantity: 0, low_stock_threshold: 5,
    barcode: "", weight: "", images: [],
    track_inventory: true, status: "active", expanded: false,
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AddEditProduct() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isEdit = !!id;

  const [form, setForm] = useState<ProductForm>({
    name: "", description: "", category_id: "", brand: "",
    tags: [], status: "draft", base_price: 0, images: [],
  });
  const [tagInput, setTagInput] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [hasVariants, setHasVariants] = useState(true);
  const [options, setOptions] = useState<ProductOption[]>([
    { name: "Color", values: [], inputValue: "" },
    { name: "Size", values: [], inputValue: "" },
  ]);
  const [variants, setVariants] = useState<VariantRow[]>([]);
  const [variantsGenerated, setVariantsGenerated] = useState(false);
  const variantFileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const [bulkPrice, setBulkPrice] = useState("");
  const [bulkCompareAt, setBulkCompareAt] = useState("");
  const [bulkStock, setBulkStock] = useState("");
  const [bulkSkuPrefix, setBulkSkuPrefix] = useState("");

  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEdit);
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    supabase.from("categories").select("id, name").then(({ data }) => setCategories(data || []));
  }, []);

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      const [{ data: product }, { data: variantData }] = await Promise.all([
        supabase.from("products").select("*").eq("id", id).single(),
        supabase.from("variants").select("*").eq("product_id", id).order("created_at"),
      ]);
      if (!product) {
        toast({ title: "Product not found", variant: "destructive" });
        navigate("/admin/products");
        return;
      }
      setForm({
        name: product.name,
        description: product.description || "",
        category_id: product.category_id || "",
        brand: product.brand || "",
        tags: product.tags || [],
        status: (product.status as "draft" | "active" | "archived") || (product.is_active ? "active" : "draft"),
        base_price: product.base_price,
        images: product.images || [],
      });
      if (variantData && variantData.length > 0) {
        const uniqueColors = [...new Set(variantData.map(v => v.color).filter(c => c && c !== "Default"))];
        const uniqueSizes = [...new Set(variantData.map(v => v.size).filter(s => s && s !== "Default"))];
        setHasVariants(true);
        setOptions([
          { name: "Color", values: uniqueColors, inputValue: "" },
          { name: "Size", values: uniqueSizes, inputValue: "" },
        ]);
        const useSlash = uniqueColors.length > 0 && uniqueSizes.length > 0;
        setVariants(variantData.map(v => ({
          temp_id: v.id,
          id: v.id,
          label: useSlash ? `${v.color} / ${v.size}` : (uniqueColors.length > 0 ? v.color : v.size),
          color: v.color,
          size: v.size,
          sku: v.sku,
          price_override: v.price_override,
          compare_at_price: v.compare_at_price ?? null,
          stock_quantity: v.stock_quantity,
          low_stock_threshold: v.low_stock_threshold,
          barcode: v.barcode ?? "",
          weight: v.weight ? String(v.weight) : "",
          images: v.images || [],
          track_inventory: v.track_inventory ?? true,
          status: "active" as const,
          expanded: false,
        })));
        setVariantsGenerated(true);
      }
      setLoading(false);
    })();
  }, [id, navigate, toast]);

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const updateForm = <K extends keyof ProductForm>(key: K, value: ProductForm[K]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const addTag = (value: string) => {
    const t = value.trim().toLowerCase();
    if (t && !form.tags.includes(t)) updateForm("tags", [...form.tags, t]);
    setTagInput("");
  };
  const removeTag = (tag: string) => updateForm("tags", form.tags.filter(t => t !== tag));

  const uploadFiles = useCallback(async (files: File[]) => {
    const remaining = 5 - form.images.length;
    if (remaining <= 0) { toast({ title: "Max 5 images per product", variant: "destructive" }); return; }
    const toUpload = files.slice(0, remaining).filter(f => f.type.startsWith("image/") && f.size <= 8 * 1024 * 1024);
    if (toUpload.length === 0) return;
    setUploading(true);
    const urls: string[] = [];
    for (const file of toUpload) {
      try {
        urls.push(await uploadOptimizedImage(file, { bucket: "product-images", folder: "products" }));
      } catch (e) {
        toast({ title: "Upload failed", description: e instanceof Error ? e.message : "Error", variant: "destructive" });
      }
    }
    if (urls.length > 0) {
      setForm(prev => ({ ...prev, images: [...prev.images, ...urls] }));
      toast({ title: `${urls.length} image(s) uploaded` });
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [form.images.length, toast]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    uploadFiles(Array.from(e.dataTransfer.files).filter(f => f.type.startsWith("image/")));
  };

  const updateOptionValue = (idx: number, field: "name" | "inputValue", val: string) =>
    setOptions(prev => prev.map((opt, i) => i === idx ? { ...opt, [field]: val } : opt));

  const addOptionValue = (idx: number) => {
    const val = options[idx].inputValue.trim();
    if (!val) return;
    if (!options[idx].values.includes(val)) {
      setOptions(prev => prev.map((opt, i) => i === idx
        ? { ...opt, values: [...opt.values, val], inputValue: "" } : opt));
    } else {
      setOptions(prev => prev.map((opt, i) => i === idx ? { ...opt, inputValue: "" } : opt));
    }
  };

  const removeOptionValue = (optIdx: number, val: string) =>
    setOptions(prev => prev.map((opt, i) => i === optIdx
      ? { ...opt, values: opt.values.filter(v => v !== val) } : opt));

  const generateVariants = () => {
    const colors = options[0]?.values || [];
    const sizes = options[1]?.values || [];
    const combos: { color: string; size: string; label: string }[] = [];

    if (colors.length > 0 && sizes.length > 0) {
      for (const c of colors) for (const s of sizes) combos.push({ color: c, size: s, label: `${c} / ${s}` });
    } else if (colors.length > 0) {
      for (const c of colors) combos.push({ color: c, size: "Default", label: c });
    } else if (sizes.length > 0) {
      for (const s of sizes) combos.push({ color: "Default", size: s, label: s });
    }

    if (combos.length === 0) {
      toast({ title: "Add at least one option value first", variant: "destructive" }); return;
    }

    const existingByLabel = Object.fromEntries(variants.map(v => [v.label, v]));
    setVariants(combos.map(combo => {
      const ex = existingByLabel[combo.label];
      return ex ? { ...ex, color: combo.color, size: combo.size } : createEmptyVariant(combo.color, combo.size, combo.label);
    }));
    setVariantsGenerated(true);
    toast({ title: `${combos.length} variants generated` });
  };

  const updateVariant = <K extends keyof VariantRow>(tempId: string, key: K, value: VariantRow[K]) =>
    setVariants(prev => prev.map(v => v.temp_id === tempId ? { ...v, [key]: value } : v));

  const deleteVariant = (tempId: string) => setVariants(prev => prev.filter(v => v.temp_id !== tempId));

  const toggleExpanded = (tempId: string) =>
    setVariants(prev => prev.map(v => v.temp_id === tempId ? { ...v, expanded: !v.expanded } : v));

  const autoSkuAll = () => {
    if (!form.name.trim()) { toast({ title: "Enter a product name first", variant: "destructive" }); return; }
    setVariants(prev => prev.map((v, i) => ({ ...v, sku: generateSku(form.name, v.color, v.size, i) })));
    toast({ title: "SKUs generated for all variants" });
  };

  const applyBulk = () => {
    setVariants(prev => prev.map((v, i) => ({
      ...v,
      ...(bulkPrice !== "" && { price_override: Number(bulkPrice) }),
      ...(bulkCompareAt !== "" && { compare_at_price: Number(bulkCompareAt) }),
      ...(bulkStock !== "" && { stock_quantity: Number(bulkStock) }),
      ...(bulkSkuPrefix !== "" && { sku: `${bulkSkuPrefix}-${String(i + 1).padStart(2, "0")}` }),
    })));
    setBulkPrice(""); setBulkCompareAt(""); setBulkStock(""); setBulkSkuPrefix("");
    toast({ title: "Bulk update applied to all variants" });
  };

  const uploadVariantImages = async (tempId: string, files: File[]) => {
    const variant = variants.find(v => v.temp_id === tempId);
    if (!variant) return;
    const remaining = 5 - variant.images.length;
    const toUpload = files.slice(0, remaining).filter(f => f.type.startsWith("image/") && f.size <= 8 * 1024 * 1024);
    if (toUpload.length === 0) return;
    setUploading(true);
    const urls: string[] = [];
    for (const file of toUpload) {
      try {
        urls.push(await uploadOptimizedImage(file, { bucket: "product-images", folder: "variants" }));
      } catch { toast({ title: "Upload failed", variant: "destructive" }); }
    }
    if (urls.length > 0) updateVariant(tempId, "images", [...variant.images, ...urls]);
    setUploading(false);
    if (variantFileRefs.current[tempId]) variantFileRefs.current[tempId]!.value = "";
  };

  const handleSave = async (saveStatus: "draft" | "active") => {
    if (!form.name.trim()) { toast({ title: "Product name is required", variant: "destructive" }); return; }
    const variantsToSave = hasVariants && variantsGenerated ? variants : null;
    if (variantsToSave) {
      for (const v of variantsToSave) {
        if (!v.sku.trim()) { toast({ title: `SKU required for variant "${v.label}"`, variant: "destructive" }); return; }
      }
    }
    setSaving(true);
    try {
      const productPayload = {
        name: form.name.trim(),
        description: form.description || null,
        category_id: form.category_id || null,
        brand: form.brand || null,
        tags: form.tags.length > 0 ? form.tags : null,
        status: saveStatus,
        base_price: form.base_price,
        images: form.images,
        is_active: saveStatus === "active",
      };

      let pid = id;
      if (isEdit) {
        const { error } = await supabase.from("products").update(productPayload).eq("id", id!);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("products").insert(productPayload).select("id").single();
        if (error || !data) throw error || new Error("Failed to create product");
        pid = data.id;
      }

      const finalVariants = variantsToSave ?? [{
        ...createEmptyVariant("Default", "Default", "Default"),
        sku: normalizeSkuPart(form.name).slice(0, 12) + "-DEFAULT",
        price_override: form.base_price,
      }];

      if (isEdit) {
        const existingIds = finalVariants.filter(v => v.id).map(v => v.id as string);
        let deleteQ = supabase.from("variants").delete().eq("product_id", id!);
        if (existingIds.length > 0) deleteQ = deleteQ.not("id", "in", `(${existingIds.join(",")})`);
        await deleteQ;
      }

      for (const v of finalVariants) {
        const vPayload = {
          product_id: pid!,
          color: v.color, size: v.size,
          sku: v.sku.trim(),
          price_override: v.price_override,
          compare_at_price: v.compare_at_price,
          stock_quantity: v.stock_quantity,
          low_stock_threshold: v.low_stock_threshold,
          barcode: v.barcode || null,
          weight: v.weight ? Number(v.weight) : null,
          track_inventory: v.track_inventory,
          images: v.images,
        };
        if (v.id) await supabase.from("variants").update(vPayload).eq("id", v.id);
        else await supabase.from("variants").insert(vPayload);
      }

      toast({ title: saveStatus === "active" ? "Product published!" : "Draft saved" });
      navigate("/admin/products");
    } catch (error) {
      toast({ title: "Save failed", description: error instanceof Error ? error.message : "Unknown error", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="-m-6 p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Skeleton className="h-8 w-8 rounded-lg" />
        <div className="space-y-1"><Skeleton className="h-3 w-32" /><Skeleton className="h-5 w-48" /></div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_288px] gap-6">
        <div className="space-y-5">
          <Skeleton className="h-52 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-80 w-full rounded-xl" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-36 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );

  const missingSku = variants.filter(v => !v.sku.trim()).length;
  const totalStock = variants.reduce((s, v) => s + v.stock_quantity, 0);

  return (
    <div className="-m-6 flex flex-col bg-muted/20" style={{ minHeight: "calc(100vh - 3.5rem)" }}>

      {/* ── Sticky page header ── */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b">
        <div className="px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Button variant="ghost" size="icon" onClick={() => navigate("/admin/products")} className="h-8 w-8 shrink-0 rounded-lg">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span>Products</span>
                <ChevronRight className="h-3 w-3" />
                <span className="text-foreground font-medium truncate">{isEdit ? (form.name || "Edit Product") : "New product"}</span>
              </div>
              <h1 className="text-base font-semibold leading-tight">{isEdit ? "Edit product" : "Add product"}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={() => handleSave("draft")} disabled={saving}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
              Save draft
            </Button>
            <Button size="sm" onClick={() => handleSave("active")} disabled={saving} className="min-w-[90px]">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
              Publish
            </Button>
          </div>
        </div>
      </div>

      {/* ── Main scrollable content ── */}
      <div className="flex-1">
        <div className="max-w-6xl mx-auto px-6 py-6 pb-8">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_288px] gap-6 items-start">

            {/* ────── LEFT COLUMN ────── */}
            <div className="space-y-5">

              {/* Basic Information */}
              <section className="bg-card rounded-xl border shadow-sm p-6 space-y-4">
                <h2 className="font-semibold text-sm text-foreground">Basic information</h2>

                <div className="space-y-1.5">
                  <Label htmlFor="product-name" className="text-xs font-medium">Product name <span className="text-destructive">*</span></Label>
                  <Input
                    id="product-name"
                    value={form.name}
                    onChange={e => updateForm("name", e.target.value)}
                    placeholder="e.g. Classic Drift Hoodie"
                    className="h-10 text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="description" className="text-xs font-medium">Description</Label>
                  <Textarea
                    id="description"
                    value={form.description}
                    onChange={e => updateForm("description", e.target.value)}
                    placeholder="Describe your product — materials, fit, features..."
                    rows={5}
                    className="resize-none text-sm leading-relaxed"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Tags</Label>
                  <div
                    className={cn(
                      "flex flex-wrap gap-1.5 min-h-[42px] px-3 py-2 rounded-lg border bg-background",
                      "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-0 transition-shadow cursor-text"
                    )}
                    onClick={() => document.getElementById("tag-input")?.focus()}
                  >
                    {form.tags.map(tag => (
                      <span key={tag} className="inline-flex items-center gap-1 bg-secondary text-secondary-foreground text-xs font-medium px-2 py-0.5 rounded-md">
                        <Tag className="h-2.5 w-2.5" />
                        {tag}
                        <button type="button" onClick={() => removeTag(tag)} className="ml-0.5 hover:text-foreground transition-colors">
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </span>
                    ))}
                    <input
                      id="tag-input"
                      value={tagInput}
                      onChange={e => setTagInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(tagInput); }
                        if (e.key === "Backspace" && !tagInput && form.tags.length > 0) removeTag(form.tags[form.tags.length - 1]);
                      }}
                      onBlur={() => tagInput.trim() && addTag(tagInput)}
                      placeholder={form.tags.length === 0 ? "Add tags (Enter or comma to add)..." : ""}
                      className="flex-1 min-w-[150px] bg-transparent outline-none text-sm placeholder:text-muted-foreground"
                    />
                  </div>
                </div>
              </section>

              {/* Media */}
              <section className="bg-card rounded-xl border shadow-sm p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold text-sm text-foreground">Media</h2>
                  <span className="text-xs text-muted-foreground">{form.images.length} / 5</span>
                </div>

                <div
                  className={cn(
                    "rounded-xl border-2 border-dashed transition-all",
                    isDragOver ? "border-primary bg-primary/5 scale-[0.995]" : "border-border hover:border-primary/40 hover:bg-muted/20",
                    form.images.length === 0 ? "cursor-pointer p-10" : "p-3"
                  )}
                  onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
                  onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragOver(false); }}
                  onDrop={handleDrop}
                  onClick={form.images.length === 0 ? () => fileInputRef.current?.click() : undefined}
                >
                  {form.images.length === 0 ? (
                    <div className="text-center select-none">
                      {uploading
                        ? <Loader2 className="h-9 w-9 text-muted-foreground/40 mx-auto mb-3 animate-spin" />
                        : <Image className="h-9 w-9 text-muted-foreground/30 mx-auto mb-3" />
                      }
                      <p className="text-sm font-medium">Drop images here or <span className="text-primary">browse files</span></p>
                      <p className="text-xs text-muted-foreground mt-1">PNG, JPG, WebP · Up to 8 MB each · Max 5 images</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-5 gap-2">
                      {form.images.map((url, i) => (
                        <div key={i} className={cn(
                          "relative group aspect-square rounded-lg overflow-hidden border",
                          i === 0 && "ring-2 ring-primary ring-offset-1"
                        )}>
                          <img src={url} alt="" className="w-full h-full object-cover" />
                          {i === 0 && (
                            <div className="absolute bottom-0 inset-x-0 bg-primary/90 text-primary-foreground text-[9px] font-semibold text-center py-0.5 uppercase tracking-wide">
                              Cover
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-start justify-end p-1.5 gap-1">
                            {i !== 0 && (
                              <button
                                type="button"
                                title="Set as cover"
                                onClick={e => { e.stopPropagation(); setForm(prev => ({ ...prev, images: [url, ...prev.images.filter((_, idx) => idx !== i)] })); }}
                                className="bg-white/20 backdrop-blur-sm text-white text-[10px] px-1.5 py-0.5 rounded-md hover:bg-white/30 transition-colors"
                              >
                                Cover
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={e => { e.stopPropagation(); setForm(prev => ({ ...prev, images: prev.images.filter((_, idx) => idx !== i) })); }}
                              className="bg-red-500/80 text-white rounded-md p-1 hover:bg-red-600 transition-colors"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                      {form.images.length < 5 && (
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="aspect-square rounded-lg border-2 border-dashed border-border hover:border-primary/50 hover:bg-muted/30 flex flex-col items-center justify-center gap-1.5 text-muted-foreground hover:text-foreground transition-all"
                        >
                          {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
                          <span className="text-[10px] font-medium">Add</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden"
                  onChange={e => e.target.files && uploadFiles(Array.from(e.target.files))} />
              </section>

              {/* Variants */}
              <section className="bg-card rounded-xl border shadow-sm overflow-hidden">
                <div className="p-6 flex items-start justify-between gap-4">
                  <div>
                    <h2 className="font-semibold text-sm text-foreground">Variants</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">Add sizes, colors, or other options for this product</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-muted-foreground">Has variants</span>
                    <Switch checked={hasVariants} onCheckedChange={v => { setHasVariants(v); if (!v) { setVariants([]); setVariantsGenerated(false); } }} />
                  </div>
                </div>

                {hasVariants && (
                  <>
                    <Separator />
                    {/* Option builder */}
                    <div className="p-6 space-y-4">
                      <div className="space-y-3">
                        {options.map((opt, optIdx) => (
                          <div key={optIdx} className="flex items-start gap-2">
                            <Input
                              value={opt.name}
                              onChange={e => updateOptionValue(optIdx, "name", e.target.value)}
                              placeholder="Option name"
                              className="w-[110px] h-8 text-xs shrink-0 font-medium"
                            />
                            <div
                              className="flex flex-1 flex-wrap gap-1.5 min-h-[32px] px-2.5 py-1.5 rounded-lg border bg-muted/30 hover:bg-muted/50 focus-within:ring-2 focus-within:ring-ring focus-within:bg-background transition-all cursor-text"
                              onClick={() => document.getElementById(`opt-${optIdx}`)?.focus()}
                            >
                              {opt.values.map(val => {
                                const swatch = getColorSwatch(val);
                                return (
                                  <span key={val} className="inline-flex items-center gap-1 bg-background border text-xs font-medium px-2 py-0.5 rounded-md shadow-sm">
                                    {swatch && optIdx === 0 && (
                                      <span className="w-3 h-3 rounded-full border border-black/10 shrink-0" style={{ background: swatch }} />
                                    )}
                                    {val}
                                    <button type="button" onClick={() => removeOptionValue(optIdx, val)}
                                      className="ml-0.5 text-muted-foreground hover:text-destructive transition-colors">
                                      <X className="h-2.5 w-2.5" />
                                    </button>
                                  </span>
                                );
                              })}
                              <input
                                id={`opt-${optIdx}`}
                                value={opt.inputValue}
                                onChange={e => updateOptionValue(optIdx, "inputValue", e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addOptionValue(optIdx); }
                                }}
                                onBlur={() => opt.inputValue.trim() && addOptionValue(optIdx)}
                                placeholder={opt.values.length === 0 ? `Add ${opt.name.toLowerCase()} values...` : ""}
                                className="flex-1 min-w-[120px] bg-transparent outline-none text-xs placeholder:text-muted-foreground"
                              />
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <Button type="button" size="sm" onClick={generateVariants}
                          disabled={options.every(o => o.values.length === 0)} className="gap-1.5">
                          <Wand2 className="h-3.5 w-3.5" />
                          Generate variants
                        </Button>
                        {variantsGenerated && (
                          <Button type="button" variant="outline" size="sm" onClick={autoSkuAll} className="gap-1.5">
                            <Wand2 className="h-3.5 w-3.5" />
                            Auto-SKU all
                          </Button>
                        )}
                        {variants.length > 0 && (
                          <span className="text-xs text-muted-foreground">
                            {variants.length} variant{variants.length !== 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                    </div>

                    {variantsGenerated && variants.length > 0 && (
                      <>
                        <Separator />
                        {/* Bulk actions bar */}
                        <div className="px-6 py-2.5 bg-muted/30 border-b flex flex-wrap items-center gap-2">
                          <span className="text-[11px] font-semibold text-muted-foreground mr-0.5">Bulk edit:</span>
                          <Input value={bulkPrice} onChange={e => setBulkPrice(e.target.value)} placeholder="Price" type="number" className="h-7 w-20 text-xs" />
                          <Input value={bulkCompareAt} onChange={e => setBulkCompareAt(e.target.value)} placeholder="Sale price" type="number" className="h-7 w-24 text-xs" />
                          <Input value={bulkStock} onChange={e => setBulkStock(e.target.value)} placeholder="Stock" type="number" className="h-7 w-20 text-xs" />
                          <Input value={bulkSkuPrefix} onChange={e => setBulkSkuPrefix(e.target.value)} placeholder="SKU prefix" className="h-7 w-28 text-xs" />
                          <Button type="button" variant="secondary" size="sm" className="h-7 text-xs px-3" onClick={applyBulk}
                            disabled={!bulkPrice && !bulkCompareAt && !bulkStock && !bulkSkuPrefix}>
                            Apply to all
                          </Button>
                        </div>

                        {/* Table header */}
                        <div className="grid items-center px-5 py-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide border-b bg-muted/20 select-none"
                          style={{ gridTemplateColumns: "1.25rem 1fr 7.5rem 5.5rem 5.5rem 4rem 5rem 2rem" }}>
                          <span />
                          <span>Variant</span>
                          <span>SKU</span>
                          <span>Price</span>
                          <span>Sale price</span>
                          <span>Qty</span>
                          <span>Status</span>
                          <span />
                        </div>

                        {/* Variant rows */}
                        {variants.map(v => (
                          <div key={v.temp_id} className="border-b last:border-b-0">
                            {/* Compact row */}
                            <div
                              className="grid items-center px-5 py-2.5 hover:bg-muted/20 cursor-pointer gap-3 transition-colors group"
                              style={{ gridTemplateColumns: "1.25rem 1fr 7.5rem 5.5rem 5.5rem 4rem 5rem 2rem" }}
                              onClick={() => toggleExpanded(v.temp_id)}
                            >
                              <ChevronRight className={cn("h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform duration-150", v.expanded && "rotate-90")} />

                              <div className="flex items-center gap-2 min-w-0">
                                {getColorSwatch(v.color) && (
                                  <span className="w-4 h-4 rounded-full border border-black/10 shrink-0 shadow-sm"
                                    style={{ background: getColorSwatch(v.color)! }} />
                                )}
                                <span className="text-sm font-medium truncate">{v.label}</span>
                              </div>

                              <span className="text-xs text-muted-foreground font-mono truncate">
                                {v.sku || <span className="italic opacity-40">—</span>}
                              </span>
                              <span className="text-sm tabular-nums">{v.price_override != null ? `₹${v.price_override}` : <span className="text-muted-foreground/50">—</span>}</span>
                              <span className="text-sm text-muted-foreground tabular-nums">{v.compare_at_price != null ? `₹${v.compare_at_price}` : <span className="opacity-40">—</span>}</span>
                              <span className="text-sm tabular-nums">{v.stock_quantity}</span>
                              <span className={cn(
                                "text-[11px] px-2 py-0.5 rounded-full font-medium inline-flex items-center w-fit gap-1",
                                v.status === "active"
                                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                                  : "bg-muted text-muted-foreground"
                              )}>
                                <span className={cn("w-1.5 h-1.5 rounded-full", v.status === "active" ? "bg-emerald-500" : "bg-muted-foreground/50")} />
                                {v.status}
                              </span>
                              <button
                                type="button"
                                onClick={e => { e.stopPropagation(); deleteVariant(v.temp_id); }}
                                className="h-6 w-6 flex items-center justify-center rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>

                            {/* Expanded detail card */}
                            {v.expanded && (
                              <div className="mx-5 mb-4 rounded-xl border bg-muted/20 p-5 space-y-4">
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                                  {/* SKU */}
                                  <div className="space-y-1.5">
                                    <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">SKU *</Label>
                                    <div className="flex gap-1.5">
                                      <Input value={v.sku} onChange={e => updateVariant(v.temp_id, "sku", e.target.value)}
                                        placeholder="Unique identifier" className="h-8 text-xs font-mono flex-1" />
                                      <Button type="button" variant="outline" size="sm" className="h-8 px-2 text-xs shrink-0"
                                        onClick={() => {
                                          const idx = variants.findIndex(x => x.temp_id === v.temp_id);
                                          updateVariant(v.temp_id, "sku", generateSku(form.name, v.color, v.size, idx));
                                        }}>
                                        Auto
                                      </Button>
                                    </div>
                                  </div>

                                  {/* Barcode */}
                                  <div className="space-y-1.5">
                                    <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Barcode / ISBN</Label>
                                    <Input value={v.barcode} onChange={e => updateVariant(v.temp_id, "barcode", e.target.value)}
                                      placeholder="Optional" className="h-8 text-xs" />
                                  </div>

                                  {/* Weight */}
                                  <div className="space-y-1.5">
                                    <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Weight (kg)</Label>
                                    <Input type="number" value={v.weight} onChange={e => updateVariant(v.temp_id, "weight", e.target.value)}
                                      placeholder="0.5" className="h-8 text-xs" />
                                  </div>

                                  {/* Price override */}
                                  <div className="space-y-1.5">
                                    <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Price (₹)</Label>
                                    <Input type="number"
                                      value={v.price_override ?? ""}
                                      onChange={e => updateVariant(v.temp_id, "price_override", e.target.value ? Number(e.target.value) : null)}
                                      placeholder="Override base price" className="h-8 text-xs" />
                                  </div>

                                  {/* Compare at */}
                                  <div className="space-y-1.5">
                                    <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Compare-at (₹)</Label>
                                    <Input type="number"
                                      value={v.compare_at_price ?? ""}
                                      onChange={e => updateVariant(v.temp_id, "compare_at_price", e.target.value ? Number(e.target.value) : null)}
                                      placeholder="Original for sale badge" className="h-8 text-xs" />
                                  </div>

                                  {/* Stock */}
                                  <div className="space-y-1.5">
                                    <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Inventory</Label>
                                    <Input type="number" value={v.stock_quantity}
                                      onChange={e => updateVariant(v.temp_id, "stock_quantity", Number(e.target.value) || 0)}
                                      className="h-8 text-xs" />
                                  </div>

                                  {/* Low stock threshold */}
                                  <div className="space-y-1.5">
                                    <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Low stock alert</Label>
                                    <Input type="number" value={v.low_stock_threshold}
                                      onChange={e => updateVariant(v.temp_id, "low_stock_threshold", Number(e.target.value) || 0)}
                                      className="h-8 text-xs" />
                                  </div>

                                  {/* Track inventory */}
                                  <div className="space-y-1.5">
                                    <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Track inventory</Label>
                                    <div className="flex items-center gap-2 h-8">
                                      <Switch checked={v.track_inventory} onCheckedChange={val => updateVariant(v.temp_id, "track_inventory", val)} />
                                      <span className="text-xs text-muted-foreground">{v.track_inventory ? "Tracked" : "Not tracked"}</span>
                                    </div>
                                  </div>

                                  {/* Variant status */}
                                  <div className="space-y-1.5">
                                    <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Status</Label>
                                    <Select value={v.status} onValueChange={val => updateVariant(v.temp_id, "status", val as "active" | "draft")}>
                                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="active">Active</SelectItem>
                                        <SelectItem value="draft">Draft</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>

                                {/* Variant images */}
                                <div className="space-y-2 pt-1">
                                  <div className="flex items-center justify-between">
                                    <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                      Variant images ({v.images.length}/5)
                                    </Label>
                                    <div className="flex items-center gap-2">
                                      {form.images.length > 0 && (
                                        <button type="button" className="text-[11px] text-primary hover:underline"
                                          onClick={() => updateVariant(v.temp_id, "images", form.images.slice(0, 5))}>
                                          Use product images
                                        </button>
                                      )}
                                      <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1"
                                        onClick={() => variantFileRefs.current[v.temp_id]?.click()}
                                        disabled={v.images.length >= 5 || uploading}>
                                        <Upload className="h-3 w-3" /> Upload
                                      </Button>
                                    </div>
                                  </div>
                                  <div className="flex gap-2 flex-wrap">
                                    {v.images.map((url, imgIdx) => (
                                      <div key={imgIdx} className="relative group w-14 h-14 rounded-lg overflow-hidden border shadow-sm">
                                        <img src={url} alt="" className="w-full h-full object-cover" />
                                        <button type="button"
                                          onClick={() => updateVariant(v.temp_id, "images", v.images.filter((_, i) => i !== imgIdx))}
                                          className="absolute top-0.5 right-0.5 bg-red-500 text-white rounded p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                          <X className="h-2.5 w-2.5" />
                                        </button>
                                      </div>
                                    ))}
                                    {v.images.length === 0 && (
                                      <div className="w-14 h-14 rounded-lg border-2 border-dashed flex items-center justify-center">
                                        <Image className="h-5 w-5 text-muted-foreground/30" />
                                      </div>
                                    )}
                                  </div>
                                  <input ref={el => { variantFileRefs.current[v.temp_id] = el; }}
                                    type="file" accept="image/*" multiple className="hidden"
                                    onChange={e => e.target.files && uploadVariantImages(v.temp_id, Array.from(e.target.files))} />
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </>
                    )}
                  </>
                )}

                {/* No variants: simple stock */}
                {!hasVariants && (
                  <div className="px-6 pb-6">
                    <Separator className="mb-5" />
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Stock quantity</Label>
                        <Input type="number" placeholder="0" className="h-9 text-sm" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Low stock alert</Label>
                        <Input type="number" placeholder="5" className="h-9 text-sm" />
                      </div>
                    </div>
                  </div>
                )}
              </section>
            </div>

            {/* ────── RIGHT SIDEBAR ────── */}
            <div className="space-y-4">
              <div className="lg:sticky lg:top-[60px] space-y-4">

                {/* Status */}
                <div className="bg-card rounded-xl border shadow-sm p-5 space-y-3">
                  <h3 className="text-sm font-semibold">Status</h3>
                  <Select value={form.status} onValueChange={v => updateForm("status", v as ProductForm["status"])}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">
                        <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-muted-foreground" />Draft</div>
                      </SelectItem>
                      <SelectItem value="active">
                        <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-500" />Active</div>
                      </SelectItem>
                      <SelectItem value="archived">
                        <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-orange-400" />Archived</div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">
                    {form.status === "active" ? "Visible to customers on your store." : form.status === "draft" ? "Hidden from store. Save progress freely." : "Removed from store listings."}
                  </p>
                </div>

                {/* Pricing */}
                <div className="bg-card rounded-xl border shadow-sm p-5 space-y-3">
                  <h3 className="text-sm font-semibold">Pricing</h3>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Base price (₹)</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₹</span>
                      <Input type="number" value={form.base_price || ""}
                        onChange={e => updateForm("base_price", Number(e.target.value) || 0)}
                        placeholder="0.00" className="pl-7 h-9 text-sm" />
                    </div>
                    <p className="text-[11px] text-muted-foreground">Individual variants can override this price.</p>
                  </div>
                </div>

                {/* Organization */}
                <div className="bg-card rounded-xl border shadow-sm p-5 space-y-4">
                  <h3 className="text-sm font-semibold">Organization</h3>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Category</Label>
                    <Select value={form.category_id} onValueChange={v => updateForm("category_id", v)}>
                      <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select category" /></SelectTrigger>
                      <SelectContent>
                        {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Brand / Vendor</Label>
                    <Input value={form.brand} onChange={e => updateForm("brand", e.target.value)}
                      placeholder="e.g. Dapperr" className="h-9 text-sm" />
                  </div>
                </div>

                {/* Live preview */}
                <div className="bg-card rounded-xl border shadow-sm p-5 space-y-3">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    Live preview
                  </h3>
                  <div className="rounded-xl overflow-hidden border bg-muted/20">
                    {form.images[0]
                      ? <img src={form.images[0]} alt="" className="w-full aspect-square object-cover" />
                      : (
                        <div className="aspect-square flex flex-col items-center justify-center gap-2 bg-muted/30">
                          <Image className="h-10 w-10 text-muted-foreground/20" />
                          <span className="text-xs text-muted-foreground/50">No image yet</span>
                        </div>
                      )
                    }
                    <div className="p-3.5">
                      <p className="font-semibold text-sm leading-snug">
                        {form.name || <span className="text-muted-foreground/50 italic font-normal">Product name</span>}
                      </p>
                      {form.brand && <p className="text-xs text-muted-foreground mt-0.5">{form.brand}</p>}
                      <p className="text-base font-bold mt-1.5">
                        {form.base_price > 0
                          ? `₹${form.base_price.toLocaleString("en-IN")}`
                          : <span className="text-sm text-muted-foreground/50 font-normal italic">No price set</span>}
                      </p>

                      {variantsGenerated && options[0]?.values.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2.5">
                          {options[0].values.slice(0, 6).map(val => {
                            const sw = getColorSwatch(val);
                            return (
                              <span key={val} className="inline-flex items-center gap-1 border rounded-full px-2 py-0.5 text-[11px] bg-background shadow-sm">
                                {sw && <span className="w-2.5 h-2.5 rounded-full border border-black/10" style={{ background: sw }} />}
                                {val}
                              </span>
                            );
                          })}
                          {options[1]?.values.slice(0, 6).map(val => (
                            <span key={val} className="border rounded-full px-2 py-0.5 text-[11px] bg-background shadow-sm">{val}</span>
                          ))}
                        </div>
                      )}

                      <div className={cn(
                        "mt-2.5 text-[11px] font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-1.5 w-fit",
                        form.status === "active" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                          : form.status === "archived" ? "bg-orange-100 text-orange-700" : "bg-muted text-muted-foreground"
                      )}>
                        <span className={cn("w-1.5 h-1.5 rounded-full",
                          form.status === "active" ? "bg-emerald-500" : form.status === "archived" ? "bg-orange-400" : "bg-muted-foreground/50"
                        )} />
                        {form.status}
                      </div>
                    </div>
                  </div>

                  {variants.length > 0 && variantsGenerated && (
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span><span className="font-semibold text-foreground">{variants.length}</span> variant{variants.length !== 1 ? "s" : ""}</span>
                      <span><span className="font-semibold text-foreground">{totalStock}</span> in stock</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Sticky footer ── */}
      <div className="sticky bottom-0 z-20 border-t bg-card/95 backdrop-blur-sm shadow-[0_-1px_0_0_hsl(var(--border))]">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {variantsGenerated && variants.length > 0 ? (
              <span className="flex items-center gap-1.5">
                <BarChart3 className="h-3.5 w-3.5" />
                {variants.length} variant{variants.length !== 1 ? "s" : ""}
                {missingSku > 0 && (
                  <span className="flex items-center gap-1 text-amber-600 font-medium ml-1">
                    <AlertCircle className="h-3 w-3" /> {missingSku} missing SKU
                  </span>
                )}
              </span>
            ) : (
              <span className="flex items-center gap-1.5"><Package className="h-3.5 w-3.5" />Simple product</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate("/admin/products")} className="text-muted-foreground">
              Cancel
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleSave("draft")} disabled={saving}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
              Save draft
            </Button>
            <Button size="sm" onClick={() => handleSave("active")} disabled={saving} className="min-w-[100px]">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
              Publish product
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
