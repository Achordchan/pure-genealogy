export interface MemberRitual {
  id: string;
  member_id: number;
  cemetery_name: string;
  area_block: string | null;
  plot_number: string | null;
  address: string;
  province: string | null;
  city: string | null;
  district: string | null;
  latitude: number | null;
  longitude: number | null;
  contact_name: string | null;
  contact_phone: string | null;
  guide_text: string | null;
  ritual_notes: string | null;
  updated_at: string;
}

export interface RitualSearchItem {
  member_id: number;
  name: string;
  generation: number | null;
  father_name: string | null;
  spouse: string | null;
  death_date: string | null;
  ritual: MemberRitual | null;
}

export interface RitualDetail extends RitualSearchItem {
  birthday: string | null;
  residence_place: string | null;
  official_position: string | null;
  remarks: string | null;
}

export function formatRitualLocation(ritual: Pick<MemberRitual, "cemetery_name" | "area_block" | "plot_number"> | null) {
  if (!ritual) {
    return "暂无祭祀信息";
  }

  return [ritual.cemetery_name, ritual.area_block, ritual.plot_number].filter(Boolean).join(" · ");
}

export function buildAmapNavigationUrl(detail: RitualDetail) {
  if (!detail.ritual) {
    return null;
  }

  return buildAmapNavigationUrlForTarget(detail.name, detail.ritual);
}

export function buildAmapNavigationUrlForTarget(
  memberName: string,
  ritual: Pick<MemberRitual, "address" | "latitude" | "longitude">,
) {
  const name = encodeURIComponent(`${memberName}祭祀地点`);
  const address = encodeURIComponent(ritual.address);

  if (ritual.longitude !== null && ritual.latitude !== null) {
    return `https://uri.amap.com/navigation?to=${ritual.longitude},${ritual.latitude},${name}&mode=car&src=zupu&coordinate=gaode&callnative=1`;
  }

  return `https://uri.amap.com/search?keyword=${name}&center=${address}`;
}
