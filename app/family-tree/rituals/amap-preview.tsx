"use client";

import { useEffect, useRef, useState } from "react";
import AMapLoader from "@amap/amap-jsapi-loader";

export function AMapPreview({
  latitude,
  longitude,
}: {
  latitude: number | null;
  longitude: number | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current || latitude === null || longitude === null) {
      return;
    }

    const key = process.env.NEXT_PUBLIC_AMAP_KEY;

    if (!key) {
      setError("未配置高德地图 Key");
      return;
    }

    let map: any = null;
    let marker: any = null;

    AMapLoader.load({
      key,
      version: "2.0",
    })
      .then((AMap) => {
        map = new AMap.Map(containerRef.current, {
          zoom: 15,
          center: [longitude, latitude],
          viewMode: "2D",
        });

        marker = new AMap.Marker({
          position: [longitude, latitude],
          map,
        });

        map.add(marker);
      })
      .catch(() => {
        setError("地图加载失败");
      });

    return () => {
      if (marker) {
        marker.setMap(null);
      }
      if (map) {
        map.destroy();
      }
    };
  }, [latitude, longitude]);

  if (latitude === null || longitude === null) {
    return (
      <div className="flex h-56 items-center justify-center rounded-xl border border-dashed bg-muted/20 text-sm text-muted-foreground">
        暂无地图点位
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-56 items-center justify-center rounded-xl border border-dashed bg-muted/20 text-sm text-muted-foreground">
        {error}
      </div>
    );
  }

  return <div ref={containerRef} className="h-56 rounded-xl border" />;
}
