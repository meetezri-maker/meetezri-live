import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { adminCard, adminCardStatic } from "@/app/admin/adminPageChrome";

type AdminCardProps = {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  as?: "div" | "article" | "section";
};

/** Matte premium panel with environmental edge lighting — Solace Admin OS. */
export function AdminCard({
  children,
  className,
  hover = true,
  as: Tag = "div",
}: AdminCardProps) {
  return (
    <Tag className={cn(hover ? adminCard : adminCardStatic, className)}>{children}</Tag>
  );
}
