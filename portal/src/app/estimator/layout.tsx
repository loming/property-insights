import { SectionHeader } from "@/components/layout/section-header";
import { CompareTray } from "@/features/estimator/compare-tray";
import { CompareTrayProvider } from "@/features/estimator/compare-tray-provider";

const SECTIONS = [
  { href: "/estimator", label: "Estimate", exact: true },
  { href: "/estimator/history", label: "History" },
  { href: "/estimator/compare", label: "Compare" },
];

/** The compare tray lives here, so it survives moving between the estimator's pages. */
export default function EstimatorLayout({ children }: LayoutProps<"/estimator">) {
  return (
    <CompareTrayProvider>
      <SectionHeader
        title="Property Value Estimator"
        description="Price a property with the regression model, keep a history and compare estimates."
        nav={SECTIONS}
      />
      {children}
      <CompareTray />
    </CompareTrayProvider>
  );
}
