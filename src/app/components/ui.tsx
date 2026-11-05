import Image from "next/image";
import type { ReactNode } from "react";
import { type Book, money, date, reason } from "./contracts";
export function BrandLogo() {
  return (
    <Image
      src="/bookleaf-logo.jpg"
      alt="BookLeaf Publishing"
      width={705}
      height={324}
      unoptimized
    />
  );
}
export function Problem({ error }: { error: unknown }) {
  return error ? (
    <p className="problem" role="alert">
      {typeof error === "string" ? error : reason(error)}
    </p>
  ) : null;
}
export function Loading({ children }: { children: ReactNode }) {
  return (
    <div className="loading-state" role="status">
      <p>{children}</p>
      <div className="skeleton-lines" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}
export function Badge({ children }: { children: ReactNode }) {
  return (
    <span
      className={
        "badge badge-" +
        String(children)
          .toLowerCase()
          .replace(/[^a-z]+/g, "-")
      }
    >
      {children}
    </span>
  );
}
export function BookFacts({ book }: { book: Book }) {
  return (
    <dl>
      {[
        ["ISBN", book.isbn ?? "Not available yet"],
        ["Genre", book.genre],
        ["Available on", book.available_on?.join(", ") || "Not listed yet"],
        ["Print partner", book.print_partner ?? "Not assigned"],
        [
          "Publication date",
          book.publication_date
            ? date(book.publication_date)
            : "Not available yet",
        ],
        ["Price", money(book.mrp)],
        ["Copies sold", book.total_copies_sold],
        ["Royalty earned", money(book.total_royalty_earned)],
        ["Royalty paid", money(book.royalty_paid)],
        ["Royalty pending", money(book.royalty_pending)],
        [
          "Last payout",
          book.last_royalty_payout_date
            ? date(book.last_royalty_payout_date)
            : "No payout date recorded",
        ],
      ].map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
