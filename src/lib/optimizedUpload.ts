import { supabase } from "@/integrations/supabase/client";

interface UploadOptions {
  bucket: "product-images" | "category-images" | "hero-images";
  folder?: string;
}

export async function uploadOptimizedImage(file: File, options: UploadOptions): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("bucket", options.bucket);

  if (options.folder) {
    formData.append("folder", options.folder);
  }

  const { data, error } = await supabase.functions.invoke("optimize-image", {
    body: formData,
  });

  if (error) {
    throw new Error(error.message || "Image optimization failed");
  }

  const publicUrl = data?.publicUrl;
  if (!publicUrl || typeof publicUrl !== "string") {
    throw new Error("Image optimization returned an invalid URL");
  }

  return publicUrl;
}

/**
 * Uploads a video file directly to a public storage bucket (no optimization —
 * the optimize-image function only handles images). Returns the public URL.
 */
export async function uploadHeroVideo(file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "mp4";
  const path = `hero/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from("hero-videos")
    .upload(path, file, {
      cacheControl: "31536000",
      contentType: file.type || "video/mp4",
      upsert: false,
    });

  if (error) {
    throw new Error(error.message || "Video upload failed");
  }

  const { data } = supabase.storage.from("hero-videos").getPublicUrl(path);
  if (!data?.publicUrl) {
    throw new Error("Could not resolve uploaded video URL");
  }
  return data.publicUrl;
}
