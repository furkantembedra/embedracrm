import { redirect } from "next/navigation";

// Ana adres (/) doğrudan Genel Bakış'a gider
export default function Home() {
  redirect("/genel-bakis");
}
