import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "cn";

function Bone({ className }: { className?: string }) {
  return <Skeleton className={cn("loading-bone", className)} />;
}

function Loading({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className="w-full" aria-busy="true">
      <span role="status" className="sr-only">
        Wird geladen …
      </span>
      <div aria-hidden className={className}>
        {children}
      </div>
    </div>
  );
}

function ItemRows({ count }: { count: number }) {
  return (
    <div>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="flex items-start gap-3 border-b border-border py-3 last:border-b-0">
          <Bone className="size-6 shrink-0" />
          <div className="min-w-0 flex-1 space-y-2">
            <Bone className={cn("h-4", index % 2 === 0 ? "w-2/3" : "w-1/2")} />
            <Bone className="h-3 w-1/4" />
          </div>
          <Bone className="h-5 w-12 rounded-full" />
        </div>
      ))}
    </div>
  );
}

function ModuleCards({ count }: { count: number }) {
  return (
    <div className="grid grid-cols-3 gap-2 md:gap-3">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="flex flex-col items-start gap-2 rounded-xl bg-card p-2.5 ring-1 ring-foreground/10 md:flex-row md:items-center md:gap-3 md:p-4">
          <div className="w-full min-w-0 flex-1 space-y-2 md:w-auto">
            <Bone className="h-4 w-3/4" />
            <Bone className="h-3 w-1/2" />
          </div>
          <Bone className="size-11 shrink-0 rounded-full md:size-14" />
        </div>
      ))}
    </div>
  );
}

function FormCards() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 3 }, (_, index) => (
        <div key={index} className="space-y-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <div className="space-y-2">
            <Bone className="h-5 w-1/3" />
            <Bone className="h-3 w-2/3" />
          </div>
          <div className="flex gap-3">
            <Bone className="h-8 flex-1" />
            <Bone className="h-8 w-28" />
          </div>
        </div>
      ))}
    </div>
  );
}

function DashboardContent() {
  return (
    <>
      <section className="space-y-3">
        <Bone className="h-6 w-40" />
        <div className="flex gap-2">
          <Bone className="h-8 flex-1" />
          <Bone className="h-8 w-24" />
        </div>
      </section>
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <Bone className="h-6 w-36" />
          <Bone className="h-8 w-16" />
        </div>
        <ModuleCards count={6} />
      </section>
    </>
  );
}

export function DashboardSkeleton() {
  return (
    <Loading className="mx-auto w-full max-w-5xl space-y-10 px-4 py-8">
      <DashboardContent />
    </Loading>
  );
}

export function ModuleSkeleton() {
  return (
    <Loading className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8">
      <div className="space-y-3">
        <Bone className="h-4 w-24" />
        <Bone className="h-9 w-2/3" />
        <Bone className="h-4 w-1/3" />
      </div>
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 6 }, (_, index) => (
          <Bone key={index} className="h-9 w-24" />
        ))}
      </div>
      <div className="space-y-2">
        <Bone className="h-6 w-40" />
        <ItemRows count={5} />
      </div>
    </Loading>
  );
}

export function SearchSkeleton() {
  return (
    <Loading className="mx-auto w-full max-w-3xl space-y-4 px-4 py-8">
      <Bone className="h-9 w-1/2" />
      <ItemRows count={5} />
    </Loading>
  );
}

export function SettingsSkeleton() {
  return (
    <Loading className="mx-auto w-full max-w-2xl space-y-8 px-4 py-8">
      <Bone className="h-9 w-48" />
      <FormCards />
    </Loading>
  );
}

/** Sits inside the maintainer page's own main element. */
export function MaintainerSkeleton() {
  return (
    <Loading className="space-y-4">
      <Bone className="h-9 w-48" />
      <FormCards />
    </Loading>
  );
}

/** The first load of a signed-in page, before the app's menu is ready. */
export function AppSkeleton() {
  return (
    <Loading className="flex min-h-svh w-full">
      <div className="hidden w-64 shrink-0 flex-col gap-3 border-r border-sidebar-border bg-sidebar p-3 md:flex">
        <div className="flex items-center gap-2 p-1">
          <Bone className="size-8 shrink-0 rounded-lg" />
          <div className="flex-1 space-y-1.5">
            <Bone className="h-3.5 w-1/2" />
            <Bone className="h-2.5 w-3/4" />
          </div>
        </div>
        <Bone className="h-8" />
        <div className="mt-2 space-y-2">
          {Array.from({ length: 6 }, (_, index) => (
            <Bone key={index} className="h-7" />
          ))}
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex h-14 items-center border-b border-border px-3">
          <Bone className="size-8" />
        </div>
        <div className="mx-auto w-full max-w-5xl space-y-10 px-4 py-8">
          <DashboardContent />
        </div>
      </div>
    </Loading>
  );
}
