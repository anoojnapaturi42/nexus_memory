import type { Metadata } from "next";
import { ResearchDashboard } from "@/components/research/research-dashboard";

export const metadata: Metadata = {
  title: "Research",
  description: "Memory system benchmark results, temporal updates, and failure cases.",
};

export default function ResearchPage() {
  return <ResearchDashboard />;
}
