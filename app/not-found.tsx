import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="text-center">
        <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">404</p>
        <h1 className="mt-3 text-3xl font-semibold">Page not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The requested workspace route does not exist yet.
        </p>
        <Link
          href="/"
          className={cn(buttonVariants({ variant: "default" }), "mt-6 inline-flex")}
        >
          Return home
        </Link>
      </div>
    </div>
  );
}
