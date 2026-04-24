"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Search, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import type { FamilyMember } from "./actions";
import {
  deleteFamilyMembers,
  fetchAllMembersForSelect,
  fetchEditableMemberById,
  fetchMemberById,
  saveFamilyMemberWithAccount,
} from "./actions";
import { ImportMembersDialog } from "./import-members-dialog";
import { MemberAssetsPanel } from "./member-assets-panel";
import { RitualEditDialog } from "./ritual-edit-dialog";
import { fetchMemberRitualForEdit } from "./ritual-actions";
import { FatherCombobox } from "./father-combobox";
import { RichTextEditor } from "@/components/rich-text/editor";
import { RichTextViewer } from "@/components/rich-text/viewer";
import { cn } from "@/lib/utils";
import { formatRitualLocation, type MemberRitual } from "@/lib/rituals/shared";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import { AppDialogShell } from "@/components/app-dialog-shell";

interface FamilyMembersTableProps {
  initialData: FamilyMember[];
  totalCount: number;
  currentPage: number;
  pageSize: number;
  searchQuery: string;
  canDelete: boolean;
  canImport: boolean;
  canManageAccounts: boolean;
}

export function FamilyMembersTable({
  initialData,
  totalCount,
  currentPage,
  pageSize,
  searchQuery,
  canDelete,
  canImport,
  canManageAccounts,
}: FamilyMembersTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = React.useTransition();

  const [selectedIds, setSelectedIds] = React.useState<Set<number>>(new Set());
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [searchInput, setSearchInput] = React.useState(searchQuery);
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [isRitualDialogOpen, setIsRitualDialogOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isLoadingParents, setIsLoadingParents] = React.useState(false);
  const [loadingFatherId, setLoadingFatherId] = React.useState<number | null>(null);
  const [isLoadingMemberDetail, setIsLoadingMemberDetail] = React.useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = React.useState(false);
  const [isAccountResetConfirmOpen, setIsAccountResetConfirmOpen] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  const [editingMember, setEditingMember] = React.useState<FamilyMember | null>(null);
  const [ritualSnapshot, setRitualSnapshot] = React.useState<MemberRitual | null>(null);
  const [biographyMember, setBiographyMember] = React.useState<FamilyMember | null>(null);
  const [pendingSavePayload, setPendingSavePayload] = React.useState<Parameters<typeof saveFamilyMemberWithAccount>[0] | null>(null);
  const [parentOptions, setParentOptions] = React.useState<
    { id: number; name: string; generation: number | null }[]
  >([]);

  // 新增表单状态
  const [formData, setFormData] = React.useState({
    name: "",
    generation: "",
    sibling_order: "",
    father_id: "",
    gender: "",
    official_position: "",
    is_alive: true,
    spouse: "",
    remarks: "",
    birthday: "",
    death_date: "",
    residence_place: "",
  });
  const [accountForm, setAccountForm] = React.useState({
    phone: "",
    idCard: "",
    accountRole: "member" as "member" | "editor",
    hasAccount: false,
    currentRole: "" as "" | "member" | "editor" | "admin",
  });

  const totalPages = Math.ceil(totalCount / pageSize);
  const memberFormRowClass = "grid grid-cols-[104px_minmax(0,1fr)] items-center gap-4";
  const memberFormTopRowClass = "grid grid-cols-[104px_minmax(0,1fr)] items-start gap-4";
  const memberFormLabelClass = "text-right";

  // 判断是否为编辑模式
  const isEditMode = editingMember !== null;

  // 加载父亲选择列表
  React.useEffect(() => {
    if (isDialogOpen) {
      setIsLoadingParents(true);
      fetchAllMembersForSelect()
        .then(setParentOptions)
        .finally(() => setIsLoadingParents(false));
    }
  }, [isDialogOpen]);

  const updateUrlParams = (params: Record<string, string>) => {
    startTransition(() => {
      const newParams = new URLSearchParams(searchParams.toString());
      Object.entries(params).forEach(([key, value]) => {
        if (value) {
          newParams.set(key, value);
        } else {
          newParams.delete(key);
        }
      });
      router.push(`/family-tree?${newParams.toString()}`);
    });
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    updateUrlParams({ search: searchInput, page: "1" });
  };

  const handlePageChange = (newPage: number) => {
    updateUrlParams({ page: newPage.toString() });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(initialData.map((m) => m.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (id: number, checked: boolean) => {
    const newSet = new Set(selectedIds);
    if (checked) {
      newSet.add(id);
    } else {
      newSet.delete(id);
    }
    setSelectedIds(newSet);
  };

  const handleDelete = async () => {
    if (selectedIds.size === 0) return;
    setIsDeleteConfirmOpen(true);
  };

  const resetForm = () => {
    setFormData({
      name: "",
      generation: "",
      sibling_order: "",
      father_id: "",
      gender: "",
      official_position: "",
      is_alive: true,
      spouse: "",
      remarks: "",
      birthday: "",
      death_date: "",
      residence_place: "",
    });
    setAccountForm({
      phone: "",
      idCard: "",
      accountRole: "member",
      hasAccount: false,
      currentRole: "",
    });
    setEditingMember(null);
    setRitualSnapshot(null);
    setIsLoadingMemberDetail(false);
    setFormError(null);
    setPendingSavePayload(null);
    setIsRitualDialogOpen(false);
  };

  const fillMemberForm = (member: FamilyMember) => {
    setEditingMember(member);
    setFormData({
      name: member.name,
      generation: member.generation?.toString() ?? "",
      sibling_order: member.sibling_order?.toString() ?? "",
      father_id: member.father_id?.toString() ?? "null",
      gender: member.gender ?? "",
      official_position: member.official_position ?? "",
      is_alive: member.is_alive,
      spouse: member.spouse ?? "",
      remarks: member.remarks ?? "",
      birthday: member.birthday ?? "",
      death_date: member.death_date ?? "",
      residence_place: member.residence_place ?? "",
    });
  };

  // 打开新增弹窗
  const handleOpenAddDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  // 打开编辑弹窗
  const handleOpenEditDialog = async (member: FamilyMember) => {
    resetForm();
    fillMemberForm(member);
    setIsDialogOpen(true);
    setIsLoadingMemberDetail(true);
    const [detail, ritualDetail] = await Promise.all([
      canManageAccounts ? fetchEditableMemberById(member.id) : Promise.resolve(null),
      !member.is_alive ? fetchMemberRitualForEdit(member.id).catch(() => null) : Promise.resolve(null),
    ]);
    setIsLoadingMemberDetail(false);

    setRitualSnapshot(ritualDetail?.ritual ?? null);

    if (detail) {
      fillMemberForm(detail);
      setAccountForm({
        idCard: detail.account_profile?.id_card_value ?? "",
        phone: detail.account_profile?.phone ?? "",
        accountRole:
          detail.account_profile?.role === "editor" ? "editor" : "member",
        hasAccount: Boolean(detail.account_profile),
        currentRole: detail.account_profile?.role ?? "",
      });
    }
  };

  // 关闭弹窗
  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    resetForm();
  };

  const saveMember = async (payload: Parameters<typeof saveFamilyMemberWithAccount>[0]) => {
    setIsSubmitting(true);
    setFormError(null);

    const request = saveFamilyMemberWithAccount(payload).then((result) => {
      if (!result.success) {
        throw new Error(result.error || "保存失败");
      }
      return result;
    });

    toast.promise(request, {
      loading: isEditMode ? "正在保存成员信息..." : "正在创建成员...",
      success: isEditMode ? "成员信息已更新" : "成员已创建",
      error: (error) => error instanceof Error ? error.message : "保存失败",
    });

    try {
      await request;
      handleCloseDialog();
      router.refresh();
    } finally {
      setIsSubmitting(false);
      setPendingSavePayload(null);
    }
  };

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    const request = deleteFamilyMembers(Array.from(selectedIds)).then((result) => {
      if (!result.success) {
        throw new Error(result.error || "删除失败");
      }
      return result;
    });

    toast.promise(request, {
      loading: "正在删除成员...",
      success: "成员已删除",
      error: (error) => error instanceof Error ? error.message : "删除失败",
    });

    try {
      await request;
      setSelectedIds(new Set());
      setIsDeleteConfirmOpen(false);
      router.refresh();
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSubmitMember = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      setFormError("请输入姓名");
      return;
    }
    setFormError(null);

    const memberData = {
      name: formData.name.trim(),
      generation: formData.generation ? parseInt(formData.generation) : null,
      sibling_order: formData.sibling_order
        ? parseInt(formData.sibling_order)
        : null,
      father_id: (formData.father_id && formData.father_id !== "null") 
        ? parseInt(formData.father_id) 
        : null,
      gender: (formData.gender as "男" | "女") || null,
      official_position: formData.official_position || null,
      is_alive: formData.is_alive,
      spouse: formData.spouse || null,
      remarks: formData.remarks || null,
      birthday: formData.birthday || null,
      death_date: (!formData.is_alive && formData.death_date) ? formData.death_date : null,
      residence_place: formData.residence_place || null,
    };

    const payload = {
      ...(isEditMode && editingMember ? { id: editingMember.id } : {}),
      ...memberData,
      account: canManageAccounts && accountForm.currentRole !== "admin"
        ? {
            idCard: accountForm.idCard.trim() || undefined,
            phone: accountForm.idCard.trim() ? accountForm.phone.trim() || null : null,
            accountRole: accountForm.accountRole,
          }
        : undefined,
    };

    if (
      accountForm.hasAccount &&
      accountForm.currentRole !== "admin" &&
      !accountForm.idCard.trim()
    ) {
      setPendingSavePayload(payload);
      setIsAccountResetConfirmOpen(true);
      return;
    }

    await saveMember(payload);
  };

  const allSelected =
    canDelete && initialData.length > 0 && selectedIds.size === initialData.length;

  return (
    <div className="space-y-4">
      {/* 工具栏 */}
      <div className="flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center">
        {/* 搜索 */}
        <form onSubmit={handleSearch} className="flex gap-2 w-full lg:w-auto">
          <Input
            placeholder="搜索姓名..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full sm:w-64"
          />
          <Button type="submit" variant="outline" size="icon" disabled={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </Button>
        </form>

        {/* 操作按钮 */}
        <div className="flex gap-2 flex-wrap w-full lg:w-auto">
            {canImport && <ImportMembersDialog onSuccess={() => router.refresh()} />}
          
          <Button onClick={handleOpenAddDialog}>
            <Plus className="h-4 w-4 mr-2" />
            新增
          </Button>

          {canDelete && (
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={selectedIds.size === 0 || isDeleting}
            >
              {isDeleting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
              删除 {selectedIds.size > 0 && `(${selectedIds.size})`}
            </Button>
          )}
        </div>
      </div>

      {/* 新增/编辑弹窗 */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => !open && handleCloseDialog()}>
        <DialogContent
          className="sm:max-w-[600px] max-h-[90vh] flex flex-col p-0 gap-0"
          onInteractOutside={(e) => e.preventDefault()}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <DialogHeader className="px-6 py-4 border-b">
            <DialogTitle>{isEditMode ? "编辑成员" : "新增成员"}</DialogTitle>
            <DialogDescription>
              填写成员信息后点击保存
            </DialogDescription>
          </DialogHeader>

          <form id="family-member-form" onSubmit={handleSubmitMember} className="flex flex-col flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="space-y-4">
                {formError ? (
                  <Alert variant="destructive">
                    <AlertDescription>{formError}</AlertDescription>
                  </Alert>
                ) : null}
                <div className="grid gap-4">
                  {/* 姓名 */}
                  <div className={memberFormRowClass}>
                    <Label htmlFor="name" className={memberFormLabelClass}>
                      姓名 *
                    </Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      required
                    />
                  </div>

                  {/* 父亲 */}
                  <div className={memberFormRowClass}>
                    <Label htmlFor="father_id" className={memberFormLabelClass}>
                      父亲
                    </Label>
                    <div>
                      <FatherCombobox
                        value={formData.father_id}
                        options={parentOptions}
                        isLoading={isLoadingParents}
                        onChange={(value) => {
                          const father = parentOptions.find(p => p.id.toString() === value);
                          const newGeneration = father && father.generation !== null
                            ? (father.generation + 1).toString()
                            : (value === "null" ? "" : formData.generation);
                          setFormData({
                            ...formData,
                            father_id: value,
                            generation: newGeneration
                          });
                        }}
                      />
                    </div>
                  </div>

                  {/* 世代 */}
                  <div className={memberFormRowClass}>
                    <Label htmlFor="generation" className={memberFormLabelClass}>
                      世代
                    </Label>
                    <Input
                      id="generation"
                      type="number"
                      value={formData.generation}
                      onChange={(e) =>
                        setFormData({ ...formData, generation: e.target.value })
                      }
                      disabled={!!formData.father_id && formData.father_id !== "null"}
                    />
                  </div>

                  {/* 排行 */}
                  <div className={memberFormRowClass}>
                    <Label htmlFor="sibling_order" className={memberFormLabelClass}>
                      排行
                    </Label>
                    <Input
                      id="sibling_order"
                      type="number"
                      value={formData.sibling_order}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          sibling_order: e.target.value,
                        })
                      }
                    />
                  </div>

                  {/* 性别 */}
                  <div className={memberFormRowClass}>
                    <Label htmlFor="gender" className={memberFormLabelClass}>
                      性别
                    </Label>
                    <Select
                      value={formData.gender}
                      onValueChange={(value) =>
                        setFormData({ ...formData, gender: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="选择性别" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="男">男</SelectItem>
                        <SelectItem value="女">女</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* 生日 */}
                  <div className={memberFormRowClass}>
                    <Label htmlFor="birthday" className={memberFormLabelClass}>
                      生日
                    </Label>
                    <Input
                      id="birthday"
                      type="date"
                      value={formData.birthday}
                      onChange={(e) =>
                        setFormData({ ...formData, birthday: e.target.value })
                      }
                    />
                  </div>

                  {/* 居住地 */}
                  <div className={memberFormRowClass}>
                    <Label htmlFor="residence_place" className={memberFormLabelClass}>
                      居住地
                    </Label>
                    <Input
                      id="residence_place"
                      value={formData.residence_place}
                      onChange={(e) =>
                        setFormData({ ...formData, residence_place: e.target.value })
                      }
                    />
                  </div>

                  {/* 官职 */}
                  <div className={memberFormRowClass}>
                    <Label htmlFor="official_position" className={memberFormLabelClass}>
                      官职
                    </Label>
                    <Input
                      id="official_position"
                      value={formData.official_position}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          official_position: e.target.value,
                        })
                      }
                    />
                  </div>

                  {/* 是否在世 */}
                  <div className={memberFormRowClass}>
                    <Label htmlFor="is_alive" className={memberFormLabelClass}>
                      是否在世
                    </Label>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="is_alive"
                        checked={formData.is_alive}
                        onCheckedChange={(checked) =>
                          setFormData({
                            ...formData,
                            is_alive: checked as boolean,
                          })
                        }
                      />
                      <Label htmlFor="is_alive" className="font-normal">
                        在世
                      </Label>
                    </div>
                  </div>

                  {/* 卒年 (仅去世可选) */}
                  {!formData.is_alive && (
                    <div className={memberFormRowClass}>
                      <Label htmlFor="death_date" className={memberFormLabelClass}>
                        卒年
                      </Label>
                      <Input
                        id="death_date"
                        type="date"
                        value={formData.death_date}
                        onChange={(e) =>
                          setFormData({ ...formData, death_date: e.target.value })
                        }
                      />
                    </div>
                  )}

                  {isEditMode && editingMember && (!formData.is_alive || ritualSnapshot) ? (
                    <div className={memberFormTopRowClass}>
                      <Label className={`${memberFormLabelClass} pt-2`}>祭祀信息</Label>
                      <div className="rounded-lg border border-dashed bg-muted/20 px-4 py-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="space-y-1">
                            <p className="text-sm font-medium">
                              {ritualSnapshot ? "已配置祭祀资料" : "尚未配置祭祀资料"}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {ritualSnapshot
                                ? formatRitualLocation(ritualSnapshot)
                                : "可补充墓位、地图导航、图片/视频指引和祭扫说明。"}
                            </p>
                            {formData.is_alive ? (
                              <p className="text-xs text-amber-600">
                                当前表单里该成员被标记为在世，前台将隐藏祭祀入口。
                              </p>
                            ) : null}
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setIsRitualDialogOpen(true)}
                          >
                            {ritualSnapshot ? "编辑祭祀信息" : "新增祭祀信息"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {/* 配偶 */}
                  <div className={memberFormRowClass}>
                    <Label htmlFor="spouse" className={memberFormLabelClass}>
                      配偶
                    </Label>
                    <Input
                      id="spouse"
                      value={formData.spouse}
                      onChange={(e) =>
                        setFormData({ ...formData, spouse: e.target.value })
                      }
                    />
                  </div>

                  {canManageAccounts ? (
                    <>
                      <div className={memberFormTopRowClass}>
                        <Label className={`${memberFormLabelClass} pt-3`}>登录资料</Label>
                        <div className="rounded-lg border border-dashed bg-muted/20 px-4 py-4">
                          <div className="mb-4 text-sm text-muted-foreground">
                            {isLoadingMemberDetail ? (
                              <span className="inline-flex items-center gap-2">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                正在加载当前账号信息
                              </span>
                            ) : accountForm.hasAccount ? (
                              <span>
                                已开通，当前角色：
                                {accountForm.currentRole === "editor"
                                  ? "编辑员"
                                  : accountForm.currentRole === "admin"
                                    ? "管理员"
                                    : "普通用户"}
                              </span>
                            ) : (
                              <span>未开通，填写身份证号后可直接创建可登录账号。</span>
                            )}
                          </div>

                          <div className="space-y-4">
                            <div className="grid grid-cols-[96px_minmax(0,1fr)] items-center gap-4">
                              <Label htmlFor="account-id-card">身份证号</Label>
                              <Input
                                id="account-id-card"
                                value={accountForm.idCard}
                                onChange={(e) =>
                                  setAccountForm((prev) => ({
                                    ...prev,
                                    idCard: e.target.value,
                                    phone: e.target.value.trim() ? prev.phone : "",
                                  }))
                                }
                                placeholder="填写18位身份证号"
                                disabled={isLoadingMemberDetail || accountForm.currentRole === "admin"}
                              />
                            </div>

                            <div className="grid grid-cols-[96px_minmax(0,1fr)] items-center gap-4">
                              <Label htmlFor="account-phone">手机号</Label>
                              <Input
                                id="account-phone"
                                value={accountForm.phone}
                                onChange={(e) =>
                                  setAccountForm((prev) => ({
                                    ...prev,
                                    phone: e.target.value,
                                  }))
                                }
                                placeholder="11位手机号"
                                disabled={isLoadingMemberDetail || accountForm.currentRole === "admin" || !accountForm.idCard.trim()}
                              />
                            </div>

                            <div className="grid grid-cols-[96px_minmax(0,1fr)] items-center gap-4">
                              <Label htmlFor="account-role">账号角色</Label>
                              <div>
                                {accountForm.currentRole === "admin" ? (
                                  <div className="h-10 rounded-md border bg-muted/30 px-3 text-sm leading-10 text-muted-foreground">
                                    管理员账号不可在成员弹窗中调整
                                  </div>
                                ) : (
                                  <Select
                                    value={accountForm.accountRole}
                                    onValueChange={(value: "member" | "editor") =>
                                      setAccountForm((prev) => ({
                                        ...prev,
                                        accountRole: value,
                                      }))
                                    }
                                    disabled={isLoadingMemberDetail || !accountForm.idCard.trim()}
                                  >
                                    <SelectTrigger id="account-role" className="w-full">
                                      <SelectValue placeholder="选择账号角色" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="member">普通用户</SelectItem>
                                      <SelectItem value="editor">编辑员</SelectItem>
                                    </SelectContent>
                                  </Select>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </>
                  ) : null}

                  {/* 备注 / 生平事迹 */}
                  <div className={memberFormTopRowClass}>
                    <Label htmlFor="remarks" className={`${memberFormLabelClass} pt-2`}>
                      生平事迹
                    </Label>
                    <div>
                      <RichTextEditor
                        value={formData.remarks}
                        onChange={(value) =>
                          setFormData({ ...formData, remarks: value })
                        }
                        maxLength={500}
                      />
                    </div>
                  </div>

                  <div className={memberFormTopRowClass}>
                    <Label className={`${memberFormLabelClass} pt-2`}>资料附件</Label>
                    <div>
                      {editingMember ? (
                        <MemberAssetsPanel memberId={editingMember.id} canUpload compact />
                      ) : (
                        <div className="rounded-lg border border-dashed bg-muted/20 px-4 py-6 text-sm text-muted-foreground">
                          请先保存成员信息，再上传头像或资料图片。
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="px-6 py-4 border-t mt-auto">
              <Button
                type="button"
                variant="outline"
                onClick={handleCloseDialog}
              >
                取消
              </Button>
              <Button type="submit" form="family-member-form" disabled={isSubmitting || isLoadingMemberDetail}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {isSubmitting ? "保存中..." : "保存"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 表格 */}
      <div className={cn("border rounded-lg transition-opacity duration-200", isPending && "opacity-60 pointer-events-none")}>
        <Table>
          <TableHeader>
            <TableRow>
              {canDelete && (
                <TableHead className="w-12">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={handleSelectAll}
                    aria-label="全选"
                  />
                </TableHead>
              )}
              <TableHead className="w-16">ID</TableHead>
              <TableHead>姓名</TableHead>
              <TableHead className="w-20">世代</TableHead>
              <TableHead className="w-20">排行</TableHead>
              <TableHead className="w-24">父亲</TableHead>
              <TableHead className="w-16">性别</TableHead>
              <TableHead>生日</TableHead>
              <TableHead>卒年</TableHead>
              <TableHead>居住地</TableHead>
              <TableHead>官职</TableHead>
              <TableHead className="w-20">在世</TableHead>
              <TableHead>配偶</TableHead>
              <TableHead>生平事迹</TableHead>
              <TableHead className="w-44">更新时间</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {initialData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={canDelete ? 15 : 14} className="h-24 text-center">
                  暂无数据
                </TableCell>
              </TableRow>
            ) : (
              initialData.map((member) => (
                <TableRow
                  key={member.id}
                  data-state={selectedIds.has(member.id) ? "selected" : undefined}
                >
                  {canDelete && (
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(member.id)}
                        onCheckedChange={(checked) =>
                          handleSelectOne(member.id, checked as boolean)
                        }
                        aria-label={`选择 ${member.name}`}
                      />
                    </TableCell>
                  )}
                  <TableCell className="font-mono">{member.id}</TableCell>
                  <TableCell className="font-medium">
                    <button
                      type="button"
                      onClick={() => handleOpenEditDialog(member)}
                      className="text-primary hover:underline cursor-pointer text-left"
                    >
                      {member.name}
                    </button>
                  </TableCell>
                  <TableCell>{member.generation ?? "-"}</TableCell>
                  <TableCell>{member.sibling_order ?? "-"}</TableCell>
                  <TableCell>
                    {member.father_id && member.father_name ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={loadingFatherId === member.father_id}
                          onClick={async () => {
                            if (!member.father_id) return;
                            setLoadingFatherId(member.father_id);
                            try {
                              const fatherData = await fetchMemberById(member.father_id);
                              if (fatherData) {
                                handleOpenEditDialog(fatherData);
                              }
                            } finally {
                              setLoadingFatherId(null);
                            }
                          }}
                          className={cn(
                            "text-primary hover:underline cursor-pointer text-left",
                            loadingFatherId === member.father_id && "opacity-70 cursor-wait"
                          )}
                        >
                          {member.father_name}
                        </button>
                        {loadingFatherId === member.father_id && (
                          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                        )}
                      </div>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell>{member.gender ?? "-"}</TableCell>
                  <TableCell>
                    {member.birthday
                      ? (() => {
                          const [y, m, d] = member.birthday.split("-");
                          return `${y}年${m}月${d}日`;
                        })()
                      : "-"}
                  </TableCell>
                  <TableCell>
                    {member.death_date
                      ? (() => {
                          const [y, m, d] = member.death_date.split("-");
                          return `${y}年${m}月${d}日`;
                        })()
                      : "-"}
                  </TableCell>
                  <TableCell>{member.residence_place ?? "-"}</TableCell>
                  <TableCell>{member.official_position ?? "-"}</TableCell>
                  <TableCell>{member.is_alive ? "是" : "否"}</TableCell>
                  <TableCell>{member.spouse ?? "-"}</TableCell>
                  <TableCell>
                    {member.remarks ? (
                      <Button 
                        variant="link" 
                        size="sm" 
                        className="h-auto p-0" 
                        onClick={() => setBiographyMember(member)}
                      >
                        查看
                      </Button>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(member.updated_at).toLocaleString("zh-CN")}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* 分页 */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-0">
        <p className="text-sm text-muted-foreground">
          共 {totalCount} 条记录，第 {currentPage} / {totalPages || 1} 页
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage <= 1 || isPending}
          >
            <ChevronLeft className="h-4 w-4" />
            上一页
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage >= totalPages || isPending}
          >
            下一页
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* 生平事迹查看弹窗 */}
      <Dialog open={!!biographyMember} onOpenChange={(open) => !open && setBiographyMember(null)}>
        <AppDialogShell
          title={`${biographyMember?.name ?? ""} 的生平事迹`}
          contentClassName="sm:max-w-3xl"
          bodyClassName="py-2"
        >
          <RichTextViewer value={biographyMember?.remarks ?? null} />
        </AppDialogShell>
      </Dialog>
      <ConfirmActionDialog
        open={isDeleteConfirmOpen}
        onOpenChange={setIsDeleteConfirmOpen}
        title={`确定删除选中的 ${selectedIds.size} 名成员吗？`}
        description="删除后将从成员列表中移除，若关联业务数据也会一起失效。此操作不可恢复。"
        confirmText="确认删除"
        isPending={isDeleting}
        onConfirm={handleConfirmDelete}
      />

      {editingMember ? (
        <RitualEditDialog
          open={isRitualDialogOpen}
          onOpenChange={setIsRitualDialogOpen}
          memberId={editingMember.id}
          memberName={formData.name || editingMember.name}
          memberIsAlive={formData.is_alive}
          initialRitual={ritualSnapshot}
          onSaved={setRitualSnapshot}
        />
      ) : null}
      <ConfirmActionDialog
        open={isAccountResetConfirmOpen}
        onOpenChange={setIsAccountResetConfirmOpen}
        title="确定清空该成员的登录资料吗？"
        description="保存后会删除该成员的登录账号，并同时清空手机号。后续若要登录，需要重新填写身份证号开通。"
        confirmText="确认清空"
        isPending={isSubmitting}
        onConfirm={async () => {
          if (!pendingSavePayload) return;
          setIsAccountResetConfirmOpen(false);
          await saveMember(pendingSavePayload);
        }}
      />
    </div>
  );
}
