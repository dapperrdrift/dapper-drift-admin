import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ShoppingCart, Package, DollarSign, AlertTriangle } from "lucide-react";

interface Stats {
  totalOrders: number;
  totalRevenue: number;
  totalProducts: number;
  lowStockCount: number;
}

export default function DashboardHome() {
  const [stats, setStats] = useState<Stats>({ totalOrders: 0, totalRevenue: 0, totalProducts: 0, lowStockCount: 0 });
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      const [ordersRes, productsRes, variantsRes, revenueRes, recentRes] = await Promise.all([
        supabase.from("orders").select("id", { count: "exact", head: true }),
        supabase.from("products").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("variants").select("id, stock_quantity, low_stock_threshold"),
        supabase.from("orders").select("total_amount").eq("status", "delivered"),
        supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(5),
      ]);

      const lowStock = (variantsRes.data || []).filter(v => v.stock_quantity <= v.low_stock_threshold);
      const revenue = (revenueRes.data || []).reduce((sum, o) => sum + Number(o.total_amount), 0);

      setStats({
        totalOrders: ordersRes.count || 0,
        totalProducts: productsRes.count || 0,
        lowStockCount: lowStock.length,
        totalRevenue: revenue,
      });
      setRecentOrders(recentRes.data || []);
      setLoading(false);
    };
    fetchStats();
  }, []);

  if (loading) return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-40" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-5 w-5 rounded" />
            </CardHeader>
            <CardContent><Skeleton className="h-8 w-20" /></CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader><Skeleton className="h-6 w-32" /></CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-center justify-between border-b pb-2">
              <div className="space-y-1"><Skeleton className="h-4 w-24" /><Skeleton className="h-3 w-16" /></div>
              <div className="space-y-1 text-right"><Skeleton className="h-4 w-16" /><Skeleton className="h-4 w-14" /></div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );

  const cards = [
    { title: "Total Orders", value: stats.totalOrders, icon: ShoppingCart, color: "text-chart-4" },
    { title: "Revenue (Delivered)", value: `₹${stats.totalRevenue.toLocaleString()}`, icon: DollarSign, color: "text-chart-3" },
    { title: "Active Products", value: stats.totalProducts, icon: Package, color: "text-chart-1" },
    { title: "Low Stock Alerts", value: stats.lowStockCount, icon: AlertTriangle, color: "text-chart-2" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(c => (
          <Card key={c.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{c.title}</CardTitle>
              <c.icon className={`h-5 w-5 ${c.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{c.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader><CardTitle className="text-lg">Recent Orders</CardTitle></CardHeader>
        <CardContent>
          {recentOrders.length === 0 ? (
            <p className="text-muted-foreground text-sm">No orders yet.</p>
          ) : (
            <div className="space-y-2">
              {recentOrders.map(o => (
                <div key={o.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                  <div>
                    <p className="text-sm font-medium">{o.id.slice(0, 8)}...</p>
                    <p className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleDateString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">₹{Number(o.total_amount).toLocaleString()}</p>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary capitalize">{o.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
