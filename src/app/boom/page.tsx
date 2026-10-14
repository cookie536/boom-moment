import { Suspense } from "react";
import { BoomScreen } from "@/components/boom/boom-screen";
import { text } from "@/constants/text";

export default function BoomPage() {
  return (
    <Suspense fallback={<p className="px-5 py-16 text-center text-[15px] text-[#8A8178]">{text.v1.loading}</p>}>
      <BoomScreen />
    </Suspense>
  );
}
