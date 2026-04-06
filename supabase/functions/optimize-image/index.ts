import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { Image } from "https://deno.land/x/imagescript@1.2.15/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALLOWED_BUCKETS = new Set(["product-images", "category-images", "hero-images"]);
const MAX_UPLOAD_SIZE_BYTES = 8 * 1024 * 1024;
const MAX_IMAGE_SIDE = 1600;

function sanitizeFolder(raw: string | null): string {
  if (!raw) return "";
  return raw.replace(/[^a-zA-Z0-9/_-]/g, "").replace(/^\/+|\/+$/g, "");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const formData = await req.formData();
    const file = formData.get("file");
    const bucket = String(formData.get("bucket") || "product-images");
    const folder = sanitizeFolder(formData.get("folder")?.toString() || null);

    if (!(file instanceof File)) {
      return new Response(JSON.stringify({ error: "No file provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!ALLOWED_BUCKETS.has(bucket)) {
      return new Response(JSON.stringify({ error: "Unsupported bucket" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!file.type.startsWith("image/")) {
      return new Response(JSON.stringify({ error: "File must be an image" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      return new Response(JSON.stringify({ error: "Image must be below 8MB" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fileBytes = new Uint8Array(await file.arrayBuffer());
    const decoded = await Image.decode(fileBytes);
    if (decoded.width > MAX_IMAGE_SIDE || decoded.height > MAX_IMAGE_SIDE) {
      decoded.contain(MAX_IMAGE_SIDE, MAX_IMAGE_SIDE);
    }

    // JPEG encoding keeps storage size predictable while preserving quality.
    const optimizedBytes = await decoded.encodeJPEG(82);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !supabaseAnonKey) {
      return new Response(JSON.stringify({ error: "Supabase env not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const filePath = `${folder ? `${folder}/` : ""}${crypto.randomUUID()}.jpg`;
    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(filePath, optimizedBytes, {
        contentType: "image/jpeg",
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      return new Response(JSON.stringify({ error: uploadError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(filePath);

    return new Response(JSON.stringify({ path: filePath, publicUrl: publicUrlData.publicUrl }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unexpected error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
