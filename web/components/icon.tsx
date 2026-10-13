import { ArrowDownLeft, ArrowUpRight, Boxes, ChartNoAxesCombined, ClipboardList, Download, LayoutDashboard, Package, Plus, Search, Settings, ShieldCheck, Truck, X, Menu, LogOut, ArrowRight, Check, AlertTriangle, RefreshCw, Ellipsis, CircleHelp } from "lucide-react";

const icons = { boxes: Boxes, overview: LayoutDashboard, inventory: Package, suppliers: Truck, movements: ClipboardList, analytics: ChartNoAxesCombined, reports: Download, settings: Settings, plus: Plus, search: Search, close: X, menu: Menu, logout: LogOut, arrow: ArrowRight, check: Check, warning: AlertTriangle, refresh: RefreshCw, more: Ellipsis, help: CircleHelp, shield: ShieldCheck, receipt: ArrowDownLeft, issue: ArrowUpRight, adjustment: RefreshCw };
export function Icon({ name, size = 20, className = "" }: { name: keyof typeof icons; size?: number; className?: string }) {
  const Component = icons[name];
  return <Component size={size} strokeWidth={1.7} className={className} aria-hidden="true" />;
}
