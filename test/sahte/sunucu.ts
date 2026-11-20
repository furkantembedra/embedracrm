// Sahte HTTP sunucularının ortak iskeleti: 127.0.0.1'de rastgele bir portta açılır, gelen istekleri kaydeder.
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";

export type KayitliIstek = { yontem: string; yol: string; basliklar: IncomingMessage["headers"]; govde: unknown };
/** gecikmeMs: yanıtı bu kadar geciktir (zaman aşımı testleri) */
export type Yanitla = (istek: KayitliIstek) => { durum: number; govde: unknown; gecikmeMs?: number };

export type SahteSunucu = {
  /** "http://127.0.0.1:PORT" */
  adres: string;
  /** Gelen istekler, geliş sırasıyla */
  istekler: KayitliIstek[];
  kapat: () => Promise<void>;
};

export async function sahteSunucuBaslat(yanitla: Yanitla): Promise<SahteSunucu> {
  const istekler: KayitliIstek[] = [];
  const sunucu = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const parcalar: Buffer[] = [];
    for await (const p of req) parcalar.push(p as Buffer);
    const ham = Buffer.concat(parcalar).toString("utf8");
    let govde: unknown = ham;
    try {
      govde = ham ? JSON.parse(ham) : null;
    } catch {
      /* JSON değilse ham metin kalır */
    }
    const istek: KayitliIstek = { yontem: req.method ?? "", yol: req.url ?? "", basliklar: req.headers, govde };
    istekler.push(istek);
    const y = yanitla(istek);
    if (y.gecikmeMs) await new Promise((r) => setTimeout(r, y.gecikmeMs));
    if (res.destroyed) return;
    res.writeHead(y.durum, { "Content-Type": "application/json" });
    res.end(JSON.stringify(y.govde));
  });
  await new Promise<void>((tamam) => sunucu.listen(0, "127.0.0.1", tamam));
  const kapat = () => new Promise<void>((tamam, hata) => {
    sunucu.closeAllConnections?.();
    sunucu.close((e) => (e ? hata(e) : tamam()));
  });
  const { port } = sunucu.address() as AddressInfo;
  return {
    adres: `http://127.0.0.1:${port}`,
    istekler,
    kapat,
  };
}
