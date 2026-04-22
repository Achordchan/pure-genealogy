"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Loader2, Upload, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { MEMBER_ASSET_BUCKET, type MemberAsset, isImageMimeType } from "@/lib/storage/shared";
import { uploadMemberAssetAction } from "./actions";

interface DisplayMemberAsset extends MemberAsset {
  signedUrl: string | null;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
}

export function MemberAssetsPanel({
  memberId,
  canUpload,
  compact = false,
}: {
  memberId: number;
  canUpload: boolean;
  compact?: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [assets, setAssets] = useState<DisplayMemberAsset[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let active = true;

    async function loadAssets() {
      setIsLoading(true);
      setError(null);
      const supabase = createClient();
      const { data, error: selectError } = await supabase
        .from("member_assets")
        .select("*")
        .eq("member_id", memberId)
        .order("created_at", { ascending: false })
        .returns<MemberAsset[]>();

      if (!active) {
        return;
      }

      if (selectError) {
        setError(selectError.message);
        setAssets([]);
        setIsLoading(false);
        return;
      }

      const rows = data ?? [];
      const withUrls = await Promise.all(
        rows.map(async (item) => {
          const { data: signedData, error: signedError } = await supabase.storage
            .from(MEMBER_ASSET_BUCKET)
            .createSignedUrl(item.object_path, 60 * 60);

          return {
            ...item,
            signedUrl: signedError ? null : signedData.signedUrl,
          };
        }),
      );

      if (!active) {
        return;
      }

      setAssets(withUrls);
      setIsLoading(false);
    }

    void loadAssets();

    return () => {
      active = false;
    };
  }, [memberId]);

  const reloadAssets = () => {
    setIsLoading(true);
    const supabase = createClient();
    supabase
      .from("member_assets")
      .select("*")
      .eq("member_id", memberId)
      .order("created_at", { ascending: false })
      .returns<MemberAsset[]>()
      .then(async ({ data, error: selectError }) => {
        if (selectError) {
          setError(selectError.message);
          setAssets([]);
          setIsLoading(false);
          return;
        }

        const rows = data ?? [];
        const withUrls = await Promise.all(
          rows.map(async (item) => {
            const { data: signedData, error: signedError } = await supabase.storage
              .from(MEMBER_ASSET_BUCKET)
              .createSignedUrl(item.object_path, 60 * 60);

            return {
              ...item,
              signedUrl: signedError ? null : signedData.signedUrl,
            };
          }),
        );

        setAssets(withUrls);
        setIsLoading(false);
      });
  };

  const handleUpload = () => {
    if (!selectedFile) {
      setError("请先选择图片");
      return;
    }

    startTransition(async () => {
      setError(null);
      const formData = new FormData();
      formData.append("memberId", String(memberId));
      formData.append("file", selectedFile);
      const result = await uploadMemberAssetAction(formData);

      if (!result.success) {
        setError(result.error);
        return;
      }

      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      reloadAssets();
    });
  };

  return (
    <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">资料附件</p>
          <p className="text-xs text-muted-foreground">
            支持查看成员图片资料，编辑员和管理员可上传。
          </p>
        </div>
        {canUpload && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="max-w-[220px] text-xs"
              onChange={(event) => {
                const nextFile = event.target.files?.[0] ?? null;
                if (nextFile && !isImageMimeType(nextFile.type)) {
                  setSelectedFile(null);
                  setError("只支持上传图片文件");
                  event.target.value = "";
                  return;
                }
                setError(null);
                setSelectedFile(nextFile);
              }}
            />
            <Button type="button" size="sm" onClick={handleUpload} disabled={!selectedFile || isPending}>
              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              上传图片
            </Button>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          正在加载附件
        </div>
      ) : assets.length === 0 ? (
        <div className="rounded-md border border-dashed bg-background/70 px-4 py-6 text-sm text-muted-foreground">
          当前还没有上传资料图片
        </div>
      ) : (
        <div className={compact ? "grid grid-cols-2 gap-3 sm:grid-cols-3" : "grid gap-3 sm:grid-cols-2"}>
          {assets.map((asset) => (
            <div key={asset.id} className="overflow-hidden rounded-md border bg-background">
              <div className="flex aspect-[4/3] items-center justify-center bg-muted/30">
                {asset.signedUrl ? (
                  <img
                    src={asset.signedUrl}
                    alt={asset.file_name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <ImageIcon className="h-8 w-8 text-muted-foreground" />
                )}
              </div>
              <div className="space-y-1 p-3">
                <p className="line-clamp-2 text-sm font-medium">{asset.file_name}</p>
                <p className="text-xs text-muted-foreground">{formatDate(asset.created_at)}</p>
                {asset.signedUrl && (
                  <a
                    href={asset.signedUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-primary hover:underline"
                  >
                    查看原图
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
