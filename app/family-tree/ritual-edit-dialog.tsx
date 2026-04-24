"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { AppDialogShell } from "@/components/app-dialog-shell";
import { Button } from "@/components/ui/button";
import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MemberAssetsPanel } from "./member-assets-panel";
import { RichTextEditor } from "@/components/rich-text/editor";
import { deleteMemberRitual, saveMemberRitual } from "./ritual-actions";
import { MemberRitual } from "@/lib/rituals/shared";

function parseCoordinate(value: string) {
  if (!value.trim()) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
}

export function RitualEditDialog({
  open,
  onOpenChange,
  memberId,
  memberName,
  memberIsAlive,
  initialRitual,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberId: number;
  memberName: string;
  memberIsAlive: boolean;
  initialRitual: MemberRitual | null;
  onSaved: (ritual: MemberRitual | null) => void;
}) {
  const [isSaving, setIsSaving] = useState(false);
  const [isDeletePending, setIsDeletePending] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [cemeteryName, setCemeteryName] = useState("");
  const [areaBlock, setAreaBlock] = useState("");
  const [plotNumber, setPlotNumber] = useState("");
  const [address, setAddress] = useState("");
  const [province, setProvince] = useState("");
  const [city, setCity] = useState("");
  const [district, setDistrict] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [guideText, setGuideText] = useState("");
  const [ritualNotes, setRitualNotes] = useState("");

  useEffect(() => {
    if (!open) {
      return;
    }

    setFormError(null);
    setCemeteryName(initialRitual?.cemetery_name ?? "");
    setAreaBlock(initialRitual?.area_block ?? "");
    setPlotNumber(initialRitual?.plot_number ?? "");
    setAddress(initialRitual?.address ?? "");
    setProvince(initialRitual?.province ?? "");
    setCity(initialRitual?.city ?? "");
    setDistrict(initialRitual?.district ?? "");
    setLatitude(initialRitual?.latitude?.toString() ?? "");
    setLongitude(initialRitual?.longitude?.toString() ?? "");
    setContactName(initialRitual?.contact_name ?? "");
    setContactPhone(initialRitual?.contact_phone ?? "");
    setGuideText(initialRitual?.guide_text ?? "");
    setRitualNotes(initialRitual?.ritual_notes ?? "");
  }, [initialRitual, open]);

  const formFooter = useMemo(
    () => (
      <>
        {initialRitual ? (
          <Button
            type="button"
            variant="outline"
            className="mr-auto text-red-600 hover:text-red-700"
            onClick={() => setIsDeleteConfirmOpen(true)}
            disabled={isSaving || isDeletePending}
          >
            清空祭祀资料
          </Button>
        ) : null}
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
          取消
        </Button>
        <Button type="submit" form="ritual-form" disabled={isSaving || memberIsAlive}>
          {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {isSaving ? "保存中..." : "保存祭祀信息"}
        </Button>
      </>
    ),
    [initialRitual, isDeletePending, isSaving, memberIsAlive, onOpenChange],
  );

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    if (!cemeteryName.trim()) {
      setFormError("请填写墓园名称");
      return;
    }

    if (!address.trim()) {
      setFormError("请填写详细地址");
      return;
    }

    const parsedLatitude = parseCoordinate(latitude);
    const parsedLongitude = parseCoordinate(longitude);

    if (Number.isNaN(parsedLatitude) || Number.isNaN(parsedLongitude)) {
      setFormError("经纬度格式不正确");
      return;
    }

    setIsSaving(true);
    const request = saveMemberRitual({
      memberId,
      cemetery_name: cemeteryName,
      area_block: areaBlock,
      plot_number: plotNumber,
      address,
      province,
      city,
      district,
      latitude: parsedLatitude,
      longitude: parsedLongitude,
      contact_name: contactName,
      contact_phone: contactPhone,
      guide_text: guideText,
      ritual_notes: ritualNotes,
    }).then(() => null);

    toast.promise(request, {
      loading: "正在保存祭祀资料...",
      success: "祭祀资料已保存",
      error: (error) => (error instanceof Error ? error.message : "保存失败"),
    });

    try {
      await request;
      onSaved({
        id: initialRitual?.id ?? crypto.randomUUID(),
        member_id: memberId,
        cemetery_name: cemeteryName.trim(),
        area_block: areaBlock.trim() || null,
        plot_number: plotNumber.trim() || null,
        address: address.trim(),
        province: province.trim() || null,
        city: city.trim() || null,
        district: district.trim() || null,
        latitude: parsedLatitude,
        longitude: parsedLongitude,
        contact_name: contactName.trim() || null,
        contact_phone: contactPhone.trim() || null,
        guide_text: guideText || null,
        ritual_notes: ritualNotes || null,
        updated_at: new Date().toISOString(),
      });
      onOpenChange(false);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "保存失败");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsDeletePending(true);
    const request = deleteMemberRitual(memberId);

    toast.promise(request, {
      loading: "正在清空祭祀资料...",
      success: "祭祀资料已清空",
      error: (error) => (error instanceof Error ? error.message : "清空失败"),
    });

    try {
      await request;
      onSaved(null);
      setIsDeleteConfirmOpen(false);
      onOpenChange(false);
    } finally {
      setIsDeletePending(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <AppDialogShell
          title={`${memberName} · 祭祀信息`}
          description="集中维护墓位、导航、联系人、到场指引和祭扫说明。"
          contentClassName="sm:max-w-4xl"
          bodyClassName="space-y-4"
          footer={formFooter}
        >
          <form id="ritual-form" className="space-y-4" onSubmit={handleSubmit}>
            {memberIsAlive ? (
              <Alert>
                <AlertDescription>
                  当前成员在表单里被标记为在世状态，前台不会显示祭祀入口。若要继续保存祭祀资料，请先把成员状态改回已故。
                </AlertDescription>
              </Alert>
            ) : null}

            {formError ? (
              <Alert variant="destructive">
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="cemetery_name">墓园名称 *</Label>
                <Input id="cemetery_name" value={cemeteryName} onChange={(event) => setCemeteryName(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="plot_number">墓位号</Label>
                <Input id="plot_number" value={plotNumber} onChange={(event) => setPlotNumber(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="area_block">园区 / 排 / 区</Label>
                <Input id="area_block" value={areaBlock} onChange={(event) => setAreaBlock(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact_name">联系人</Label>
                <Input id="contact_name" value={contactName} onChange={(event) => setContactName(event.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">详细地址 *</Label>
              <Input id="address" value={address} onChange={(event) => setAddress(event.target.value)} />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="province">省</Label>
                <Input id="province" value={province} onChange={(event) => setProvince(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">市</Label>
                <Input id="city" value={city} onChange={(event) => setCity(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="district">区</Label>
                <Input id="district" value={district} onChange={(event) => setDistrict(event.target.value)} />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="latitude">纬度</Label>
                <Input id="latitude" value={latitude} onChange={(event) => setLatitude(event.target.value)} placeholder="例如 31.82056" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="longitude">经度</Label>
                <Input id="longitude" value={longitude} onChange={(event) => setLongitude(event.target.value)} placeholder="例如 119.97394" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact_phone">联系电话</Label>
                <Input id="contact_phone" value={contactPhone} onChange={(event) => setContactPhone(event.target.value)} placeholder="11位手机号或固话" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>到场指引</Label>
              <RichTextEditor value={guideText} onChange={setGuideText} maxLength={2000} />
            </div>

            <div className="space-y-2">
              <Label>祭扫说明</Label>
              <RichTextEditor value={ritualNotes} onChange={setRitualNotes} maxLength={2000} />
            </div>

            <div className="space-y-2">
              <Label>祭祀附件</Label>
              <MemberAssetsPanel memberId={memberId} canUpload={!memberIsAlive} assetScope="ritual" />
            </div>
          </form>
        </AppDialogShell>
      </Dialog>

      <ConfirmActionDialog
        open={isDeleteConfirmOpen}
        onOpenChange={setIsDeleteConfirmOpen}
        title="确认清空祭祀资料"
        description="清空后将删除该成员当前的祭祀地点与说明，但不会删除成员本身。"
        confirmText="确认清空"
        isPending={isDeletePending}
        onConfirm={handleDelete}
      />
    </>
  );
}
