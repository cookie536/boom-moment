import { Suspense } from "react";
import { BoomWriteScreen } from "@/components/boom/boom-write-screen";
import { text } from "@/constants/text";

export default function BoomWritePage() {
  return (
    <Suspense fallback={<p className="px-5 py-16 text-center text-[15px] text-[#8A8178]">{text.v1.loading}</p>}>
      <BoomWriteScreen />
    </Suspense>
  );
}
