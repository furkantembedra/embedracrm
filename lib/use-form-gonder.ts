"use client";

// <form action={gonder}> React 19'da işlem bitince formu otomatik sıfırlar;
// doğrulama hatası dönse bile kullanıcının yazdıkları silinir.
// Bu yardımcı formu onSubmit ile gönderir: alanlar sıfırlanmaz, useActionState'in
// "bekliyor" durumu ve dönen hatalar aynen çalışır.
//
// Kullanım:
//   const [durum, gonder, bekliyor] = useActionState(kaydet, {});
//   const gonderKorunarak = useFormGonder(gonder);
//   <form onSubmit={gonderKorunarak} noValidate> ... </form>
import { startTransition, type FormEvent } from "react";

export function useFormGonder(gonder: (form: FormData) => void) {
  return (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    startTransition(() => gonder(form));
  };
}
