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
