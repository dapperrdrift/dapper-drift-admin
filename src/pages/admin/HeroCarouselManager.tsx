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
import { Plus, Pencil, Trash2, Upload, X, Loader2, Info, Film } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { uploadOptimizedImage, uploadHeroVideo } from "@/lib/optimizedUpload";

interface HeroSlide {
  id: string;
  image_url: string;
  video_url: string | null;
  media_type: string; // "image" | "video"
  overlay_text: string | null;
  link_url: string | null;
  display_order: number;
  is_active: boolean;
}

interface SlideForm {
  image_url: string;
  video_url: string;
  media_type: "image" | "video";
  overlay_text: string;
  link_url: string;
}

const emptyForm: SlideForm = { image_url: "", video_url: "", media_type: "image", overlay_text: "", link_url: "" };

export default function HeroCarouselManager() {
  const [slides, setSlides] = useState<HeroSlide[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<HeroSlide | null>(null);
  const [form, setForm] = useState<SlideForm>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadingPoster, setUploadingPoster] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const posterInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const fetchSlides = async () => {
    const { data } = await supabase.from("hero_slides").select("*").order("display_order");
    setSlides((data as HeroSlide[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchSlides(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (s: HeroSlide) => {
    setEditing(s);
    setForm({
      image_url: s.image_url || "",
      video_url: s.video_url || "",
      media_type: s.media_type === "video" ? "video" : "image",
      overlay_text: s.overlay_text || "",
      link_url: s.link_url || "",
    });
    setDialogOpen(true);
  };

  // Handles the main media file — accepts both images and videos.
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isVideo = file.type.startsWith("video/");
    const isImage = file.type.startsWith("image/");

    if (!isVideo && !isImage) {
      toast({ title: "Invalid file", description: "Please upload an image or video file.", variant: "destructive" });
      return;
    }

    const maxBytes = isVideo ? 50 * 1024 * 1024 : 8 * 1024 * 1024;
    if (file.size > maxBytes) {
      toast({
        title: "File too large",
        description: isVideo ? "Max video size is 50MB." : "Max image size is 8MB.",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    try {
      if (isVideo) {
        const publicUrl = await uploadHeroVideo(file);
        setForm((prev) => ({ ...prev, video_url: publicUrl, media_type: "video" }));
        toast({ title: "Video uploaded", description: "Add an optional poster image for faster loading." });
      } else {
        const publicUrl = await uploadOptimizedImage(file, { bucket: "hero-images", folder: "hero" });
        setForm((prev) => ({ ...prev, image_url: publicUrl, media_type: "image" }));
        toast({ title: "Image optimized and uploaded" });
      }
    } catch (error) {
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Unexpected error",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Optional poster image for a video slide (shown before the video plays).
  const handlePosterUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Poster must be an image.", variant: "destructive" });
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max poster size is 8MB.", variant: "destructive" });
      return;
    }
    setUploadingPoster(true);
    try {
      const publicUrl = await uploadOptimizedImage(file, { bucket: "hero-images", folder: "hero" });
      setForm((prev) => ({ ...prev, image_url: publicUrl }));
      toast({ title: "Poster uploaded" });
    } catch (error) {
      toast({ title: "Upload failed", description: error instanceof Error ? error.message : "Unexpected error", variant: "destructive" });
    } finally {
      setUploadingPoster(false);
      if (posterInputRef.current) posterInputRef.current.value = "";
    }
  };

  const removeMedia = () => {
    setForm((prev) => ({ ...prev, image_url: "", video_url: "", media_type: "image" }));
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (posterInputRef.current) posterInputRef.current.value = "";
  };

  const hasMedia = form.media_type === "video" ? !!form.video_url : !!form.image_url;

  const handleSave = async () => {
    if (!hasMedia) {
      toast({ title: "Media required", description: "Please upload an image or video.", variant: "destructive" });
      return;
    }
    const payload = {
      // image_url is NOT NULL in the DB — for a video slide without a poster we store "".
      image_url: form.image_url || "",
      video_url: form.media_type === "video" ? (form.video_url || null) : null,
      media_type: form.media_type,
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

      <div className="flex gap-3 rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
        <Info className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
        <p>
          The banner fills the whole screen behind the headline and is cropped to fit (object-cover)
          on every device, so no single file is pixel-perfect everywhere. Upload a
          <span className="font-medium text-foreground"> 16:9 landscape file at 1920×1080 px</span> (or 2560×1440
          for sharper screens) and keep the subject and any text in the
          <span className="font-medium text-foreground"> centered vertical “safe zone” (middle ~60%)</span>. Phones
          (portrait ~9:19.5) crop the left/right edges heavily, tablets (~4:3/3:4) crop them moderately, and desktops
          (~16:9) crop the top/bottom — so never place key details near the edges. Videos use the same 16:9 / 1920×1080
          frame: MP4 (H.264), ≤50MB, and they autoplay <span className="font-medium text-foreground">muted</span> on loop.
        </p>
      </div>

      <div className="grid gap-4">
        {slides.map((s, i) => (
          <Card key={s.id} className={!s.is_active ? "opacity-50" : ""}>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex flex-col gap-1">
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveSlide(i, "up")}>↑</Button>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveSlide(i, "down")}>↓</Button>
              </div>
              {s.media_type === "video" && !s.image_url ? (
                <video src={s.video_url ?? undefined} muted className="w-32 h-20 object-cover rounded bg-black" />
              ) : (
                <img src={s.image_url} alt="" className="w-32 h-20 object-cover rounded" />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate flex items-center gap-1.5">
                  {s.media_type === "video" && <Film className="h-3.5 w-3.5 shrink-0 text-primary" />}
                  {s.overlay_text || "No overlay text"}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {s.media_type === "video" ? (s.video_url || s.image_url) : s.image_url}
                </p>
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
            {/* Aspect-ratio guidance inside the modal (Task 1) */}
            <div className="flex gap-2 rounded-md border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
              <Info className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
              <p>
                <span className="font-semibold text-foreground">Aspect ratio: 16:9 (1920×1080 px).</span> This is the
                one ratio that fills desktop, tablet and phone with the least cropping. It is displayed full-screen and
                cropped to fit, so keep your subject/text centered. Phone crops sides ~9:19.5, tablet ~4:3, desktop crops
                top/bottom. Video: same 16:9 frame, MP4/WebM, ≤50MB, autoplays muted on loop.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Banner Media (image or video)</Label>
              {hasMedia ? (
                <div className="relative inline-block w-full">
                  {form.media_type === "video" ? (
                    <video
                      src={form.video_url}
                      poster={form.image_url || undefined}
                      className="w-full max-h-48 object-cover rounded border bg-black"
                      muted
                      loop
                      autoPlay
                      playsInline
                    />
                  ) : (
                    <img src={form.image_url} alt="Preview" className="w-full max-h-48 object-cover rounded border" />
                  )}
                  <Button variant="destructive" size="icon" className="absolute top-1 right-1 h-6 w-6" onClick={removeMedia}>
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
                      <p className="text-sm text-muted-foreground">Click to upload image or video</p>
                      <p className="text-xs text-muted-foreground">16:9 · 1920×1080 · subject centered</p>
                      <p className="text-xs text-muted-foreground">Image ≤8MB (JPG/PNG/WebP) · Video ≤50MB (MP4/WebM)</p>
                    </div>
                  )}
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/mp4,video/webm,video/quicktime"
                className="hidden"
                onChange={handleFileUpload}
              />
            </div>

            {/* Optional poster for video slides */}
            {form.media_type === "video" && form.video_url && (
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5 text-sm">
                  Poster image <span className="text-xs font-normal text-muted-foreground">(optional — shown while the video loads)</span>
                </Label>
                <div className="flex items-center gap-3">
                  {form.image_url && (
                    <img src={form.image_url} alt="Poster" className="h-12 w-20 object-cover rounded border" />
                  )}
                  <Button type="button" variant="outline" size="sm" disabled={uploadingPoster} onClick={() => posterInputRef.current?.click()}>
                    {uploadingPoster ? <Loader2 className="h-4 w-4 animate-spin" /> : (form.image_url ? "Replace poster" : "Add poster")}
                  </Button>
                </div>
                <input ref={posterInputRef} type="file" accept="image/*" className="hidden" onChange={handlePosterUpload} />
              </div>
            )}

            <div className="space-y-2"><Label>Overlay Text (optional)</Label><Input value={form.overlay_text} onChange={e => setForm({ ...form, overlay_text: e.target.value })} /></div>
            <div className="space-y-2"><Label>Link URL (optional)</Label><Input value={form.link_url} onChange={e => setForm({ ...form, link_url: e.target.value })} /></div>
            <Button className="w-full" onClick={handleSave} disabled={uploading || uploadingPoster}>{editing ? "Update" : "Add"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
