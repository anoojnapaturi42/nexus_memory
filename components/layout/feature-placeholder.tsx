import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import { buttonVariants } from "@/components/ui/button-variants";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type FeaturePlaceholderProps = {
  title: string;
  description: string;
};

export function FeaturePlaceholder({ title, description }: FeaturePlaceholderProps) {
  return (
    <main className="min-h-screen bg-background px-6 py-6 text-foreground lg:px-10">
      <div className="mx-auto flex min-h-screen max-w-5xl items-center">
        <Card className="w-full border-border/70 bg-card/80 shadow-soft backdrop-blur">
          <CardHeader>
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
              <Sparkles className="h-5 w-5" />
            </div>
            <CardTitle className="text-2xl">{title}</CardTitle>
            <CardDescription className="max-w-2xl text-sm leading-6">{description}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3">
            <Link
              href="/"
              className={cn(buttonVariants({ variant: "outline" }), "flex items-center gap-2")}
            >
              <ArrowLeft className="h-4 w-4" />
              Back to dashboard
            </Link>
            <span className="text-sm text-muted-foreground">
              This route is scaffolded and ready for feature work.
            </span>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
