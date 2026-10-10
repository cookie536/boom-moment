import { BottomTabBar } from "@/components/navigation/bottom-tab-bar";
import { CaptureComposer } from "@/components/capture/capture-composer";
import { CaptureHeader } from "@/components/capture/capture-header";
import { RecentCaptures, type CaptureItem } from "@/components/capture/recent-captures";
import { text } from "@/constants/text";

const recentCaptures: CaptureItem[] = text.recentItems.map((title) => ({
  id: title,
  title,
}));

export function CaptureScreen() {
  return (
    <div className="mx-auto min-h-dvh w-full max-w-lg">
      <CaptureHeader
        title={text.appName}
        subtitle={text.tagline}
      />
      <main className="px-5 pb-32">
        <CaptureComposer />
        <RecentCaptures items={recentCaptures} />
      </main>
      <BottomTabBar />
    </div>
  );
}
