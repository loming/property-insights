import { SectionHeader } from "@/components/layout/section-header";

const SECTIONS = [
  { href: "/market", label: "Dashboard", exact: true },
  { href: "/market/data", label: "Data" },
  { href: "/market/what-if", label: "What-if" },
];

export default function MarketLayout({ children }: LayoutProps<"/market">) {
  return (
    <>
      <SectionHeader
        title="Property Market Analysis"
        description="Explore market segments, export the data and ask the model what-if questions."
        nav={SECTIONS}
      />
      {children}
    </>
  );
}
