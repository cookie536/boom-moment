import { CaptureFlowProvider } from "@/components/capture/capture-flow";
import { LibraryProvider } from "@/components/library/library-provider";
import type { ReactNode } from "react";

export default function LegacyLayout({ children }: { children: ReactNode }) {
  return (
    <LibraryProvider>
      <CaptureFlowProvider>{children}</CaptureFlowProvider>
    </LibraryProvider>
  );
}
