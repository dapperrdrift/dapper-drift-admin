import {
  LayoutDashboard, Package, FolderTree, Warehouse, ShoppingCart, Ticket,
  Image, MessageSquareQuote, Mail, LogOut, Settings,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/hooks/useAuth";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarFooter, SidebarHeader, useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import logo from "@/assets/logo.svg";

const navItems = [
  { title: "Dashboard", url: "/admin", icon: LayoutDashboard },
  { title: "Products", url: "/admin/products", icon: Package },
  { title: "Categories", url: "/admin/categories", icon: FolderTree },
  { title: "Inventory", url: "/admin/inventory", icon: Warehouse },
  { title: "Orders", url: "/admin/orders", icon: ShoppingCart },
  { title: "Coupons", url: "/admin/coupons", icon: Ticket },
  { title: "Hero Carousel", url: "/admin/hero", icon: Image },
  { title: "Testimonials", url: "/admin/testimonials", icon: MessageSquareQuote },
  { title: "Newsletter", url: "/admin/newsletter", icon: Mail },
  { title: "Settings", url: "/admin/settings", icon: Settings },
];

export function AdminSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { signOut } = useAuth();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        {!collapsed && (
          <img src={logo} alt="Dapperr Drift" className="max-w-[75%] h-auto w-auto" />
        )}
        {collapsed && <span className="text-sidebar-primary font-bold text-lg">DD</span>}
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Management</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/admin"}
                      className="hover:bg-sidebar-accent"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-2">
        <Button
          variant="ghost"
          className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent"
          onClick={signOut}
        >
          <LogOut className="mr-2 h-4 w-4" />
          {!collapsed && "Sign Out"}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
