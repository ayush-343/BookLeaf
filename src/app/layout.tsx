import type { ReactNode } from "react";
import "@fontsource/lato/latin-400.css";
import "@fontsource/lato/latin-700.css";
import "./style.css";
export const metadata = { title: "BookLeaf | Author support", description: "Book and royalty support for BookLeaf authors." };
export default function Layout({children}:{children:ReactNode}) {
  return <html lang="en"><body>{children}</body></html>;
}
