import { SectionHeader } from "@/components/layout/section-header";

const SECTIONS = [
  { href: "/estimator", label: "Estimate", exact: true },
  { href: "/estimator/history", label: "History" },
  { href: "/estimator/compare", label: "Compare" },
];

export default function EstimatorLayout({ children }: LayoutProps<"/estimator">) {
  return (
    <>
      <SectionHeader
        title="Property Value Estimator"
        description="Price a property with the regression model, keep a history and compare estimates."
        nav={SECTIONS}
      />
      {children}
    </>
  );
}
