import type {
  AccountProfile,
  BackofficeNoticeCounts,
  MemberChangeRequest,
} from "@/lib/account/shared";
import type { MemberRitual, RitualDetail, RitualSearchItem } from "@/lib/rituals/shared";
import type { MemberAsset } from "@/lib/storage/shared";

export type ApiAccountProfile = AccountProfile;

export type ApiGender = "男" | "女" | null;

export interface ApiFamilyMember {
  id: number;
  name: string;
  generation: number | null;
  sibling_order: number | null;
  father_id: number | null;
  father_name: string | null;
  gender: ApiGender;
  official_position: string | null;
  is_alive: boolean;
  spouse: string | null;
  remarks: string | null;
  birthday: string | null;
  death_date: string | null;
  residence_place: string | null;
  updated_at: string;
}

export interface ApiFamilyMemberNode {
  id: number;
  name: string;
  generation: number | null;
  sibling_order: number | null;
  father_id: number | null;
  gender: ApiGender;
  official_position: string | null;
  is_alive: boolean;
  spouse: string | null;
  remarks: string | null;
  birthday: string | null;
  death_date: string | null;
  residence_place: string | null;
}

export interface ApiMemberAccountInput {
  idCard?: string;
  phone?: string | null;
  accountRole?: "member" | "editor";
  removeAccount?: boolean;
}

export interface ApiSaveFamilyMemberInput {
  id?: number;
  name: string;
  generation: number | null;
  sibling_order: number | null;
  father_id: number | null;
  gender: ApiGender;
  official_position: string | null;
  is_alive?: boolean;
  spouse: string | null;
  remarks: string | null;
  birthday: string | null;
  death_date: string | null;
  residence_place: string | null;
  account?: ApiMemberAccountInput;
}

export interface ApiImportFamilyMemberInput extends ApiSaveFamilyMemberInput {
  father_name?: string | null;
}

export type ApiMemberRitual = MemberRitual;
export type ApiRitualSearchItem = RitualSearchItem;
export type ApiRitualDetail = RitualDetail;
export type ApiMemberAsset = MemberAsset;

export interface ApiPageResult<T> {
  data: T[];
  count: number;
}

export interface ApiActionResult<T> {
  data: T;
  message?: string;
}

export interface ApiPendingMemberChangeReview {
  request: MemberChangeRequest;
  account: Pick<AccountProfile, "id" | "real_name">;
  member: {
    id: number;
    name: string;
    spouse: string | null;
    birthday: string | null;
    gender: ApiGender;
    is_alive: boolean;
    death_date: string | null;
    residence_place: string | null;
    official_position: string | null;
    remarks: string | null;
  };
}

export interface ApiMyProfileContext {
  pendingRequest: MemberChangeRequest | null;
  historyRequests: MemberChangeRequest[];
}

export type ApiBackofficeNoticeCounts = BackofficeNoticeCounts;

export interface ApiFamilyMemberOption {
  id: number;
  name: string;
  generation: number | null;
}

export interface ApiMemberAccountSnapshot {
  id: string;
  auth_user_id: string;
  role: "admin" | "editor" | "member";
  phone: string | null;
  id_card_value: string | null;
  status: "pending" | "approved" | "rejected";
}
