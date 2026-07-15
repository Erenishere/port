import { SmoothScrollProvider } from "@/components/providers/SmoothScrollProvider";
import { SiteHeader } from "@/components/sections/SiteHeader";
import { ChapterArrival } from "@/components/sections/ChapterArrival";
import { ChapterFog } from "@/components/sections/ChapterFog";
import { ChapterThread } from "@/components/sections/ChapterThread";
import { ChapterForge } from "@/components/sections/ChapterForge";
import { ChapterProof } from "@/components/sections/ChapterProof";
import { ChapterPath } from "@/components/sections/ChapterPath";
import { ChapterResolution } from "@/components/sections/ChapterResolution";
import { ScrollProgress } from "@/components/ui/ScrollProgress";

export default function Home() {
  return (
    <SmoothScrollProvider>
      <ScrollProgress />
      <SiteHeader />
      <main>
        <ChapterArrival />
        <ChapterFog />
        <ChapterThread />
        <ChapterForge />
        <ChapterProof />
        <ChapterPath />
        <ChapterResolution />
      </main>
    </SmoothScrollProvider>
  );
}
