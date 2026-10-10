import { Suspense } from "react";
import { BoomCompareScreen } from "@/components/boom/boom-compare-screen";
import { text } from "@/constants/text";

export default function BoomComparePage() {
  return (
    <Suspense fallback={<p className="px-5 py-16 text-center text-[15px] text-[#8A8A8E]">{text.v1.loading}</p>}>
      <BoomCompareScreen />
    </Suspense>
  );
}
