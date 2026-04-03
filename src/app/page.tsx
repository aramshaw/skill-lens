import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center min-h-screen bg-background px-4">
      <main className="flex flex-col items-center gap-6 text-center max-w-lg">
        <h1 className="text-4xl font-bold tracking-tight">Skill Lens</h1>
        <p className="text-lg text-muted-foreground">
          Visualize and analyze Claude Code skills across all your projects.
        </p>
        <p className="text-sm text-muted-foreground">
          Skill inventory, overlap detection, and gap analysis — coming soon.
        </p>
        <Button disabled>Scan Projects</Button>
      </main>
    </div>
  );
}
