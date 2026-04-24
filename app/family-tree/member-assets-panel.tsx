"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Eye, Film, ImageIcon, Loader2, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  type MemberAsset,
  type MemberAssetScope,
  isImageMimeType,
  isSupportedMemberAssetMimeType,
  isVideoMimeType,
} from "@/lib/storage/shared";
import { buildClientApiUrl, clientApiFetch } from "@/lib/api/client";
import type { ApiMemberAsset } from "@/lib/api/types";

interface DisplayMemberAsset extends MemberAsset {
  url: string;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
}

function getAssetDownloadPath(assetId: string) {
  return buildClientApiUrl(`/api/assets/${assetId}/download`);
}

export function MemberAssetsPanel({
  memberId,
  canUpload,
  compact = false,
  assetScope = "profile",
}: {
  memberId: number;
  canUpload: boolean;
  compact?: boolean;
  assetScope?: MemberAssetScope;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [assets, setAssets] = useState<DisplayMemberAsset[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingAssetId, setDeletingAssetId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let active = true;

    async function loadAssets() {
      setIsLoading(true);
      setError(null);
      try {
        const { items } = await clientApiFetch<{ items: ApiMemberAsset[] }>(
          `/api/members/${memberId}/assets?assetScope=${assetScope}`,
        );
        if (active) {
          setAssets(items.map((item) => ({ ...item, url: getAssetDownloadPath(item.id) })));
        }
      } catch (error) {
        if (active) {
          setError(error instanceof Error ? error.message : "读取附件失败");
          setAssets([]);
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void loadAssets();

    return () => {
      active = false;
    };
  }, [assetScope, memberId]);

  const reloadAssets = () => {
    setIsLoading(true);
    clientApiFetch<{ items: ApiMemberAsset[] }>(
      `/api/members/${memberId}/assets?assetScope=${assetScope}`,
    )
      .then(({ items }) => {
        setAssets(items.map((item) => ({ ...item, url: getAssetDownloadPath(item.id) })));
      })
      .catch((error) => {
        setError(error instanceof Error ? error.message : "读取附件失败");
        setAssets([]);
      })
      .finally(() => setIsLoading(false));
  };

  const handleUpload = () => {
    if (!selectedFile) {
      setError(assetScope === "ritual" ? "请先选择祭祀附件" : "请先选择图片");
      return;
    }

    startTransition(async () => {
      setError(null);
      const formData = new FormData();
      formData.append("assetScope", assetScope);
      formData.append("file", selectedFile);

      try {
        await clientApiFetch(`/api/members/${memberId}/assets`, {
          method: "POST",
          body: formData,
        });
      } catch (error) {
        setError(error instanceof Error ? error.message : "上传附件失败");
        return;
      }

      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      reloadAssets();
    });
  };

  const handleDelete = (asset: DisplayMemberAsset) => {
    const confirmed = window.confirm(`确认删除附件“${asset.file_name}”？`);
    if (!confirmed) return;

    setDeletingAssetId(asset.id);
    setError(null);
    clientApiFetch(`/api/assets/${asset.id}`, { method: "DELETE" })
      .then(() => {
        setAssets((current) => current.filter((item) => item.id !== asset.id));
      })
      .catch((error) => {
        setError(error instanceof Error ? error.message : "删除附件失败");
      })
      .finally(() => setDeletingAssetId(null));
  };

  if (!canUpload && !isLoading && !error && assets.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
      <div className="space-y-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">资料附件</p>
          <p className="text-xs text-muted-foreground">
            {assetScope === "ritual"
              ? "支持查看祭祀图片和视频指引，编辑员和管理员可上传。"
              : "支持查看成员图片资料，编辑员和管理员可上传。"}
          </p>
        </div>
        {canUpload && (
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <input
              ref={fileInputRef}
              type="file"
              accept={assetScope === "ritual" ? "image/*,video/mp4,video/webm,video/quicktime" : "image/*"}
              className="max-w-full text-xs sm:max-w-[280px]"
              onChange={(event) => {
                const nextFile = event.target.files?.[0] ?? null;
                if (nextFile && !isSupportedMemberAssetMimeType(assetScope, nextFile.type)) {
                  setSelectedFile(null);
                  setError(assetScope === "ritual" ? "只支持上传图片或视频文件" : "只支持上传图片文件");
                  event.target.value = "";
                  return;
                }
                setError(null);
                setSelectedFile(nextFile);
              }}
            />
            <Button type="button" size="sm" onClick={handleUpload} disabled={!selectedFile || isPending}>
              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              {assetScope === "ritual" ? "上传附件" : "上传图片"}
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
          {assetScope === "ritual" ? "当前还没有上传祭祀附件" : "当前还没有上传资料图片"}
        </div>
      ) : (
        <div className={compact ? "grid grid-cols-2 gap-3 sm:grid-cols-3" : "grid gap-3 sm:grid-cols-2"}>
          {assets.map((asset) => (
            <div key={asset.id} className="overflow-hidden rounded-md border bg-background">
              <div className="flex aspect-[4/3] items-center justify-center bg-muted/30">
                {isImageMimeType(asset.mime_type) ? (
                  <img
                    src={asset.url}
                    alt={asset.file_name}
                    className="h-full w-full object-cover"
                  />
                ) : isVideoMimeType(asset.mime_type) ? (
                  <video
                    src={asset.url}
                    className="h-full w-full object-cover"
                    controls
                    preload="metadata"
                  />
                ) : (
                  isVideoMimeType(asset.mime_type) ? (
                    <Film className="h-8 w-8 text-muted-foreground" />
                  ) : (
                    <ImageIcon className="h-8 w-8 text-muted-foreground" />
                  )
                )}
              </div>
              <div className="space-y-1 p-3">
                <p className="line-clamp-2 text-sm font-medium">{asset.file_name}</p>
                <p className="text-xs text-muted-foreground">{formatDate(asset.created_at)}</p>
                <div className="flex items-center gap-1">
                  <a
                    href={asset.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-primary hover:bg-primary/10"
                    aria-label={isVideoMimeType(asset.mime_type) ? "查看原视频" : "查看原图"}
                    title={isVideoMimeType(asset.mime_type) ? "查看原视频" : "查看原图"}
                  >
                    <Eye className="h-4 w-4" />
                  </a>
                  {canUpload ? (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-red-600 hover:bg-red-50 hover:text-red-700"
                      disabled={deletingAssetId === asset.id}
                      onClick={() => handleDelete(asset)}
                      aria-label="删除附件"
                      title="删除附件"
                    >
                      {deletingAssetId === asset.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
