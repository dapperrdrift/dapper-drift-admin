import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Search, Trash2, Upload, X, Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { uploadOptimizedImage } from "@/lib/optimizedUpload";
import { AdminTablePagination } from "@/components/AdminTablePagination";

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  created_at: string;
}

const PAGE_SIZE = 10;

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export default function CategoryManagement() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    slug: "",
    description: "",
    image_url: "",
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);

    return () => clearTimeout(timer);
  }, [search]);

  const fetchCategories = useCallback(async () => {
    setLoading(true);

    let query = supabase
      .from("categories")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false });

    if (debouncedSearch) {
      const term = debouncedSearch.replace(/,/g, " ");
      query = query.or(`name.ilike.%${term}%,slug.ilike.%${term}%,description.ilike.%${term}%`);
    }

    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data, error, count } = await query.range(from, to);

    if (error) {
      toast({ title: "Failed to load categories", description: error.message, variant: "destructive" });
      setCategories([]);
      setTotalCount(0);
      setLoading(false);
      return;
    }

    setCategories(data || []);
    setTotalCount(count || 0);
    setLoading(false);
  }, [debouncedSearch, page, toast]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", slug: "", description: "", image_url: "" });
    setDialogOpen(true);
  };

  const openEdit = (category: Category) => {
    setEditing(category);
    setForm({
      name: category.name,
      slug: category.slug,
      description: category.description || "",
      image_url: category.image_url || "",
    });
    setDialogOpen(true);
  };

  const uploadImage = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid image", description: "Please choose an image file.", variant: "destructive" });
      return;
    }

    try {
      setUploading(true);
      const publicUrl = await uploadOptimizedImage(file, {
        bucket: "category-images",
        folder: "categories",
      });
      setForm((prev) => ({ ...prev, image_url: publicUrl }));
      toast({ title: "Image optimized and uploaded" });
    } catch (error) {
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Unexpected error",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleSave = async () => {
    const name = form.name.trim();
    const slug = (form.slug.trim() || slugify(name)).trim();

    if (!name) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }

    if (!slug) {
      toast({ title: "Slug is required", variant: "destructive" });
      return;
    }

    const payload = {
      name,
      slug,
      description: form.description.trim() || null,
      image_url: form.image_url || null,
    };

    if (editing) {
      const { error } = await supabase.from("categories").update(payload).eq("id", editing.id);
      if (error) {
        toast({ title: "Update failed", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: "Category updated" });
    } else {
      const { error } = await supabase.from("categories").insert(payload);
      if (error) {
        toast({ title: "Create failed", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: "Category created" });
    }

    setDialogOpen(false);
    fetchCategories();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Category deleted" });
    const isLastItemOnPage = categories.length === 1 && page > 1;
    if (isLastItemOnPage) {
      setPage((prev) => prev - 1);
      return;
    }
    fetchCategories();
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-36" />
          <Skeleton className="h-10 w-36" />
        </div>
        <Skeleton className="h-10 w-full" />
        <div className="rounded-md border p-4 space-y-3">
          {[1, 2, 3, 4, 5].map((item) => (
            <div key={item} className="flex items-center gap-4">
              <Skeleton className="h-10 w-10 rounded" />
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-5 flex-1" />
              <Skeleton className="h-8 w-20 ml-auto" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Categories</h1>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Add Category
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search by name, slug, or description..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Image</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.map((category) => (
              <TableRow key={category.id}>
                <TableCell>
                  {category.image_url ? (
                    <img src={category.image_url} alt={category.name} className="h-10 w-10 rounded object-cover border" />
                  ) : (
                    <div className="h-10 w-10 rounded border bg-muted/50" />
                  )}
                </TableCell>
                <TableCell className="font-medium">{category.name}</TableCell>
                <TableCell className="font-mono text-xs">{category.slug}</TableCell>
                <TableCell className="max-w-[360px] truncate text-muted-foreground">
                  {category.description || "-"}
                </TableCell>
                <TableCell className="text-right space-x-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(category)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete category?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will remove "{category.name}" from the catalog.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(category.id)}>Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </TableCell>
              </TableRow>
            ))}
            {categories.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  No categories found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        <AdminTablePagination page={page} totalPages={totalPages} onPageChange={setPage} />
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Category" : "Add Category"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(event) => {
                  const name = event.target.value;
                  setForm((prev) => ({
                    ...prev,
                    name,
                    slug: editing ? prev.slug : slugify(name),
                  }));
                }}
              />
            </div>

            <div className="space-y-2">
              <Label>Slug</Label>
              <Input
                value={form.slug}
                onChange={(event) => setForm((prev) => ({ ...prev, slug: slugify(event.target.value) }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Category Image</Label>
              <div className="flex items-start gap-3">
                {form.image_url ? (
                  <div className="relative">
                    <img src={form.image_url} alt="Category" className="h-20 w-20 rounded border object-cover" />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute -right-2 -top-2 h-5 w-5"
                      onClick={() => setForm((prev) => ({ ...prev, image_url: "" }))}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="h-20 w-20 rounded border-2 border-dashed flex items-center justify-center hover:border-primary/50"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {uploading ? (
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    ) : (
                      <Upload className="h-5 w-5 text-muted-foreground" />
                    )}
                  </button>
                )}

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? "Optimizing..." : "Upload Image"}
                </Button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="image/*"
                onChange={uploadImage}
              />
            </div>

            <Button className="w-full" onClick={handleSave} disabled={uploading}>
              {editing ? "Update" : "Create"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
