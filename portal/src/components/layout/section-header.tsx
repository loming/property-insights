import { NavLinks, type NavItem } from "./nav-links";

/** An app's title and its own sub-navigation, shared by both apps' layouts. */
export function SectionHeader({ title, description, nav }: { title: string; description: string; nav: NavItem[] }) {
  return (
    <div className="mb-6 space-y-3 border-b pb-4">
      <div>
        <p className="font-heading text-xl font-semibold tracking-tight">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <NavLinks label={`${title} sections`} items={nav} variant="sub" />
    </div>
  );
}
