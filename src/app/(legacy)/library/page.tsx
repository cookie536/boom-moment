import type { Metadata } from "next";
import { text } from "@/constants/text";
import { LibraryScreen } from "@/components/library/library-screen";

export const metadata: Metadata = {
  title: text.library,
};

export default function LibraryPage() {
  return <LibraryScreen />;
}
