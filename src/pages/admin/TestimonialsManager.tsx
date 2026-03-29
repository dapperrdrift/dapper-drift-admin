import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Check, X, Star } from "lucide-react";

interface Testimonial {
  id: string;
  customer_name: string;
  content: string;
  rating: number;
  status: string;
  submitted_at: string;
}

export default function TestimonialsManager() {
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [filterStatus, setFilterStatus] = useState("all");
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchTestimonials = async () => {
    let query = supabase.from("testimonials").select("*").order("submitted_at", { ascending: false });
    if (filterStatus !== "all") query = query.eq("status", filterStatus as any);
    const { data } = await query;
    setTestimonials(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchTestimonials(); }, [filterStatus]);

  const updateStatus = async (id: string, status: "pending" | "approved" | "rejected") => {
    await supabase.from("testimonials").update({ status }).eq("id", id);
    toast({ title: `Testimonial ${status}` });
    fetchTestimonials();
  };

  const statusColor = (s: string) => {
    if (s === "approved") return "bg-green-100 text-green-700";
    if (s === "rejected") return "bg-red-100 text-red-700";
    return "bg-yellow-100 text-yellow-700";
  };

  if (loading) return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-10 w-[150px]" />
      </div>
      <div className="rounded-md border p-4 space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex items-center gap-4">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-5 flex-1" />
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-8 w-16" />
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Testimonials</h1>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Filter" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead>Content</TableHead>
              <TableHead>Rating</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {testimonials.map(t => (
              <TableRow key={t.id}>
                <TableCell className="font-medium">{t.customer_name}</TableCell>
                <TableCell className="max-w-xs truncate">{t.content}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: t.rating }).map((_, i) => (
                      <Star key={i} className="h-3 w-3 fill-warning text-warning" />
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${statusColor(t.status)}`}>
                    {t.status}
                  </span>
                </TableCell>
                <TableCell className="text-right space-x-1">
                  {t.status !== "approved" && (
                    <Button variant="ghost" size="icon" onClick={() => updateStatus(t.id, "approved")}>
                      <Check className="h-4 w-4 text-green-600" />
                    </Button>
                  )}
                  {t.status !== "rejected" && (
                    <Button variant="ghost" size="icon" onClick={() => updateStatus(t.id, "rejected")}>
                      <X className="h-4 w-4 text-red-600" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {testimonials.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No testimonials found.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
