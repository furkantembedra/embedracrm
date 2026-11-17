"use server";
// Bayi portalı Dokümanlar: duyuruyu okundu işaretle, eğitim modülünü tamamla. Bayi kimliği oturumdan.
import { revalidatePath } from "next/cache";
import { duyuruOkundu, egitimTamamla, getDokuman, getDuyurular } from "@/components/bayi-dokumanlar/queries";
import { hedefteMi } from "@/components/bayi-dokumanlar/ortak";
import { portalOturumu } from "./oturum";

async function bayiId() {
  const o = await portalOturumu();
  if (!o) throw new Error("Oturum yok");
  return o.bayi.id;
}

export async function portalDuyuruOkundu(id: string) {
  const b = await bayiId();
  const d = (await getDuyurular()).find((x) => x.id === id);
  if (!d || !hedefteMi(d.hedef, b)) return;
  await duyuruOkundu(id, b);
  revalidatePath("/portal/dokumanlar");
  revalidatePath("/bayiler/dokumanlar");
}

export async function portalEgitimTamamla(id: string, tamam: boolean) {
  const b = await bayiId();
  const d = await getDokuman(id);
  if (!d || d.kategori !== "Eğitim" || !hedefteMi(d.hedef, b)) return;
  await egitimTamamla(b, id, tamam);
  revalidatePath("/portal/dokumanlar");
  revalidatePath("/bayiler/dokumanlar");
}
