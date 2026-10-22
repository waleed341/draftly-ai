"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader } from "@/components/ui/Card";
import { MailIcon } from "@/components/ui/icons";
import { Pill } from "@/components/ui/Pill";
import { draftKeys, draftsApi } from "../api";
import { COPY } from "../constants";

export function ComingSoonPanel() {
  const { data } = useQuery({ queryKey: draftKeys.connectors, queryFn: draftsApi.connectors, staleTime: Infinity });
  if (!data?.length) return null;
  return (
    <Card aria-labelledby="soon-title">
      <CardHeader id="soon-title" title={COPY.soon.title} />
      <ul className="space-y-3 p-5 pt-4">
        {data.map((connector) => (
          <li key={connector.key} className="flex gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface-2 text-muted">
              <MailIcon className="size-[18px]" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 text-sm font-medium text-fg">
                {connector.name}
                {connector.status === "coming_soon" && <Pill tone="accent">{COPY.soon.badge}</Pill>}
              </p>
              <p className="text-sm text-muted">{connector.description}</p>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
