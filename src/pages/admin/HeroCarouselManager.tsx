import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Upload, X, Loader2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

interface HeroSlide {
  id: string;
  image_url: string;
  overlay_text: string | null;
  link_url: string | null;
  display_order: number;
  is_active: boolean;
}

export default function HeroCarouselManager() {
  const [slides, setSlides] = useState<HeroSlide[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<HeroSlide | null>(null);
  const [form, setForm] = useState({ image_url: "", overlay_text: "", link_url: "" });
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const fetchSlides = async () => {
    const { data } = await supabase.from("hero_slides").select("*").order("display_order");
    setSlides(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchSlides(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ image_url: "", overlay_text: "", link_url: "" });
    setPreviewUrl(null);
    setDialogOpen(true);
  };

  const openEdit = (s: HeroSlide) => {
    setEditing(s);
    setForm({ image_url: s.image_url, overlay_text: s.overlay_text || "", link_url: s.link_url || "" });
    setPreviewUrl(s.image_url);
    setDialogOpen(true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please upload an image file.", variant: "destructive" });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max file size is 5MB.", variant: "destructive" });
      return;
    }

    setUploading(true);
    const fileExt = file.name.split(".").pop();
    const filePath = `${crypto.randomUUID()}.${fileExt}`;

    const { error } = await supabase.storage.from("hero-images").upload(filePath, file);
    if (error) {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from("hero-images").getPublicUrl(filePath);
    setForm(prev => ({ ...prev, image_url: urlData.publicUrl }));
    setPreviewUrl(urlData.publicUrl);
    setUploading(false);
    toast({ title: "Image uploaded" });
  };

  const removeImage = () => {
    setForm(prev => ({ ...prev, image_url: "" }));
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSave = async () => {
    if (!form.image_url) {
      toast({ title: "Image required", description: "Please upload an image.", variant: "destructive" });
      return;
    }
    const payload = {
      image_url: form.image_url,
      overlay_text: form.overlay_text || null,
      link_url: form.link_url || null,
      display_order: editing ? editing.display_order : slides.length,
    };
    if (editing) {
      await supabase.from("hero_slides").update(payload).eq("id", editing.id);
      toast({ title: "Slide updated" });
    } else {
      await supabase.from("hero_slides").insert(payload);
      toast({ title: "Slide added" });
    }
    setDialogOpen(false);
    fetchSlides();
  };

  const toggleActive = async (s: HeroSlide) => {
    await supabase.from("hero_slides").update({ is_active: !s.is_active }).eq("id", s.id);
    fetchSlides();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("hero_slides").delete().eq("id", id);
    toast({ title: "Slide deleted" });
    fetchSlides();
  };

  const moveSlide = async (index: number, direction: "up" | "down") => {
    if ((direction === "up" && index === 0) || (direction === "down" && index === slides.length - 1)) return;
    const newSlides = [...slides];
    const swapIdx = direction === "up" ? index - 1 : index + 1;
    [newSlides[index], newSlides[swapIdx]] = [newSlides[swapIdx], newSlides[index]];
    await Promise.all(newSlides.map((s, i) => supabase.from("hero_slides").update({ display_order: i }).eq("id", s.id)));
    fetchSlides();
  };

  if (loading) return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-32" />
      </div>
      {[1, 2, 3].map(i => (
        <Card key={i}><CardContent className="flex items-center gap-4 p-4">
          <Skeleton className="w-8 h-16" />
          <Skeleton className="w-32 h-20 rounded" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-6 w-10" />
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-8" />
        </CardContent></Card>
      ))}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Hero Carousel</h1>
        <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Add Slide</Button>
      </div>
      <div className="grid gap-4">
        {slides.map((s, i) => (
          <Card key={s.id} className={!s.is_active ? "opacity-50" : ""}>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex flex-col gap-1">
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveSlide(i, "up")}>↑</Button>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveSlide(i, "down")}>↓</Button>
              </div>
              <img src={s.image_url} alt="" className="w-32 h-20 object-cover rounded" />
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{s.overlay_text || "No overlay text"}</p>
                <p className="text-xs text-muted-foreground truncate">{s.image_url}</p>
              </div>
              <Switch checked={s.is_active} onCheckedChange={() => toggleActive(s)} />
              <Button variant="ghost" size="icon" onClick={() => openEdit(s)}><Pencil className="h-4 w-4" /></Button>
              <AlertDialog>
                <AlertDialogTrigger asChild><Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive" /></Button></AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader><AlertDialogTitle>Delete slide?</AlertDialogTitle><AlertDialogDescription>This will permanently remove this slide.</AlertDialogDescription></AlertDialogHeader>
                  <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleDelete(s.id)}>Delete</AlertDialogAction></AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
        ))}
        {slides.length === 0 && <p className="text-center text-muted-foreground py-8">No hero slides yet.</p>}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit Slide" : "Add Slide"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Image</Label>
              {previewUrl ? (
                <div className="relative inline-block">
                  <img src={previewUrl} alt="Preview" className="w-full max-h-48 object-cover rounded border" />
                  <Button variant="destructive" size="icon" className="absolute top-1 right-1 h-6 w-6" onClick={removeImage}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <div
                  className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploading ? (
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">Uploading...</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <Upload className="h-8 w-8 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">Click to upload image</p>
                      <p className="text-xs text-muted-foreground">Max 5MB • JPG, PNG, WebP</p>
                    </div>
                  )}
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileUpload}
              />
            </div>
            <div className="space-y-2"><Label>Overlay Text (optional)</Label><Input value={form.overlay_text} onChange={e => setForm({ ...form, overlay_text: e.target.value })} /></div>
            <div className="space-y-2"><Label>Link URL (optional)</Label><Input value={form.link_url} onChange={e => setForm({ ...form, link_url: e.target.value })} /></div>
            <Button className="w-full" onClick={handleSave} disabled={uploading}>{editing ? "Update" : "Add"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
