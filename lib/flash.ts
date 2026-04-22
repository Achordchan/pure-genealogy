import { cookies } from "next/headers";

export type FlashMessage = {
  type: "success" | "error";
  message: string;
};

const FLASH_COOKIE_NAME = "app_flash_message";
const PENDING_PHONE_DRAFT_COOKIE_NAME = "pending_phone_draft";

export async function setFlashMessage(flash: FlashMessage) {
  const cookieStore = await cookies();
  cookieStore.set(FLASH_COOKIE_NAME, JSON.stringify(flash), {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60,
  });
}

export async function consumeFlashMessage() {
  const cookieStore = await cookies();
  const value = cookieStore.get(FLASH_COOKIE_NAME)?.value;

  if (!value) {
    return null;
  }

  cookieStore.delete(FLASH_COOKIE_NAME);

  try {
    const flash = JSON.parse(value) as FlashMessage;
    if (!flash?.message || (flash.type !== "success" && flash.type !== "error")) {
      return null;
    }
    return flash;
  } catch {
    return null;
  }
}

export async function setPendingPhoneDraft(phone: string) {
  const cookieStore = await cookies();
  cookieStore.set(PENDING_PHONE_DRAFT_COOKIE_NAME, phone, {
    path: "/auth/pending",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 300,
  });
}

export async function consumePendingPhoneDraft() {
  const cookieStore = await cookies();
  const value = cookieStore.get(PENDING_PHONE_DRAFT_COOKIE_NAME)?.value;

  if (!value) {
    return null;
  }

  cookieStore.delete(PENDING_PHONE_DRAFT_COOKIE_NAME);
  return value;
}

export async function clearPendingPhoneDraft() {
  const cookieStore = await cookies();
  cookieStore.delete(PENDING_PHONE_DRAFT_COOKIE_NAME);
}
