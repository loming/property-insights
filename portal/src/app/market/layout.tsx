import { SectionHeader } from "@/components/layout/section-header";
import { FILTER_PARAMS } from "@/features/market/filters";

// The dashboard and the table show the same filtered homes, so moving between them keeps the filters.
const SECTIONS = [
  { href: "/market", label: "Dashboard", exact: true, keepParams: FILTER_PARAMS },
  { href: "/market/data", label: "Data", keepParams: FILTER_PARAMS },
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
